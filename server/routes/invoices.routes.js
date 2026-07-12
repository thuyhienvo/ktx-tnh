const express = require('express');
const { query, pool, getSettings } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const billing = require('../billing');
const { recalcInvoice } = require('../invoice-calc');

const router = express.Router();
router.use(requireAuth, requireRole('admin', 'staff'));

// Tính lại 1 hóa đơn theo dữ liệu hiện tại (số ngày ở, dịch vụ...)
router.post('/:id/recalc', async (req, res, next) => {
  try {
    const inv = (await query('SELECT student_id, month FROM invoices WHERE id=$1', [req.params.id])).rows[0];
    if (!inv) return res.status(404).json({ error: 'Không tìm thấy hóa đơn' });
    const updated = await recalcInvoice(inv.student_id, inv.month);
    res.json(updated);
  } catch (e) { next(e); }
});

const SELECT = `
  SELECT i.*, s.name AS student_name, s.code AS student_code, r.name AS room_name
  FROM invoices i
  JOIN students s ON s.id = i.student_id
  LEFT JOIN rooms r ON r.id = i.room_id`;

router.get('/', async (req, res, next) => {
  try {
    const { month } = req.query;
    const rows = month
      ? (await query(`${SELECT} WHERE i.month=$1 AND i.deleted_at IS NULL ORDER BY s.name`, [month])).rows
      : (await query(`${SELECT} WHERE i.deleted_at IS NULL ORDER BY i.month DESC, s.name`)).rows;
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/months', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT DISTINCT month FROM invoices WHERE deleted_at IS NULL ORDER BY month DESC');
    res.json(rows.map(r => r.month));
  } catch (e) { next(e); }
});

