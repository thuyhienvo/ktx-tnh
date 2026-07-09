const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'doi_chuoi_bi_mat_nay_di';

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, student_id: user.student_id || null },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// Middleware: yêu cầu đã đăng nhập
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
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

module.exports = { signToken, requireAuth, requireRole, JWT_SECRET };
