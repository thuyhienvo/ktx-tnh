const express = require('express');
const { query } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { recalcInvoice } = require('../invoice-calc');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

/* ---- Báo cáo hư hỏng ---- */
router.get('/damage', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT d.*, s.name AS student_name, r.name AS room_name
      FROM damage_reports d
      LEFT JOIN students s ON s.id = d.student_id
      LEFT JOIN rooms r ON r.id = d.room_id
      ORDER BY (d.status<>'done') DESC, d.created_at DESC`);
    res.json(rows);
  } catch (e) { next(e); }
});

router.put('/damage/:id', async (req, res, next) => {
  try {
    const status = ['new', 'processing', 'done'].includes(req.body.status) ? req.body.status : 'new';
    const { rows } = await query(
      `UPDATE damage_reports SET status=$1, admin_note=$2, resolved_at=$3 WHERE id=$4 RETURNING *`,
      [status, req.body.admin_note || '', status === 'done' ? new Date().toISOString() : null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy báo cáo' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

/* ---- Đơn đăng ký trả phòng ---- */
router.get('/checkout', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT c.*, s.name AS student_name, s.deposit_status, r.name AS room_name
      FROM checkout_requests c
      LEFT JOIN students s ON s.id = c.student_id
      LEFT JOIN rooms r ON r.id = s.room_id
      ORDER BY (c.status='pending') DESC, c.created_at DESC`);
    res.json(rows);
  } catch (e) { next(e); }
});

// Xác nhận trả phòng: thực hiện check-out thật cho học viên
router.post('/checkout/:id/confirm', async (req, res, next) => {
  try {
    const cr = (await query('SELECT * FROM checkout_requests WHERE id=$1', [req.params.id])).rows[0];
    if (!cr) return res.status(404).json({ error: 'Không tìm thấy đơn' });
    const date = req.body.date || cr.desired_date || new Date().toISOString().slice(0, 10);
    const noticeDate = cr.created_at ? new Date(cr.created_at).toISOString().slice(0, 10) : null;
    const st = await query('SELECT room_id FROM students WHERE id=$1', [cr.student_id]);
    await query(`UPDATE students SET status='out', check_out_date=$1, checkout_notice_date=$2, checkout_reason=$3 WHERE id=$4`,
      [date, noticeDate, cr.reason, cr.student_id]);
    await query(`INSERT INTO logs (student_id, type, date, room_id, note, source) VALUES ($1,'out',$2,$3,$4,'self')`,
      [cr.student_id, date, st.rows[0]?.room_id || null, 'Trả phòng (duyệt đơn HV)']);
    await query(`UPDATE checkout_requests SET status='done', handled_at=now() WHERE id=$1`, [req.params.id]);
    try { await recalcInvoice(cr.student_id, date.slice(0, 7)); } catch (e) {}
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/checkout/:id/reject', async (req, res, next) => {
  try {
    await query(`UPDATE checkout_requests SET status='rejected', handled_at=now() WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