// Tạo hóa đơn hàng loạt cho 1 tháng (dùng chỉ số điện + đơn giá + bộ tính tiền)
router.post('/generate', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { month, readings } = req.body;
    const preview = !!req.body.preview; // xem trước: tính rồi ROLLBACK, không ghi gì
    if (!month) return res.status(400).json({ error: 'Chọn kỳ (tháng)' });
    const fees = await getSettings();

    await client.query('BEGIN');

    // Lưu chỉ số điện công-tơ (nếu gửi kèm): nhập số cuối, số đầu = số cuối tháng trước
    if (Array.isArray(readings)) {
      const [py, pm2] = month.split('-').map(Number);
      const pd = new Date(py, pm2 - 2, 1);
      const pmonth = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}`;
      for (const r of readings) {
        const prev = await client.query('SELECT reading_end FROM electric_readings WHERE room_id=$1 AND month=$2', [r.room_id, pmonth]);
        const start = r.reading_start != null ? +r.reading_start : (prev.rows[0] ? +prev.rows[0].reading_end : 0);
        const end = +r.reading_end || 0;
        const kwh = Math.max(0, end - start);
        await client.query(
          `INSERT INTO electric_readings (room_id, month, reading_start, reading_end, kwh) VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (room_id, month) DO UPDATE SET reading_start=EXCLUDED.reading_start, reading_end=EXCLUDED.reading_end, kwh=EXCLUDED.kwh`,
          [r.room_id, month, start, end, kwh]
        );
      }
    }

    const mStart = billing.firstDay(month), mEnd = billing.lastDay(month);
    // Học viên có ở trong tháng (vào trước cuối tháng & chưa rời trước đầu tháng)
    // Chỉ lấy cột cần dùng (không kéo ảnh CCCD/base64) -> nhẹ RAM & băng thông
    const students = (await client.query(
      `SELECT id, room_id, rental_type, check_in_date, check_out_date, uses_washing, uses_parking
       FROM students
       WHERE deleted_at IS NULL AND check_in_date IS NOT NULL AND check_in_date <= $1
         AND (check_out_date IS NULL OR check_out_date >= $2)`,
      [mEnd, mStart]
    )).rows;

    // Chỉ số điện theo phòng
    const er = (await client.query('SELECT room_id, kwh FROM electric_readings WHERE month=$1', [month])).rows;
    const kwhByRoom = {}; er.forEach(r => { kwhByRoom[r.room_id] = Number(r.kwh); });

    // Số người ở mỗi phòng trong tháng (để chia điện)
    const occByRoom = {};
    students.forEach(s => { if (s.room_id) occByRoom[s.room_id] = (occByRoom[s.room_id] || 0) + 1; });

    // Cache thông tin phòng
    const rooms = {};
    (await client.query('SELECT id, hang, monthly_fee, capacity FROM rooms')).rows.forEach(r => { rooms[r.id] = r; });

    // Số xe theo học viên (để tính phí gửi xe)
    const vehByStudent = {};
    (await client.query('SELECT student_id, COUNT(*)::int c FROM vehicles WHERE deleted_at IS NULL GROUP BY student_id')).rows
      .forEach(v => { vehByStudent[v.student_id] = v.c; });

    // Nạp sẵn hóa đơn hiện có của kỳ trong 1 truy vấn (diệt N+1: trước đây mỗi HV 1 SELECT)
    const existingByStudent = {};
    (await client.query('SELECT id, student_id, status, other_charge FROM invoices WHERE month=$1', [month])).rows
      .forEach(iv => { existingByStudent[iv.student_id] = iv; });

    let created = 0, updated = 0, skipped = 0;
    for (const s of students) {
      const dup = existingByStudent[s.id];
      if (dup && dup.status === 'paid') { skipped++; continue; } // đã đóng -> khóa, không sửa

      const room = s.room_id ? rooms[s.room_id] : null;
      const inv = billing.computeInvoice({
        student: s, room, month, fees,
        occupants: s.room_id ? (occByRoom[s.room_id] || 1) : 1,
        kwh: s.room_id ? (kwhByRoom[s.room_id] || 0) : 0,
        vehicleCount: vehByStudent[s.id] || 0,
      });

      if (dup) {
        const other = Number(dup.other_charge) || 0;
        const total = inv.room_charge + inv.electric_charge + inv.water_charge + inv.service_charge + inv.washing_charge + inv.parking_charge + other;
        await client.query(
          `UPDATE invoices SET days_stayed=$1, room_charge=$2, electric_kwh=$3, electric_charge=$4, water_charge=$5,
             service_charge=$6, washing_charge=$7, parking_charge=$8, total=$9, deleted_at=NULL WHERE id=$10`,
          [inv.days_stayed, inv.room_charge, inv.electric_kwh, inv.electric_charge, inv.water_charge,
           inv.service_charge, inv.washing_charge, inv.parking_charge, total, dup.id]
        );
        updated++;
      } else {
        await client.query(
          `INSERT INTO invoices (student_id, room_id, month, days_stayed, room_charge, electric_kwh, electric_charge,
             water_charge, service_charge, washing_charge, parking_charge, other_charge, total, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending')`,
          [s.id, s.room_id, month, inv.days_stayed, inv.room_charge, inv.electric_kwh, inv.electric_charge,
           inv.water_charge, inv.service_charge, inv.washing_charge, inv.parking_charge, inv.other_charge, inv.total]
        );
        created++;
      }
    }
    if (preview) {
      await client.query('ROLLBACK'); // xem trước: không lưu gì
      return res.json({ preview: true, created, updated, skipped, total: students.length });
    }
    await client.query('COMMIT');
    res.json({ created, updated, skipped, total: students.length });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

