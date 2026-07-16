const express = require('express');
const { query, pool, getSettings } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const billing = require('../billing');
const { recalcInvoice, roomRoster, studentElectric } = require('../invoice-calc');
const roomLeaders = require('../room-leaders');
const { isValidMonth } = require('../valid');

const router = express.Router();
router.use(requireAuth, requireRole('admin', 'staff'));

// Mọi khoản tiền phải là số KHÔNG ÂM. Ô nhập có min=0 nhưng đó chỉ là thuộc tính HTML —
// gọi thẳng API thì room_charge=-99999999 vẫn lọt, kéo tụt doanh thu năm.
const MONEY_FIELDS = ['room_charge', 'electric_charge', 'water_charge', 'service_charge', 'washing_charge', 'parking_charge', 'other_charge', 'electric_kwh', 'days_stayed'];
function badMoney(b) {
  for (const k of MONEY_FIELDS) {
    if (b[k] === undefined || b[k] === null || b[k] === '') continue;
    const n = Number(b[k]);
    if (!Number.isFinite(n)) return `"${k}" phải là số (đang nhận: "${b[k]}")`;
    if (n < 0) return `"${k}" không được âm (đang nhận: ${n})`;
  }
  return null;
}

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
    // isValidMonth chứ không chỉ "!month": trước đây "xin-chao" làm sập 500 ở month.split('-'),
    // còn "9999-12" thì LƯU THẬT cả loạt phiếu rồi "9999" nhảy vào ô chọn năm của báo cáo (V2-69).
    if (!isValidMonth(month)) return res.status(400).json({ error: 'Kỳ (tháng) không hợp lệ — chọn dạng YYYY-MM.' });
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
      `SELECT id, room_id, rental_type, check_in_date, check_out_date, uses_washing, uses_parking, room_fee_discount_pct
       FROM students
       WHERE deleted_at IS NULL AND check_in_date IS NOT NULL AND check_in_date <= $1
         AND (check_out_date IS NULL OR check_out_date >= $2)`,
      [mEnd, mStart]
    )).rows;

    // Chỉ số điện theo phòng
    const er = (await client.query('SELECT room_id, reading_start, reading_end, kwh FROM electric_readings WHERE month=$1', [month])).rows;
    const kwhByRoom = {}; er.forEach(r => { kwhByRoom[r.room_id] = Number(r.kwh); });

    // ---- TIỀN ĐIỆN TỪNG NGƯỜI: cắt chặng theo các lần chốt chỉ số giữa kỳ, cộng qua MỌI phòng họ ở ----
    // Hai chỗ cách cũ tính sai, cùng vì chỉ nhìn students.room_id (phòng HIỆN TẠI):
    //   1) người chuyển phòng giữa tháng -> phần điện ở phòng CŨ rơi mất, không ai trả;
    //   2) người ở lại phòng cũ -> gánh thay phần đó.
    const readsByRoom = {};
    (await client.query('SELECT room_id, read_date AS date, reading FROM meter_reads WHERE read_date >= $1 AND read_date <= $2 ORDER BY read_date', [mStart, mEnd]))
      .rows.forEach(r => { (readsByRoom[r.room_id] = readsByRoom[r.room_id] || []).push(r); });
    const staysByRoom = {};
    (await client.query(
      `SELECT rs.room_id, rs.student_id, rs.from_date AS from, rs.to_date AS to
         FROM room_stays rs JOIN students s ON s.id = rs.student_id
        WHERE s.deleted_at IS NULL AND rs.from_date <= $1 AND (rs.to_date IS NULL OR rs.to_date >= $2)`, [mEnd, mStart]))
      .rows.forEach(r => { (staysByRoom[r.room_id] = staysByRoom[r.room_id] || []).push(r); });

    const unit = Number(fees.electric_unit);
    const elecByStudent = {};
    for (const e of er) {
      const stays = staysByRoom[e.room_id];
      if (!stays || !stays.length) continue;
      const segs = billing.buildSegments({ month, startReading: e.reading_start, endReading: e.reading_end, reads: readsByRoom[e.room_id] || [], stays });
      const share = billing.splitElectricExact(segs.map(s => ({ electric: Number(s.kwh || 0) * unit, roster: s.roster })));
      // Ở phòng có chỉ số nhưng phần chia = 0 -> vẫn phải ghi 0, đừng để rơi về cách tính cũ
      stays.forEach(st => { if (elecByStudent[st.student_id] == null) elecByStudent[st.student_id] = 0; });
      for (const id of Object.keys(share)) elecByStudent[id] = (elecByStudent[id] || 0) + share[id];
    }

    // Danh sách người ở mỗi phòng KÈM SỐ NGÀY Ở (để chia điện theo ngày ở thực tế).
    // Trước đây chỉ đếm đầu người -> ai ở 1 ngày cũng gánh 1 suất điện như người ở cả tháng.
    const rosterByRoom = {};
    students.forEach(s => {
      if (!s.room_id) return;
      const d = billing.daysStayedInMonth(s, month);
      if (d > 0) (rosterByRoom[s.room_id] = rosterByRoom[s.room_id] || []).push({ student_id: s.id, days: d });
    });

    // Cache thông tin phòng
    const rooms = {};
    (await client.query('SELECT id, hang, monthly_fee, capacity FROM rooms')).rows.forEach(r => { rooms[r.id] = r; });

    // Số xe theo học viên (để tính phí gửi xe)
    const vehByStudent = {};
    (await client.query('SELECT student_id, COUNT(*)::int c FROM vehicles WHERE deleted_at IS NULL GROUP BY student_id')).rows
      .forEach(v => { vehByStudent[v.student_id] = v.c; });

    // Số ngày làm PHÒNG TRƯỞNG trong kỳ, nạp 1 lần cho cả kỳ (đừng hỏi CSDL từng học viên một).
    // Cộng qua mọi nhiệm kỳ vì một người có thể làm trưởng 2 đoạn rời nhau trong cùng tháng.
    const leaderDaysByStudent = {};
    (await client.query(
      `SELECT student_id, from_date, to_date FROM room_leaders
        WHERE from_date <= $1 AND (to_date IS NULL OR to_date >= $2)`, [mEnd, mStart]))
      .rows.forEach(r => {
        const d = billing.daysStayedInRange(
          { check_in_date: String(r.from_date).slice(0, 10), check_out_date: r.to_date ? String(r.to_date).slice(0, 10) : null },
          mStart, mEnd);
        leaderDaysByStudent[r.student_id] = (leaderDaysByStudent[r.student_id] || 0) + d;
      });

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
        roster: s.room_id ? (rosterByRoom[s.room_id] || []) : [],
        electricCharge: elecByStudent[s.id] != null ? elecByStudent[s.id] : null,
        leaderDays: leaderDaysByStudent[s.id] || 0,
        kwh: s.room_id ? (kwhByRoom[s.room_id] || 0) : 0,
        vehicleCount: vehByStudent[s.id] || 0,
      });

      if (dup) {
        const other = Number(dup.other_charge) || 0;
        const total = inv.room_charge + inv.electric_charge + inv.water_charge + inv.service_charge + inv.washing_charge
          + inv.parking_charge + other - inv.leader_discount - inv.room_discount;
        await client.query(
          `UPDATE invoices SET days_stayed=$1, room_charge=$2, electric_kwh=$3, electric_charge=$4, water_charge=$5,
             service_charge=$6, washing_charge=$7, parking_charge=$8, leader_discount=$9, room_discount=$10,
             total=$11, deleted_at=NULL WHERE id=$12`,
          [inv.days_stayed, inv.room_charge, inv.electric_kwh, inv.electric_charge, inv.water_charge,
           inv.service_charge, inv.washing_charge, inv.parking_charge, inv.leader_discount, inv.room_discount, total, dup.id]
        );
        updated++;
      } else {
        await client.query(
          `INSERT INTO invoices (student_id, room_id, month, days_stayed, room_charge, electric_kwh, electric_charge,
             water_charge, service_charge, washing_charge, parking_charge, leader_discount, room_discount, other_charge, total, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pending')`,
          [s.id, s.room_id, month, inv.days_stayed, inv.room_charge, inv.electric_kwh, inv.electric_charge,
           inv.water_charge, inv.service_charge, inv.washing_charge, inv.parking_charge,
           inv.leader_discount, inv.room_discount, inv.other_charge, inv.total]
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
    if (!student_id) return res.status(400).json({ error: 'Thiếu học viên' });
    if (!isValidMonth(month)) return res.status(400).json({ error: 'Kỳ (tháng) không hợp lệ — chọn dạng YYYY-MM.' });
    const fees = await getSettings();
    const s = (await query('SELECT * FROM students WHERE id=$1', [student_id])).rows[0];
    if (!s) return res.status(404).json({ error: 'Không tìm thấy học viên' });
    const dup = (await query('SELECT id, status, other_charge FROM invoices WHERE student_id=$1 AND month=$2', [student_id, month])).rows[0];
    if (dup && dup.status === 'paid') return res.status(400).json({ error: 'Hóa đơn kỳ này đã đóng — không sửa' });

    const room = s.room_id ? (await query('SELECT * FROM rooms WHERE id=$1', [s.room_id])).rows[0] : null;
    // Danh sách người ở phòng kèm số ngày ở -> chia điện theo ngày ở thực tế
    const roster = await roomRoster(s.room_id, month);
    const kwhRow = s.room_id ? (await query('SELECT kwh FROM electric_readings WHERE room_id=$1 AND month=$2', [s.room_id, month])).rows[0] : null;
    const vehicleCount = (await query('SELECT COUNT(*)::int c FROM vehicles WHERE student_id=$1 AND deleted_at IS NULL', [student_id])).rows[0].c;
    // Cộng phần điện ở MỌI phòng HV ở trong tháng (chuyển phòng giữa tháng vẫn tính đủ)
    const electricCharge = await studentElectric(student_id, month, Number(fees.electric_unit));
    const leaderDays = await roomLeaders.leaderDaysInMonth(null, student_id, month);

    const inv = billing.computeInvoice({ student: s, room, month, fees, roster, electricCharge, leaderDays, kwh: kwhRow ? Number(kwhRow.kwh) : 0, vehicleCount });
    let row;
    if (dup) {
      const other = Number(dup.other_charge) || 0;
      const total = inv.room_charge + inv.electric_charge + inv.water_charge + inv.service_charge + inv.washing_charge
        + inv.parking_charge + other - inv.leader_discount - inv.room_discount;
      row = (await query(
        `UPDATE invoices SET days_stayed=$1, room_charge=$2, electric_kwh=$3, electric_charge=$4, water_charge=$5,
           service_charge=$6, washing_charge=$7, parking_charge=$8, leader_discount=$9, room_discount=$10,
           total=$11, deleted_at=NULL WHERE id=$12 RETURNING *`,
        [inv.days_stayed, inv.room_charge, inv.electric_kwh, inv.electric_charge, inv.water_charge,
         inv.service_charge, inv.washing_charge, inv.parking_charge, inv.leader_discount, inv.room_discount, total, dup.id])).rows[0];
    } else {
      row = (await query(
        `INSERT INTO invoices (student_id, room_id, month, days_stayed, room_charge, electric_kwh, electric_charge,
           water_charge, service_charge, washing_charge, parking_charge, leader_discount, room_discount, other_charge, total, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pending') RETURNING *`,
        [student_id, s.room_id, month, inv.days_stayed, inv.room_charge, inv.electric_kwh, inv.electric_charge,
         inv.water_charge, inv.service_charge, inv.washing_charge, inv.parking_charge,
         inv.leader_discount, inv.room_discount, inv.other_charge, inv.total])).rows[0];
    }
    res.json({ ok: true, invoice: row, created: !dup });
  } catch (e) { next(e); }
});

