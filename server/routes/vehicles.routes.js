const express = require('express');
const { query } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin', 'staff'));

// Chuẩn hoá biển số để so trùng: bỏ mọi ký tự không phải chữ/số, viết hoa.
// "63-B4 508.58" và "63B450858" là CÙNG một xe -> phải nhận ra là trùng (V2-22).
const chuanBien = p => String(p || '').toUpperCase().replace(/[^0-9A-Z]/g, '');

// Danh sách xe (kèm thông tin học viên + phòng + trạng thái ở)
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT v.*, s.name AS student_name, s.status AS student_status, s.check_out_date,
        r.name AS room_name, r.gender AS room_gender
      FROM vehicles v
      JOIN students s ON s.id = v.student_id
      LEFT JOIN rooms r ON r.id = s.room_id
      WHERE v.deleted_at IS NULL AND s.deleted_at IS NULL
      ORDER BY r.name, s.name`);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { student_id, plate, vehicle_type, sticker, note } = req.body;
    const sid = +student_id;
    if (!sid) return res.status(400).json({ error: 'Thiếu học viên' });
    // Học viên phải TỒN TẠI + chưa xoá. Trước đây student_id=99999 hoặc "abc" -> FK ném 23503 -> 500;
    // giờ báo 400 có nghĩa (V2-25).
    const st = (await query('SELECT id FROM students WHERE id=$1 AND deleted_at IS NULL', [sid])).rows[0];
    if (!st) return res.status(400).json({ error: 'Học viên không tồn tại hoặc đã xoá' });
    // Biển số BẮT BUỘC — không cho biển rỗng (biển rỗng lọt qua unique index, nhân phí gửi xe
    // tuỳ ý: 10 xe biển rỗng = +1.000.000đ/tháng) (V2-21).
    if (!plate || !plate.trim()) return res.status(400).json({ error: 'Biển số xe là bắt buộc' });
    // Trùng biển (kể cả khác format dấu chấm/gạch) -> 400 có nghĩa thay vì 500 do unique index (V2-22).
    const bien = chuanBien(plate);
    const trung = await query(
      `SELECT s.name FROM vehicles v JOIN students s ON s.id=v.student_id
        WHERE v.deleted_at IS NULL AND regexp_replace(upper(v.plate),'[^0-9A-Z]','','g') = $1`, [bien]);
    if (trung.rows.length) return res.status(400).json({ error: `Biển số này đã đăng ký cho học viên ${trung.rows[0].name}` });
    try {
      const { rows } = await query(
        `INSERT INTO vehicles (student_id, plate, vehicle_type, sticker, note, from_date) VALUES ($1,$2,$3,$4,$5,CURRENT_DATE) RETURNING *`,
        [sid, plate.trim(), vehicle_type || '', sticker || '', note || '']
      );
      res.status(201).json(rows[0]);
    } catch (e) {
      if (e.code === '23505') return res.status(400).json({ error: 'Biển số này đã tồn tại' });
      throw e;
    }
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body;
    // Chỉ đổi field CÓ gửi lên (COALESCE) — trước đây sửa mỗi "loại xe" cũng ghi đè biển số + mã
    // dán về rỗng vì luôn ghi cả 4 cột (V2-25).
    if (b.plate != null && !String(b.plate).trim()) return res.status(400).json({ error: 'Biển số không được để trống' });
    if (b.plate != null) {
      const bien = chuanBien(b.plate);
      const trung = await query(
        `SELECT s.name FROM vehicles v JOIN students s ON s.id=v.student_id
          WHERE v.deleted_at IS NULL AND v.id<>$2 AND regexp_replace(upper(v.plate),'[^0-9A-Z]','','g') = $1`, [bien, req.params.id]);
      if (trung.rows.length) return res.status(400).json({ error: `Biển số này đã đăng ký cho học viên ${trung.rows[0].name}` });
    }
    try {
      const { rows } = await query(
        `UPDATE vehicles SET
           plate = CASE WHEN $1::text IS NULL THEN plate ELSE $1 END,
           vehicle_type = CASE WHEN $2::text IS NULL THEN vehicle_type ELSE $2 END,
           sticker = CASE WHEN $3::text IS NULL THEN sticker ELSE $3 END,
           note = CASE WHEN $4::text IS NULL THEN note ELSE $4 END
         WHERE id=$5 AND deleted_at IS NULL RETURNING *`,
        [b.plate != null ? String(b.plate).trim() : null, b.vehicle_type != null ? String(b.vehicle_type) : null,
         b.sticker != null ? String(b.sticker) : null, b.note != null ? String(b.note) : null, req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy xe' });
      res.json(rows[0]);
    } catch (e) {
      if (e.code === '23505') return res.status(400).json({ error: 'Biển số này đã tồn tại' });
      throw e;
    }
  } catch (e) { next(e); }
});

// Xóa mềm — ghi to_date để hoá đơn các tháng xe còn hiệu lực vẫn tính đúng, tháng sau thì thôi.
router.delete('/:id', async (req, res, next) => {
  try { await query('UPDATE vehicles SET deleted_at=now(), to_date=CURRENT_DATE WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { next(e); }
});

module.exports = router;
