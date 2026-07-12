const express = require('express');
const { query } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();
router.use(requireAuth, requireRole('student'));

// Hồ sơ của chính học viên đang đăng nhập
router.get('/profile', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT s.*, r.name AS room_name, r.floor AS room_floor, r.monthly_fee
      FROM students s LEFT JOIN rooms r ON r.id = s.room_id
      WHERE s.id = $1`, [req.user.student_id]);
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy hồ sơ học viên' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Hóa đơn của học viên
router.get('/invoices', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM invoices WHERE student_id=$1 AND deleted_at IS NULL ORDER BY month DESC', [req.user.student_id]);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/logs', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM logs WHERE student_id=$1 ORDER BY date DESC, id DESC LIMIT 100', [req.user.student_id]);
    res.json(rows);
  } catch (e) { next(e); }
});

// Vi phạm / nhắc nhở của chính học viên (chỉ đọc)
router.get('/violations', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT date, type_name, severity, level, note, status FROM violations WHERE student_id=$1 AND deleted_at IS NULL ORDER BY date DESC, id DESC', [req.user.student_id]);
    res.json(rows);
  } catch (e) { next(e); }
});

/* ---- Báo cáo hư hỏng ---- */
router.get('/damage', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM damage_reports WHERE student_id=$1 ORDER BY created_at DESC', [req.user.student_id]);
    res.json(rows);
  } catch (e) { next(e); }
});
router.post('/damage', async (req, res, next) => {
  try {
    const { title, description } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Nhập nội dung hư hỏng' });
    const st = await query('SELECT room_id FROM students WHERE id=$1', [req.user.student_id]);
    const { rows } = await query(
      `INSERT INTO damage_reports (student_id, room_id, title, description) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.student_id, st.rows[0]?.room_id || null, title.trim(), description || '']
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

/* ---- Đơn đăng ký trả phòng ---- */
router.get('/checkout-request', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM checkout_requests WHERE student_id=$1 ORDER BY created_at DESC', [req.user.student_id]);
    res.json(rows);
  } catch (e) { next(e); }
});
router.post('/checkout-request', async (req, res, next) => {
  try {
    const { desired_date, reason, note } = req.body;
    const pending = await query(`SELECT 1 FROM checkout_requests WHERE student_id=$1 AND status='pending'`, [req.user.student_id]);
    if (pending.rows.length) return res.status(400).json({ error: 'Bạn đã có đơn trả phòng đang chờ duyệt' });
    const { rows } = await query(
      `INSERT INTO checkout_requests (student_id, desired_date, reason, note) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.student_id, desired_date || null, ['departure', 'personal', 'facility', 'dropout', 'reserve', 'other'].includes(reason) ? reason : 'other', note || '']
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
