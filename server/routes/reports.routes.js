const express = require('express');
const { query } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

// Doanh thu theo tháng, tách từng dịch vụ. ?year=YYYY (mặc định: tất cả)
router.get('/revenue', async (req, res, next) => {
  try {
    const year = req.query.year;
    const params = [];
    let where = 'WHERE deleted_at IS NULL';
    if (year) { params.push(year + '-%'); where += ' AND month LIKE $1'; }
    const { rows } = await query(`
      SELECT month,
        COALESCE(SUM(room_charge),0) AS room,
        COALESCE(SUM(electric_charge),0) AS electric,
        COALESCE(SUM(water_charge),0) AS water,
        COALESCE(SUM(service_charge),0) AS service,
        COALESCE(SUM(washing_charge),0) AS washing,
        COALESCE(SUM(parking_charge),0) AS parking,
        COALESCE(SUM(other_charge),0) AS other,
        COALESCE(SUM(total),0) AS total,
        COUNT(*)::int AS count
      FROM invoices ${where}
      GROUP BY month ORDER BY month`, params);
    res.json(rows);
  } catch (e) { next(e); }
});

// Các năm có dữ liệu hóa đơn
router.get('/years', async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT DISTINCT substr(month,1,4) AS y FROM invoices WHERE deleted_at IS NULL ORDER BY y DESC`);
    res.json(rows.map(r => r.y));
  } catch (e) { next(e); }
});

module.exports = router;
