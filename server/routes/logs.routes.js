const express = require('express');
const { query } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin', 'staff'));

// Lịch sử check-in / check-out
router.get('/', async (req, res, next) => {
  try {
    const { type, limit } = req.query;
    const params = [];
    let where = '';
    if (type === 'in' || type === 'out') { params.push(type); where = 'WHERE l.type=$1'; }
    const lim = Math.min(+limit || 500, 2000);
    // Phân trang tuỳ chọn: có page/limit -> { rows, total, page, limit }, không thì trả mảng như cũ.
    const paged = req.query.page != null || req.query.limit != null;
    const baseFrom = `FROM logs l JOIN students s ON s.id = l.student_id LEFT JOIN rooms r ON r.id = l.room_id ${where}`;
    if (paged) {
      const page = Math.max(1, +req.query.page || 1);
      const total = (await query(`SELECT COUNT(*)::int c ${baseFrom}`, params)).rows[0].c;
      params.push(lim); const pL = params.length;
      params.push((page - 1) * lim); const pO = params.length;
      const { rows } = await query(
        `SELECT l.*, s.name AS student_name, r.name AS room_name ${baseFrom}
         ORDER BY l.date DESC, l.id DESC LIMIT $${pL} OFFSET $${pO}`, params);
      return res.json({ rows, total, page, limit: lim });
    }
    const { rows } = await query(`
      SELECT l.*, s.name AS student_name, r.name AS room_name
      FROM logs l
      JOIN students s ON s.id = l.student_id
      LEFT JOIN rooms r ON r.id = l.room_id
      ${where}
      ORDER BY l.date DESC, l.id DESC
      LIMIT ${lim}`, params);
    res.json(rows);
  } catch (e) { next(e); }
});

module.exports = router;
