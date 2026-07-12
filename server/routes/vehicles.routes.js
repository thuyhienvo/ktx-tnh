const express = require('express');
const { query } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin', 'staff'));

// Danh sách xe (kèm thông tin học viên + phòng + trạng thái ở)
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT v.*, s.name AS student_name, s.status AS student_status, s.check_out_date,
        r.name AS room_name, r.gender AS room_gender
      FROM vehicles v
      JOIN students s ON s.id = v.student_id
      LEFT JOIN rooms r ON r.id = s.room_id
      ORDER BY r.name, s.name`);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { student_id, plate, vehicle_type, sticker, note } = req.body;
    if (!student_id) return res.status(400).json({ error: 'Thiếu học viên' });
    const { rows } = await query(
      `INSERT INTO vehicles (student_id, plate, vehicle_type, sticker, note) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [student_id, plate || '', vehicle_type || '', sticker || '', note || '']
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { plate, vehicle_type, sticker, note } = req.body;
    const { rows } = await query(
      `UPDATE vehicles SET plate=$1, vehicle_type=$2, sticker=$3, note=$4 WHERE id=$5 RETURNING *`,
      [plate || '', vehicle_type || '', sticker || '', note || '', req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy xe' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try { await query('DELETE FROM vehicles WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { next(e); }
});

module.exports = router;
