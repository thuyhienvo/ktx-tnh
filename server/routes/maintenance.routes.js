const express = require('express');
const { query } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();
router.use(requireAuth, requireRole('maintenance', 'admin'));

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

// Bảo trì cập nhật tiến độ: đang xử lý / đã xong (kèm ghi chú bảo trì)
router.post('/tasks/:id/status', async (req, res, next) => {
  try {
    const status = ['processing', 'done'].includes(req.body.status) ? req.body.status : 'processing';
    const { rows } = await query(
      `UPDATE damage_reports SET status=$1, admin_note=$2, resolved_at=$3
       WHERE id=$4 AND category='damage' AND assigned_at IS NOT NULL RETURNING *`,
      [status, req.body.note || '', status === 'done' ? new Date().toISOString() : null, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy công việc' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
