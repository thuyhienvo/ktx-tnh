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
// Chống dò mật khẩu = đếm lần ĐĂNG NHẬP SAI. skipSuccessfulRequests: đăng nhập ĐÚNG không bị tính.
// Trước đây đếm cả lần đúng -> người dùng thật đăng nhập nhiều thiết bị / hết phiên vài lần là bị khoá,
// mà câu báo lỗi lại nói "đăng nhập sai quá nhiều lần" — sai sự thật, không ai hiểu tại sao mình bị chặn.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20, skipSuccessfulRequests: true,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Đăng nhập sai quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.' },
});
// Nộp đơn đăng ký: đường DUY NHẤT cho người HOÀN TOÀN ẨN DANH ghi vào CSDL và đẩy ảnh lên S3,
// lại đi qua parser 16MB. Trần chung 600/phút quá rộng: đo thật thấy 40 đơn giống hệt nhau
// lọt hết trong 142ms.
// Chặn theo PHÚT chứ không theo giờ, và để rộng tay: học viên thường nộp đơn từ wifi chung
// của trường — cả phòng máy đi ra Internet bằng MỘT IP. Siết theo giờ thì mùa tuyển sinh
// người thứ 7 trở đi bị chặn oan mà không hiểu vì sao. Chặn theo phút cắt được trận dồn dập
// (thứ mà máy làm) nhưng không cản nổi người thật gõ tay (thứ mà người làm).
// Việc chống "một người gửi lại nhiều lần" là của chốt chống trùng tên+SĐT trong public.routes.js.
const applyLimiter = rateLimit({
  windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Có quá nhiều đơn gửi lên cùng lúc từ mạng của bạn. Vui lòng đợi một phút rồi thử lại, hoặc gọi hotline để được hỗ trợ.' },
});
app.use('/api', apiLimiter);
app.use('/api/public/apply', applyLimiter);
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
      const denied = res.statusCode === 401 || res.statusCode === 403;
      if (!req.user) return;                                   // chưa đăng nhập -> không có ai để ghi
      if (req.body && req.body.preview === true) return;       // xem trước hóa đơn (ROLLBACK) -> không ghi
      // Ghi: (a) thao tác THÀNH CÔNG của admin/staff/maintenance; (b) MỌI lần BỊ TỪ CHỐI (phát hiện lạm quyền)
      if (!denied && (res.statusCode >= 400 || req.user.role === 'student')) return;
      let detail = '';
      try {
        const b = req.body || {}, c = {};
        for (const k of Object.keys(b)) {
          if (/password|cccd|image|data|smtp_pass|token/i.test(k)) c[k] = '***';
          else if (typeof b[k] === 'string' && b[k].length > 100) c[k] = b[k].slice(0, 100) + '…';
          else c[k] = b[k];
        }
        detail = (denied ? `[TỪ CHỐI ${res.statusCode}] ` : '') + JSON.stringify(c).slice(0, 460);
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
