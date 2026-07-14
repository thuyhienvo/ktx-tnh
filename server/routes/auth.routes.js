const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { signToken, requireAuth, setAuthCookie, clearAuthCookie } = require('../auth');

const router = express.Router();

const publicUser = u => ({
  id: u.id, username: u.username, role: u.role, full_name: u.full_name,
  student_id: u.student_id, must_change_password: !!u.must_change_password,
});

// Đăng nhập — đặt token vào cookie httpOnly, KHÔNG trả token cho client
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Nhập tên đăng nhập và mật khẩu' });

    const { rows } = await query('SELECT * FROM users WHERE lower(username) = lower($1) AND deleted_at IS NULL', [username.trim()]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });
    }
    // Học viên đã bị xoá hồ sơ (deleted_at) thì không cho đăng nhập nữa
    if (user.role === 'student' && user.student_id) {
      const s = (await query('SELECT 1 FROM students WHERE id=$1 AND deleted_at IS NULL', [user.student_id])).rows[0];
      if (!s) return res.status(401).json({ error: 'Tài khoản không còn hiệu lực' });
    }
    setAuthCookie(res, signToken(user));
    res.json({ user: publicUser(user) });
  } catch (e) { next(e); }
});

// Đăng xuất — xóa cookie phiên
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// Thông tin người đang đăng nhập (dùng khi tải lại trang — nguồn xác thực là cookie)
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT id, username, role, full_name, student_id, must_change_password FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0]) return res.status(401).json({ error: 'Tài khoản không tồn tại' });
    res.json(publicUser(rows[0]));
  } catch (e) { next(e); }
});

// Đổi mật khẩu (chính mình) — xóa cờ bắt buộc đổi mật khẩu sau khi thành công
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Mật khẩu mới tối thiểu 6 ký tự' });
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = rows[0];
    if (!bcrypt.compareSync(oldPassword || '', user.password_hash)) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
    }
    if (bcrypt.compareSync(newPassword, user.password_hash)) {
      return res.status(400).json({ error: 'Mật khẩu mới phải khác mật khẩu hiện tại' });
    }
    await query('UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2',
      [bcrypt.hashSync(newPassword, 10), user.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
