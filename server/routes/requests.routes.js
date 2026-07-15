const express = require('express');
const { query } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { recalcInvoice } = require('../invoice-calc');
const roomStays = require('../room-stays');
const meter = require('../meter');

const router = express.Router();
router.use(requireAuth, requireRole('admin', 'staff'));

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

// Duyệt & chuyển bộ phận bảo trì (chỉ áp dụng báo hư hỏng phòng)
router.post('/damage/:id/assign', async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE damage_reports SET assigned_at=now(), status=CASE WHEN status='done' THEN status ELSE 'processing' END
       WHERE id=$1 AND category='damage' RETURNING *`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy báo hư hỏng (chỉ chuyển được mục hư hỏng phòng)' });
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
    const roomId = st.rows[0]?.room_id || null;

    // Chốt chỉ số điện ngày trả phòng (nếu người duyệt có nhập) — kiểm tra trước khi ghi
    const mr = req.body.meter_reading;
    const hasMeter = mr != null && String(mr).trim() !== '';
    if (hasMeter) {
      if (!roomId) return res.status(400).json({ error: 'Học viên không ở phòng nào — không có công-tơ để chốt chỉ số' });
      const err = await meter.checkRead(null, { roomId, date, reading: mr });
      if (err) return res.status(400).json({ error: err });
    }

    await query(`UPDATE students SET status='out', check_out_date=$1, checkout_notice_date=$2, checkout_reason=$3 WHERE id=$4`,
      [date, noticeDate, cr.reason, cr.student_id]);
    await roomStays.checkOut(null, cr.student_id, date);
    if (hasMeter) {
      await meter.recordRead(null, {
        roomId, date, reading: mr, reason: 'checkout', studentId: cr.student_id,
        note: 'Chốt chỉ số lúc trả phòng (duyệt đơn HV)', by: req.user && req.user.username,
      });
    }
    await query(`INSERT INTO logs (student_id, type, date, room_id, note, source) VALUES ($1,'out',$2,$3,$4,'self')`,
      [cr.student_id, date, roomId, 'Trả phòng (duyệt đơn HV)']);
    await query(`UPDATE checkout_requests SET status='done', handled_at=now() WHERE id=$1`, [req.params.id]);

    // Chốt giữa kỳ đổi phần chia của cả phòng -> tính lại cho mọi người liên quan
    try { await recalcInvoice(cr.student_id, date.slice(0, 7)); } catch (e) {}
    if (hasMeter) {
      for (const sid of await meter.affectedStudents(null, roomId, date)) {
        if (sid === cr.student_id) continue;
        try { await recalcInvoice(sid, date.slice(0, 7)); } catch (e) {}
      }
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.put('/checkout/:id/note', async (req, res, next) => {
  try {
    const { rows } = await query('UPDATE checkout_requests SET admin_note=$1 WHERE id=$2 RETURNING id', [req.body.note || '', req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy đơn' });
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
