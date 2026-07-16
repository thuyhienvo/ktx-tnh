const express = require('express');
const { query } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { recalcInvoice } = require('../invoice-calc');
const { isValidYmd } = require('../valid');

const router = express.Router();
router.use(requireAuth, requireRole('maintenance', 'admin'));

const curMonth = () => new Date().toISOString().slice(0, 7);
const isMonth = m => /^\d{4}-\d{2}$/.test(m || '');
// Vòng đời việc bảo trì — MỘT bộ trạng thái dùng chung. 'blocked' = chưa xử lý được (kèm lý do).
// Admin sửa ghi chú (requests.routes PUT /damage/:id) phải chấp nhận CÙNG bộ này, nếu không
// việc đang 'blocked' bị admin đụng vào là rơi về 'new', mất luôn lý do (V2-40c).
const TASK_STATUS = ['new', 'processing', 'blocked', 'done'];

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
    const cur = (await query('SELECT checkin_confirmed_at FROM students WHERE id=$1 AND deleted_at IS NULL', [req.params.id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'Không tìm thấy học viên' });
    // Xác nhận MỘT LẦN. Xác nhận lại sẽ ghi đè mốc bàn giao thật và (nếu note rỗng) xoá trắng ghi chú.
    if (cur.checkin_confirmed_at)
      return res.status(409).json({ error: 'Đã xác nhận nhận phòng trước đó — không xác nhận lại (tránh mất dấu lần bàn giao thật).' });
    await query(
      `UPDATE students SET checkin_confirmed_at=now(), checkin_confirm_note=$1
       WHERE id=$2 AND deleted_at IS NULL`, [note, req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Bảo trì xác nhận ĐÃ TRẢ phòng (kiểm tài sản, thu chìa khóa) — ghi ngày thực tế, cập nhật để tính phiếu đúng
router.post('/handovers/:id/checkout', async (req, res, next) => {
  try {
    const note = (req.body.note || '').trim();
    const actual = isValidYmd(req.body.actual_date) ? req.body.actual_date : null;
    if (!actual) return res.status(400).json({ error: 'Chọn ngày trả phòng thực tế hợp lệ' });
    const today = new Date().toISOString().slice(0, 10);
    // Đây là xác nhận ĐÃ TRẢ phòng THỰC TẾ — theo định nghĩa việc đó đã xảy ra rồi, KHÔNG thể ở
    // tương lai. Trước đây nhận ngày 2199 -> ghi vào CSDL, tính lại phiếu tháng "2199-12" (không có)
    // nên tiền không tính lại, dữ liệu một đằng tiền một nẻo.
    if (actual > today)
      return res.status(400).json({ error: 'Ngày trả phòng thực tế không thể ở tương lai.' });
    // Ngày trả không thể TRƯỚC ngày nhận phòng (tránh phiếu tính sai / âm ngày)
    const cur = (await query('SELECT check_in_date FROM students WHERE id=$1 AND deleted_at IS NULL', [req.params.id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'Không tìm thấy học viên' });
    if (cur.check_in_date && actual < String(cur.check_in_date).slice(0, 10))
      return res.status(400).json({ error: 'Ngày trả không thể trước ngày nhận phòng' });
    const { rows } = await query(
      `UPDATE students SET checkout_confirmed_at=now(), checkout_actual_date=$1, checkout_confirm_note=$2,
         check_out_date=$1, status='out'
       WHERE id=$3 AND deleted_at IS NULL RETURNING id, room_id`, [actual, note, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy học viên' });
    // source theo VAI người thực hiện — bảo trì thì ghi 'maintenance', không ghi cứng 'admin' (V2-43)
    const src = req.user && req.user.role === 'maintenance' ? 'maintenance' : 'admin';
    try { await query(`INSERT INTO logs (student_id, type, date, room_id, note, source) VALUES ($1,'out',$2,$3,$4,$5)`,
      [req.params.id, actual, rows[0].room_id || null, 'Bảo trì xác nhận trả phòng thực tế', src]); } catch (e) {}
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
    // Trạng thái LẠ (gõ sai "donee") -> BÁO LỖI, đừng lặng lẽ ép về 'processing': làm vậy thì
    // việc ĐÃ XONG bị lùi về đang xử lý và ngày hoàn thành bị xoá mà không ai biết.
    if (!TASK_STATUS.includes(req.body.status))
      return res.status(400).json({ error: `Trạng thái không hợp lệ: "${req.body.status}". Chỉ nhận: ${TASK_STATUS.join(', ')}.` });
    const status = req.body.status;
    const note = (req.body.note || '').trim();
    if (status === 'blocked' && !note) return res.status(400).json({ error: 'Nhập lý do chưa xử lý được' });
    // Ghi chú: chỉ ĐÈ khi có nhập; note rỗng -> GIỮ ghi chú cũ (trước đây luôn ghi đè -> xoá trắng).
    // resolved_at: chỉ đặt khi 'done'; rời khỏi 'done' thì xoá (đúng), nhưng vì đã chặn trạng thái lạ
    // ở trên nên việc done không bị vô cớ lùi nữa.
    const { rows } = await query(
      `UPDATE damage_reports
         SET status=$1,
             admin_note = CASE WHEN $2='' THEN admin_note ELSE $2 END,
             resolved_at = CASE WHEN $1='done' THEN now() ELSE NULL END
       WHERE id=$3 AND category='damage' AND assigned_at IS NOT NULL RETURNING *`,
      [status, note, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy công việc' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
