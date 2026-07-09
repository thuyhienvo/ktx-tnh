const express = require('express');
const { query } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

// Tháng liền trước 'YYYY-MM'
function prevMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Chỉ số điện tất cả phòng trong 1 tháng: số đầu tự lấy = số cuối tháng trước
router.get('/', async (req, res, next) => {
  try {
    const month = req.query.month;
    const pm = prevMonth(month);
    const { rows } = await query(`
      SELECT r.id AS room_id, r.name AS room_name, r.floor, r.gender,
        COALESCE(e.reading_end, 0) AS reading_end,
        COALESCE(e.reading_start, prev.reading_end, 0) AS reading_start,
        COALESCE(e.kwh, 0) AS kwh,
        (SELECT COUNT(*) FROM students s WHERE s.room_id=r.id
           AND s.check_in_date <= CURRENT_DATE AND (s.check_out_date IS NULL OR s.check_out_date > CURRENT_DATE))::int AS occupancy
      FROM rooms r
      LEFT JOIN electric_readings e ON e.room_id=r.id AND e.month=$1
      LEFT JOIN electric_readings prev ON prev.room_id=r.id AND prev.month=$2
      ORDER BY r.floor, r.name`, [month, pm]);
    res.json(rows);
  } catch (e) { next(e); }
});

// Lưu nhiều chỉ số điện cho 1 tháng (nhập số cuối; số đầu = số cuối tháng trước)
router.post('/bulk', async (req, res, next) => {
  try {
    const { month, readings } = req.body; // readings: [{room_id, reading_end}]
    if (!month || !Array.isArray(readings)) return res.status(400).json({ error: 'Thiếu dữ liệu' });
    const pm = prevMonth(month);
    for (const r of readings) {
      const prev = await query('SELECT reading_end FROM electric_readings WHERE room_id=$1 AND month=$2', [r.room_id, pm]);
      const start = r.reading_start != null ? +r.reading_start : (prev.rows[0] ? +prev.rows[0].reading_end : 0);
      const end = +r.reading_end || 0;
      const kwh = Math.max(0, end - start);
      await query(
        `INSERT INTO electric_readings (room_id, month, reading_start, reading_end, kwh) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (room_id, month) DO UPDATE SET reading_start=EXCLUDED.reading_start, reading_end=EXCLUDED.reading_end, kwh=EXCLUDED.kwh`,
        [r.room_id, month, start, end, kwh]
      );
    }
    res.json({ ok: true, saved: readings.length });
  } catch (e) { next(e); }
});

module.exports = router;
