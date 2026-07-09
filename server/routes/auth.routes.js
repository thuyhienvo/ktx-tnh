const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { signToken, requireAuth } = require('../auth');

const router = express.Router();

// Đăng nhập
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Nhập tên đăng nhập và mật khẩu' });

    const { rows } = await query('SELECT * FROM users WHERE lower(username) = lower($1)', [username.trim()]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });
    }
    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name, student_id: user.student_id },
    });
  } catch (e) { next(e); }
});

// Thông tin người đang đăng nhập
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT id, username, role, full_name, student_id FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0]) return res.status(401).json({ error: 'Tài khoản không tồn tại' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Đổi mật khẩu (chính mình)
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'Mật khẩu mới tối thiểu 4 ký tự' });
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = rows[0];
    if (!bcrypt.compareSync(oldPassword || '', user.password_hash)) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
    }
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [bcrypt.hashSync(newPassword, 10), user.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
