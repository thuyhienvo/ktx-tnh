const express = require('express');
const { query } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const storage = require('../storage');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

const MEDIA_KEYS = ['hero', 'khuon-vien-1', 'khuon-vien-2', 'khuon-vien-3', 'phong-1', 'phong-2', 'phong-3'];

// Danh sách khóa + đã có ảnh upload chưa
router.get('/', async (req, res, next) => {
  try {
    const rows = (await query('SELECT key, updated_at FROM media')).rows;
    const set = {}; rows.forEach(r => { set[r.key] = r.updated_at; });
    res.json(MEDIA_KEYS.map(key => ({ key, uploaded: !!set[key], updated_at: set[key] || null })));
  } catch (e) { next(e); }
});

// Upload / thay ảnh (nhận base64 data URL, lưu lên Supabase Storage bucket công khai)
router.post('/:key', async (req, res, next) => {
  try {
    const key = req.params.key;
    if (!MEDIA_KEYS.includes(key)) return res.status(400).json({ error: 'Khóa ảnh không hợp lệ' });
    const data = req.body.data || '';
    if (!/^data:image\/[\w.+-]+;base64,/.test(data)) return res.status(400).json({ error: 'Ảnh không hợp lệ' });
    if (data.length > 8 * 1024 * 1024) return res.status(400).json({ error: 'Ảnh quá lớn (tối đa ~6MB)' });

    if (storage.enabled) {
      const p = storage.parseDataUrl(data);
      const path = `${key}.${p ? p.ext : 'jpg'}`;
      await storage.uploadDataUrl(storage.INTRO_BUCKET, path, data);
      await query(
        `INSERT INTO media (key, path, data, updated_at) VALUES ($1,$2,NULL,now())
         ON CONFLICT (key) DO UPDATE SET path=EXCLUDED.path, data=NULL, updated_at=now()`,
        [key, path]
      );
    } else {
      // fallback local (không có Storage): lưu base64 vào DB như cũ
      await query(
        `INSERT INTO media (key, data, updated_at) VALUES ($1,$2,now())
         ON CONFLICT (key) DO UPDATE SET data=EXCLUDED.data, updated_at=now()`,
        [key, data]
      );
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Xóa ảnh upload (trở về placeholder / file nếu có)
router.delete('/:key', async (req, res, next) => {
  try {
    const key = req.params.key;
    const row = (await query('SELECT path FROM media WHERE key=$1', [key])).rows[0];
    if (row && row.path && storage.enabled) { try { await storage.remove(storage.INTRO_BUCKET, row.path); } catch (e) {} }
    await query('DELETE FROM media WHERE key=$1', [key]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
