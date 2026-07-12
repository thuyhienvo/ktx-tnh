const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'doi_chuoi_bi_mat_nay_di';

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, student_id: user.student_id || null },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

const COOKIE_NAME = 'ktx_token';
const COOKIE_MAX_AGE = 30 * 24 * 3600 * 1000; // 30 ngày

// Lấy token: ưu tiên cookie httpOnly; fallback header Authorization (cho script/kiểm thử)
function readToken(req) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)ktx_token=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

// Đặt cookie phiên (httpOnly để JS client không đọc được -> chống XSS đánh cắp token)
function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
}
function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

// Middleware: yêu cầu đã đăng nhập
function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
  }
}

// Middleware: yêu cầu vai trò cụ thể
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này' });
    }
    next();
  };
}

module.exports = { signToken, requireAuth, requireRole, JWT_SECRET, setAuthCookie, clearAuthCookie };
