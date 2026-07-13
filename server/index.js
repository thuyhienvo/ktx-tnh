require('./load-env'); // nạp .env khi chạy local (phải trước khi đọc process.env)
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const { generateIcons } = require('./gen-icons');

try { generateIcons(); } catch (e) { console.warn('Không sinh được icon:', e.message); }

const app = express();
app.set('trust proxy', 1); // sau proxy Render → lấy đúng IP client cho rate-limit

// Security headers. CSP tạm tắt (app dùng inline onclick/style) — sẽ bật CSP riêng ở giai đoạn sau.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
}));

// Body JSON: route nhận ảnh base64 (CCCD/giới thiệu) cần body lớn; các route còn lại siết nhỏ để giảm DoS.
// Parser lớn chạy TRƯỚC cho các path upload → parser nhỏ phía sau tự bỏ qua (body đã parse).
const jsonBig = express.json({ limit: '16mb' });
app.use(['/api/public', '/api/students', '/api/applications', '/api/media', '/api/invoices', '/api/settings'], jsonBig);
app.use(express.json({ limit: '2mb' }));

// Rate-limit: chặn brute-force login + lạm dụng API
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false, message: { error: 'Quá nhiều yêu cầu, vui lòng thử lại sau ít phút.' } });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Đăng nhập sai quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.' } });
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/change-password', authLimiter);

// Log gọn các request API
app.use('/api', (req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// Nhật ký thao tác (audit): ghi mọi thay đổi (POST/PUT/DELETE) của người dùng đã đăng nhập
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && !/^\/auth\//.test(req.path)) {
    res.on('finish', () => {
      if (res.statusCode >= 400 || !req.user || req.user.role === 'student') return;
      let detail = '';
      try {
        const b = req.body || {}, c = {};
        for (const k of Object.keys(b)) {
          if (/password|cccd|image|data|smtp_pass|token/i.test(k)) c[k] = '***';
          else if (typeof b[k] === 'string' && b[k].length > 100) c[k] = b[k].slice(0, 100) + '…';
          else c[k] = b[k];
        }
        detail = JSON.stringify(c).slice(0, 500);
      } catch (e) {}
      db.pool.query(
        'INSERT INTO audit_log (user_id, username, role, method, path, detail) VALUES ($1,$2,$3,$4,$5,$6)',
        [req.user.id || null, req.user.username || '', req.user.role || '', req.method, req.originalUrl.split('?')[0], detail]
      ).catch(() => {});
    });
  }
  next();
});

// ---- API ----
app.use('/api/public', require('./routes/public.routes')); // không cần đăng nhập
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/applications', require('./routes/applications.routes'));
app.use('/api/requests', require('./routes/requests.routes'));
app.use('/api/violations', require('./routes/violations.routes'));
app.use('/api/media', require('./routes/media.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/settings', require('./routes/settings.routes'));
app.use('/api/facilities', require('./routes/facilities.routes'));
app.use('/api/rooms', require('./routes/rooms.routes'));
app.use('/api/students', require('./routes/students.routes'));
app.use('/api/electric', require('./routes/electric.routes'));
app.use('/api/vehicles', require('./routes/vehicles.routes'));
app.use('/api/assets', require('./routes/assets.routes'));
app.use('/api/invoices', require('./routes/invoices.routes'));
app.use('/api/reports', require('./routes/reports.routes'));
app.use('/api/logs', require('./routes/logs.routes'));
app.use('/api/me', require('./routes/me.routes'));
app.use('/api/maintenance', require('./routes/maintenance.routes'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---- PWA / Frontend tĩnh ----
const pub = path.join(__dirname, '..', 'public');
app.use(express.static(pub));

// SPA fallback: mọi đường dẫn không phải /api trả về index.html
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(pub, 'index.html'));
});

// Xử lý lỗi tập trung. Lỗi có err.status 4xx -> trả message cho client; còn lại -> 500 chung (không lộ chi tiết nội bộ).
app.use((err, req, res, next) => {
  const status = (err && Number(err.status) >= 400 && Number(err.status) < 500) ? Number(err.status) : 500;
  if (status >= 500) console.error('❌', err);
  res.status(status).json({ error: status >= 500 ? 'Lỗi máy chủ' : (err.message || 'Yêu cầu không hợp lệ') });
});

const PORT = process.env.PORT || 3000;

db.init()
  .then(() => {
    const server = app.listen(PORT, () => console.log(`🚀 Ứng dụng chạy tại http://localhost:${PORT}`));
    // Graceful shutdown: ngừng nhận request mới, đóng pool, thoát sạch (khi Render redeploy/SIGTERM)
    const shutdown = (sig) => {
      console.log(`\n${sig} — đang tắt máy chủ...`);
      server.close(() => { db.pool.end().catch(() => {}).finally(() => process.exit(0)); });
      setTimeout(() => process.exit(1), 10000).unref(); // ép thoát nếu treo quá 10s
    };
    ['SIGTERM', 'SIGINT'].forEach(s => process.on(s, () => shutdown(s)));
  })
  .catch(err => {
    console.error('Không khởi động được:', err);
    process.exit(1);
  });
