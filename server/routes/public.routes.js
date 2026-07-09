const express = require('express');
const { query, getSettings } = require('../db');

const router = express.Router(); // KHÔNG yêu cầu đăng nhập

// Thông tin KTX + đơn giá (để hiển thị trên trang đăng ký)
router.get('/info', async (req, res, next) => {
  try {
    const s = await getSettings();
    res.json({ dorm_name: s.dorm_name, room_fee: s.room_fee, deposit_fee: s.deposit_fee, washing_fee: s.washing_fee, parking_fee: s.parking_fee });
  } catch (e) { next(e); }
});

// Thống kê nhanh cho màn hình đăng nhập
router.get('/stats', async (req, res, next) => {
  try {
    const rooms = (await query('SELECT COUNT(*)::int c FROM rooms')).rows[0].c;
    const students = (await query('SELECT COUNT(*)::int c FROM students')).rows[0].c;
    res.json({ rooms, students, zones: 2 });
  } catch (e) { next(e); }
});

// Phòng còn trống (số slot trống > 0) để học viên tham khảo
router.get('/available-rooms', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT r.name, r.floor, r.gender, r.hang, r.capacity,
        (SELECT COUNT(*) FROM students s WHERE s.room_id=r.id
           AND s.check_in_date <= CURRENT_DATE AND (s.check_out_date IS NULL OR s.check_out_date > CURRENT_DATE))::int AS occupancy
      FROM rooms r ORDER BY r.floor, r.name`);
    const avail = rows.map(r => ({ ...r, free: Math.max(0, (r.capacity || 0) - r.occupancy) })).filter(r => r.free > 0);
    res.json(avail);
  } catch (e) { next(e); }
});

// Gửi đơn đăng ký
router.post('/apply', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.name || !b.name.trim()) return res.status(400).json({ error: 'Vui lòng nhập họ tên' });
    if (!b.phone || !b.phone.trim()) return res.status(400).json({ error: 'Vui lòng nhập số điện thoại' });
    const { rows } = await query(
      `INSERT INTO applications (name, phone, gender, birth_date, code, class_name, rental_type, pref, note, wants_washing, wants_parking, plate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [b.name.trim(), b.phone.trim(), b.gender === 'male' ? 'male' : 'female', b.birth_date || null,
       b.code || '', b.class_name || '', b.rental_type === 'phong' ? 'phong' : 'ghep', b.pref || '', b.note || '',
       !!b.wants_washing, !!b.wants_parking, b.plate || '']
    );
    res.status(201).json({ ok: true, id: rows[0].id });
  } catch (e) { next(e); }
});

module.exports = router;