// Hóa đơn lẻ (nhập tay từng khoản)
router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.student_id || !b.month) return res.status(400).json({ error: 'Thiếu học viên hoặc kỳ' });
    // Kỳ phải có thật (chặn "2026-13", "xyz" -> làm hỏng ràng buộc 1-HV-1-phiếu-mỗi-kỳ và báo cáo năm)
    if (!isValidMonth(b.month)) return res.status(400).json({ error: `Kỳ không hợp lệ: "${b.month}". Định dạng đúng: YYYY-MM (tháng 01–12).` });
    const neg = badMoney(b);
    if (neg) return res.status(400).json({ error: neg });
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
    const neg = badMoney(b);
    if (neg) return res.status(400).json({ error: neg });
    // KHÓA hoá đơn đã thu tiền: số đã chốt với Bravo không được sửa sau lưng
    const cur = (await query('SELECT status FROM invoices WHERE id=$1 AND deleted_at IS NULL', [req.params.id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'Không tìm thấy hóa đơn' });
    if (cur.status === 'paid') return res.status(400).json({ error: 'Hoá đơn đã thu tiền — không sửa được. Nếu cần điều chỉnh, chuyển trạng thái về "chưa thu" trước (thao tác này được ghi nhật ký).' });
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

// Đánh dấu đã thu hàng loạt — CHỈ cho ĐÚNG MỘT KỲ, chỉ admin, bắt buộc xác nhận.
// Trước đây: bỏ trống month = đánh dấu đã thu TOÀN BỘ mọi kỳ, mọi HV, không hoàn tác (nhân viên cũng gọi được).
// Không có màn hình nào dùng chức năng này; giữ lại nhưng khoá chặt.
router.post('/mark-paid', requireRole('admin'), async (req, res, next) => {
  try {
    const month = String(req.body.month || '');
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Phải chọn đúng một kỳ (dạng YYYY-MM). Không cho phép đánh dấu đã thu cho toàn bộ các kỳ.' });
    }
    if (req.body.confirm !== true) {
      const n = (await query(`SELECT COUNT(*)::int c FROM invoices WHERE month=$1 AND status<>'paid' AND deleted_at IS NULL`, [month])).rows[0].c;
      return res.status(400).json({ error: `Thao tác này sẽ đánh dấu ĐÃ THU cho ${n} phiếu của kỳ ${month} và KHÔNG hoàn tác được. Gửi lại kèm "confirm": true nếu chắc chắn.`, would_update: n, month });
    }
    const date = new Date().toISOString().slice(0, 10);
    const r = await query(
      `UPDATE invoices SET status='paid', paid_date=$1 WHERE month=$2 AND status<>'paid' AND deleted_at IS NULL RETURNING id`, [date, month]);
    res.json({ ok: true, updated: r.rows.length, month });
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
