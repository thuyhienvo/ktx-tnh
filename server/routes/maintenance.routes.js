const express = require('express');
const { query } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { recalcInvoice } = require('../invoice-calc');

const router = express.Router();
router.use(requireAuth, requireRole('maintenance', 'admin'));

const curMonth = () => new Date().toISOString().slice(0, 7);
const isMonth = m => /^\d{4}-\d{2}$/.test(m || '');

// Danh sách bàn giao phòng theo tháng — bảo trì CHỈ thấy: tên, phòng, ngày, xác nhận, ghi chú
router.get('/handovers', async (req, res, next) => {
  try {
    const month = isMonth(req.query.month) ? req.query.month : curMonth();
    const checkins = (await query(`
      SELECT s.id, s.name, r.name AS room_name, s.check_in_date AS date,
             s.checkin_confirmed_at, s.checkin_confirm_note
      FROM students s LEFT JOIN rooms r ON r.id = s.room_id
      WHERE s.deleted_at IS NULL AND to_char(s.check_in_date,'YYYY-MM')=$1
      ORDER BY s.check_in_date, s.name`, [month])).rows;
    const checkouts = (await query(`
      SELECT s.id, s.name, r.name AS room_name, s.check_out_date AS date,
             s.checkout_confirmed_at, s.checkout_actual_date, s.checkout_confirm_note
      FROM students s LEFT JOIN rooms r ON r.id = s.room_id
      WHERE s.deleted_at IS NULL AND to_char(s.check_out_date,'YYYY-MM')=$1
      ORDER BY s.check_out_date, s.name`, [month])).rows;
    res.json({ month, checkins, checkouts });
  } catch (e) { next(e); }
});

// Số việc bàn giao chưa xác nhận (tháng này) — cho thông báo
router.get('/handovers/summary', async (req, res, next) => {
  try {
    const m = curMonth();
    const ci = (await query(`SELECT COUNT(*)::int c FROM students WHERE deleted_at IS NULL AND to_char(check_in_date,'YYYY-MM')=$1 AND checkin_confirmed_at IS NULL`, [m])).rows[0].c;
    const co = (await query(`SELECT COUNT(*)::int c FROM students WHERE deleted_at IS NULL AND to_char(check_out_date,'YYYY-MM')=$1 AND checkout_confirmed_at IS NULL`, [m])).rows[0].c;
    res.json({ month: m, pendingCheckin: ci, pendingCheckout: co, pending: ci + co });
  } catch (e) { next(e); }
});

// Bảo trì xác nhận ĐÃ NHẬN phòng (bàn giao phòng cho HV)
router.post('/handovers/:id/checkin', async (req, res, next) => {
  try {
    const note = (req.body.note || '').trim();
    const { rows } = await query(
      `UPDATE students SET checkin_confirmed_at=now(), checkin_confirm_note=$1
       WHERE id=$2 AND deleted_at IS NULL RETURNING id`, [note, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy học viên' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Bảo trì xác nhận ĐÃ TRẢ phòng (kiểm tài sản, thu chìa khóa) — ghi ngày thực tế, cập nhật để tính phiếu đúng
router.post('/handovers/:id/checkout', async (req, res, next) => {
  try {
    const note = (req.body.note || '').trim();
    const actual = /^\d{4}-\d{2}-\d{2}$/.test(req.body.actual_date) ? req.body.actual_date : null;
    if (!actual) return res.status(400).json({ error: 'Chọn ngày trả phòng thực tế' });
    const today = new Date().toISOString().slice(0, 10);
    const status = actual <= today ? 'out' : 'in';
    const { rows } = await query(
      `UPDATE students SET checkout_confirmed_at=now(), checkout_actual_date=$1, checkout_confirm_note=$2,
         check_out_date=$1, status=$3
       WHERE id=$4 AND deleted_at IS NULL RETURNING id, room_id`, [actual, note, status, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy học viên' });
    // Ghi log ra + tính lại phiếu báo tháng trả phòng theo số ngày ở thực tế
    try { await query(`INSERT INTO logs (student_id, type, date, room_id, note, source) VALUES ($1,'out',$2,$3,$4,'admin')`,
      [req.params.id, actual, rows[0].room_id || null, 'Bảo trì xác nhận trả phòng thực tế']); } catch (e) {}
    try { await recalcInvoice(req.params.id, actual.slice(0, 7)); } catch (e) {}
    res.json({ ok: true, actual_date: actual });
  } catch (e) { next(e); }
});

// Danh sách công việc bảo trì (báo hư hỏng đã được admin chuyển)
router.get('/tasks', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT d.*, s.name AS student_name, s.phone AS student_phone, r.name AS room_name
      FROM damage_reports d
      LEFT JOIN students s ON s.id = d.student_id
      LEFT JOIN rooms r ON r.id = d.room_id
      WHERE d.category='damage' AND d.assigned_at IS NOT NULL
      ORDER BY (d.status<>'done') DESC, d.assigned_at DESC`);
    res.json(rows);
  } catch (e) { next(e); }
});

// Số việc cần xử lý (cho thông báo)
router.get('/summary', async (req, res, next) => {
  try {
    const n = (await query(
      `SELECT COUNT(*)::int c FROM damage_reports WHERE category='damage' AND assigned_at IS NOT NULL AND status<>'done'`)).rows[0].c;
    res.json({ pending: n });
  } catch (e) { next(e); }
});

// Bảo trì cập nhật tiến độ: đang xử lý / chưa xử lý được (kèm lý do) / đã xong (kèm ghi chú)
router.post('/tasks/:id/status', async (req, res, next) => {
  try {
    const status = ['processing', 'blocked', 'done'].includes(req.body.status) ? req.body.status : 'processing';
    const note = (req.body.note || '').trim();
    if (status === 'blocked' && !note) return res.status(400).json({ error: 'Nhập lý do chưa xử lý được' });
    const { rows } = await query(
      `UPDATE damage_reports SET status=$1, admin_note=$2, resolved_at=$3
       WHERE id=$4 AND category='damage' AND assigned_at IS NOT NULL RETURNING *`,
      [status, note, status === 'done' ? new Date().toISOString() : null, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy công việc' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
