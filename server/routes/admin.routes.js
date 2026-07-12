const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

/* ---------- Nhật ký thao tác (audit) ---------- */
router.get('/audit', async (req, res, next) => {
  try {
    const limit = Math.min(500, +req.query.limit || 200);
    const { rows } = await query('SELECT * FROM audit_log ORDER BY at DESC LIMIT $1', [limit]);
    res.json(rows);
  } catch (e) { next(e); }
});

/* ---------- Quản lý tài khoản nhân viên ---------- */
const ROLE = r => (['admin', 'staff'].includes(r) ? r : 'staff');

router.get('/users', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, username, role, full_name, created_at FROM users WHERE role IN ('admin','staff') ORDER BY role, username`);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/users', async (req, res, next) => {
  try {
    const username = (req.body.username || '').trim();
    const password = (req.body.password || '').trim();
    if (!username) return res.status(400).json({ error: 'Nhập tên đăng nhập' });
    if (password.length < 4) return res.status(400).json({ error: 'Mật khẩu tối thiểu 4 ký tự' });
    const dup = await query('SELECT 1 FROM users WHERE lower(username)=lower($1)', [username]);
    if (dup.rows.length) return res.status(400).json({ error: `Tên đăng nhập "${username}" đã tồn tại` });
    const { rows } = await query(
      `INSERT INTO users (username, password_hash, role, full_name) VALUES ($1,$2,$3,$4) RETURNING id, username, role, full_name`,
      [username, bcrypt.hashSync(password, 10), ROLE(req.body.role), (req.body.full_name || '').trim()]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/users/:id', async (req, res, next) => {
  try {
    const id = +req.params.id;
    if (id === req.user.id && req.body.role && req.body.role !== 'admin')
      return res.status(400).json({ error: 'Không thể tự hạ quyền chính mình' });
    const { rows } = await query(
      `UPDATE users SET full_name=$1, role=$2 WHERE id=$3 AND role IN ('admin','staff') RETURNING id`,
      [(req.body.full_name || '').trim(), ROLE(req.body.role), id]);
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/users/:id/password', async (req, res, next) => {
  try {
    const password = (req.body.password || '').trim();
    if (password.length < 4) return res.status(400).json({ error: 'Mật khẩu tối thiểu 4 ký tự' });
    await query('UPDATE users SET password_hash=$1 WHERE id=$2', [bcrypt.hashSync(password, 10), req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    const id = +req.params.id;
    if (id === req.user.id) return res.status(400).json({ error: 'Không thể xóa chính mình' });
    const admins = (await query("SELECT COUNT(*)::int c FROM users WHERE role='admin'")).rows[0].c;
    const target = (await query('SELECT role FROM users WHERE id=$1', [id])).rows[0];
    if (target && target.role === 'admin' && admins <= 1) return res.status(400).json({ error: 'Phải còn ít nhất 1 quản trị viên' });
    await query("DELETE FROM users WHERE id=$1 AND role IN ('admin','staff')", [id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
