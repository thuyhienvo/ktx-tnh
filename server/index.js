const path = require('path');
const express = require('express');
const db = require('./db');
const { generateIcons } = require('./gen-icons');

try { generateIcons(); } catch (e) { console.warn('Không sinh được icon:', e.message); }

const app = express();
app.use(express.json({ limit: '20mb' })); // đủ lớn để nhận ảnh CCCD base64

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

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---- PWA / Frontend tĩnh ----
const pub = path.join(__dirname, '..', 'public');
app.use(express.static(pub));

// SPA fallback: mọi đường dẫn không phải /api trả về index.html
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(pub, 'index.html'));
});

// Xử lý lỗi tập trung
app.use((err, req, res, next) => {
  console.error('❌', err);
  res.status(500).json({ error: 'Lỗi máy chủ', detail: err.message });
});

const PORT = process.env.PORT || 3000;

db.init()
  .then(() => {
    app.listen(PORT, () => console.log(`🚀 Ứng dụng chạy tại http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('Không khởi động được:', err);
    process.exit(1);
  });
