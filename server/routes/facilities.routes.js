const express = require('express');
const { query } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT f.*,
        (SELECT COUNT(*) FROM rooms r WHERE r.facility_id=f.id AND r.deleted_at IS NULL)::int AS room_count
      FROM facilities f WHERE f.deleted_at IS NULL ORDER BY f.id`);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { name, address } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nhập tên cơ sở' });
    const { rows } = await query('INSERT INTO facilities (name, address) VALUES ($1,$2) RETURNING *',
      [name.trim(), address || '']);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { name, address } = req.body;
    const { rows } = await query('UPDATE facilities SET name=$1, address=$2 WHERE id=$3 RETURNING *',
      [name.trim(), address || '', req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy cơ sở' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const c = await query('SELECT COUNT(*)::int c FROM rooms WHERE facility_id=$1 AND deleted_at IS NULL', [req.params.id]);
    if (c.rows[0].c > 0) return res.status(400).json({ error: 'Cơ sở đang có phòng, không thể xóa' });
    await query('UPDATE facilities SET deleted_at=now() WHERE id=$1', [req.params.id]); // xóa mềm
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
