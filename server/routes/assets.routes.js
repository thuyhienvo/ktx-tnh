const express = require('express');
const { query } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM assets WHERE deleted_at IS NULL ORDER BY category DESC, sort, id');
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { name, unit, category, quantity, fee, note } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nhập tên tài sản' });
    const { rows } = await query(
      `INSERT INTO assets (name, unit, category, quantity, fee, note) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name.trim(), unit || 'Cái', category === 'person' ? 'person' : 'fixed', +quantity || 1, +fee || 0, note || '']
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { name, unit, category, quantity, fee, note } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nhập tên tài sản' });
    const { rows } = await query(
      `UPDATE assets SET name=$1, unit=$2, category=$3, quantity=$4, fee=$5, note=$6 WHERE id=$7 RETURNING *`,
      [name.trim(), unit || 'Cái', category === 'person' ? 'person' : 'fixed', +quantity || 1, +fee || 0, note || '', req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy tài sản' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Xóa mềm
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try { await query('UPDATE assets SET deleted_at=now() WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { next(e); }
});

module.exports = router;