// Tạo/cập nhật hóa đơn TỰ TÍNH cho 1 học viên (vd HV mới vào giữa tháng)
router.post('/generate-one', async (req, res, next) => {
  try {
    const { student_id, month } = req.body;
    if (!student_id || !month) return res.status(400).json({ error: 'Thiếu học viên hoặc kỳ' });
    const fees = await getSettings();
    const s = (await query('SELECT * FROM students WHERE id=$1', [student_id])).rows[0];
    if (!s) return res.status(404).json({ error: 'Không tìm thấy học viên' });
    const dup = (await query('SELECT id, status, other_charge FROM invoices WHERE student_id=$1 AND month=$2', [student_id, month])).rows[0];
    if (dup && dup.status === 'paid') return res.status(400).json({ error: 'Hóa đơn kỳ này đã đóng — không sửa' });

    const room = s.room_id ? (await query('SELECT * FROM rooms WHERE id=$1', [s.room_id])).rows[0] : null;
    const mStart = billing.firstDay(month), mEnd = billing.lastDay(month);
    let occupants = 1;
    if (s.room_id) {
      occupants = (await query(
        `SELECT COUNT(*)::int c FROM students WHERE room_id=$1 AND deleted_at IS NULL AND check_in_date IS NOT NULL AND check_in_date <= $2 AND (check_out_date IS NULL OR check_out_date >= $3)`,
        [s.room_id, mEnd, mStart])).rows[0].c || 1;
    }
    const kwhRow = s.room_id ? (await query('SELECT kwh FROM electric_readings WHERE room_id=$1 AND month=$2', [s.room_id, month])).rows[0] : null;
    const vehicleCount = (await query('SELECT COUNT(*)::int c FROM vehicles WHERE student_id=$1 AND deleted_at IS NULL', [student_id])).rows[0].c;

    const inv = billing.computeInvoice({ student: s, room, month, fees, occupants, kwh: kwhRow ? Number(kwhRow.kwh) : 0, vehicleCount });
    let row;
    if (dup) {
      const other = Number(dup.other_charge) || 0;
      const total = inv.room_charge + inv.electric_charge + inv.water_charge + inv.service_charge + inv.washing_charge + inv.parking_charge + other;
      row = (await query(
        `UPDATE invoices SET days_stayed=$1, room_charge=$2, electric_kwh=$3, electric_charge=$4, water_charge=$5,
           service_charge=$6, washing_charge=$7, parking_charge=$8, total=$9, deleted_at=NULL WHERE id=$10 RETURNING *`,
        [inv.days_stayed, inv.room_charge, inv.electric_kwh, inv.electric_charge, inv.water_charge,
         inv.service_charge, inv.washing_charge, inv.parking_charge, total, dup.id])).rows[0];
    } else {
      row = (await query(
        `INSERT INTO invoices (student_id, room_id, month, days_stayed, room_charge, electric_kwh, electric_charge,
           water_charge, service_charge, washing_charge, parking_charge, other_charge, total, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending') RETURNING *`,
        [student_id, s.room_id, month, inv.days_stayed, inv.room_charge, inv.electric_kwh, inv.electric_charge,
         inv.water_charge, inv.service_charge, inv.washing_charge, inv.parking_charge, inv.other_charge, inv.total])).rows[0];
    }
    res.json({ ok: true, invoice: row, created: !dup });
  } catch (e) { next(e); }
});

