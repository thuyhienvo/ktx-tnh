const express = require('express');
const { query } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();
router.use(requireAuth);

// Danh sách phòng kèm số người đang ở + tên cơ sở
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT r.*, f.name AS facility_name,
        (SELECT COUNT(*) FROM students s WHERE s.room_id = r.id
           AND s.check_in_date <= CURRENT_DATE AND (s.check_out_date IS NULL OR s.check_out_date > CURRENT_DATE))::int AS occupancy,
        (SELECT COUNT(*) FROM students s WHERE s.room_id = r.id AND s.check_in_date > CURRENT_DATE)::int AS upcoming,
        (SELECT COUNT(*) FROM students s WHERE s.room_id = r.id
           AND s.check_out_date IS NOT NULL AND s.check_out_date > CURRENT_DATE)::int AS leaving
      FROM rooms r
      LEFT JOIN facilities f ON f.id = r.facility_id
      ORDER BY r.floor, r.name`);
    res.json(rows);
  } catch (e) { next(e); }
});

const HANG = h => (['A', 'B', 'C', 'D'].includes(h) ? h : 'B');

router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { facility_id, name, floor, gender, hang, capacity, monthly_fee, note } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nhập tên phòng' });
    const { rows } = await query(
      `INSERT INTO rooms (facility_id, name, floor, gender, hang, capacity, monthly_fee, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [facility_id || null, name.trim(), +floor || 1, gender === 'female' ? 'female' : 'male',
       HANG(hang), +capacity || 0, +monthly_fee || 0, note || '']
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { facility_id, name, floor, gender, hang, capacity, monthly_fee, note } = req.body;
    const { rows } = await query(
      `UPDATE rooms SET facility_id=$1, name=$2, floor=$3, gender=$4, hang=$5, capacity=$6, monthly_fee=$7, note=$8
       WHERE id=$9 RETURNING *`,
      [facility_id || null, name.trim(), +floor || 1, gender === 'female' ? 'female' : 'male',
       HANG(hang), +capacity || 0, +monthly_fee || 0, note || '', req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy phòng' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await query("SELECT COUNT(*)::int c FROM students WHERE room_id=$1 AND status='in'", [req.params.id]);
    if (rows[0].c > 0) return res.status(400).json({ error: 'Phòng đang có học viên ở, không thể xóa' });
    await query('DELETE FROM rooms WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