// Hóa đơn lẻ (nhập tay từng khoản)
router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.student_id || !b.month) return res.status(400).json({ error: 'Thiếu học viên hoặc kỳ' });
    const st = await query('SELECT room_id FROM students WHERE id=$1', [b.student_id]);
    const roomId = st.rows[0]?.room_id || null;
    const total = ['room_charge', 'electric_charge', 'water_charge', 'service_charge', 'washing_charge', 'parking_charge', 'other_charge']
      .reduce((a, k) => a + (+b[k] || 0), 0);
    const vals = [b.student_id, roomId, b.month, +b.days_stayed || 0, +b.room_charge || 0,
      +b.electric_kwh || 0, +b.electric_charge || 0, +b.water_charge || 0, +b.service_charge || 0,
      +b.washing_charge || 0, +b.parking_charge || 0, +b.other_charge || 0, b.other_note || '', total];

    // Đã có hóa đơn kỳ này? (kể cả bản đã xóa mềm — tránh vi phạm ràng buộc UNIQUE)
    const ex = (await query('SELECT id, deleted_at FROM invoices WHERE student_id=$1 AND month=$2', [b.student_id, b.month])).rows[0];
    if (ex && !ex.deleted_at) return res.status(400).json({ error: 'Học viên đã có hóa đơn trong kỳ này' });
    if (ex && ex.deleted_at) {
      // hồi sinh hóa đơn đã xóa mềm bằng dữ liệu mới nhập
      const { rows } = await query(
        `UPDATE invoices SET room_id=$2, days_stayed=$4, room_charge=$5, electric_kwh=$6, electric_charge=$7,
           water_charge=$8, service_charge=$9, washing_charge=$10, parking_charge=$11, other_charge=$12,
           other_note=$13, total=$14, status='pending', paid_date=NULL, deleted_at=NULL WHERE id=$15 RETURNING *`,
        [...vals, ex.id]);
      return res.status(201).json(rows[0]);
    }
    const { rows } = await query(
      `INSERT INTO invoices (student_id, room_id, month, days_stayed, room_charge, electric_kwh, electric_charge,
         water_charge, service_charge, washing_charge, parking_charge, other_charge, other_note, total, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending') RETURNING *`, vals);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'Học viên đã có hóa đơn trong kỳ này' });
    next(e);
  }
});

// Sửa hóa đơn (tính lại tổng)
router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body;
    const total = ['room_charge', 'electric_charge', 'water_charge', 'service_charge', 'washing_charge', 'parking_charge', 'other_charge']
      .reduce((a, k) => a + (+b[k] || 0), 0);
    const { rows } = await query(
      `UPDATE invoices SET days_stayed=$1, room_charge=$2, electric_kwh=$3, electric_charge=$4,
         water_charge=$5, service_charge=$6, washing_charge=$7, parking_charge=$8, other_charge=$9,
         other_note=$10, total=$11, note=$12 WHERE id=$13 RETURNING *`,
      [+b.days_stayed || 0, +b.room_charge || 0, +b.electric_kwh || 0, +b.electric_charge || 0,
       +b.water_charge || 0, +b.service_charge || 0, +b.washing_charge || 0, +b.parking_charge || 0,
       +b.other_charge || 0, b.other_note || '', total, b.note || '', req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy hóa đơn' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Đánh dấu đã thu hàng loạt (cả tháng, hoặc tất cả nếu không truyền month)
router.post('/mark-paid', async (req, res, next) => {
  try {
    const month = req.body.month;
    const date = new Date().toISOString().slice(0, 10);
    const r = month
      ? await query(`UPDATE invoices SET status='paid', paid_date=$1 WHERE month=$2 AND status<>'paid' AND deleted_at IS NULL RETURNING id`, [date, month])
      : await query(`UPDATE invoices SET status='paid', paid_date=$1 WHERE status<>'paid' AND deleted_at IS NULL RETURNING id`, [date]);
    res.json({ ok: true, updated: (r.rows ? r.rows.length : (r.rowCount || r.affectedRows || 0)) });
  } catch (e) { next(e); }
});

// Đổi trạng thái: pending | sent | paid
router.post('/:id/status', async (req, res, next) => {
  try {
    const status = ['pending', 'sent', 'paid'].includes(req.body.status) ? req.body.status : 'pending';
    const paidDate = status === 'paid' ? (req.body.date || new Date().toISOString().slice(0, 10)) : null;
    const { rows } = await query(
      `UPDATE invoices SET status=$1, paid_date=$2 WHERE id=$3 RETURNING *`,
      [status, paidDate, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy hóa đơn' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Xóa mềm (lập lại hóa đơn kỳ này sẽ hồi sinh với số liệu mới)
router.delete('/:id', async (req, res, next) => {
  try { await query('UPDATE invoices SET deleted_at=now() WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { next(e); }
});

module.exports = router;
