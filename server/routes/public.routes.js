const express = require('express');
const fs = require('fs');
const path = require('path');
const { query, getSettings } = require('../db');

const router = express.Router(); // KHÔNG yêu cầu đăng nhập

// Danh sách khóa ảnh hợp lệ của trang giới thiệu
const MEDIA_KEYS = ['hero', 'khuon-vien-1', 'khuon-vien-2', 'khuon-vien-3', 'phong-1', 'phong-2', 'phong-3'];

// Phục vụ ảnh khu nội trú: ưu tiên ảnh upload (CSDL) -> file trong /public/images -> 404
router.get('/image/:key', async (req, res, next) => {
  try {
    const key = req.params.key;
    if (!MEDIA_KEYS.includes(key)) return res.status(404).end();
    const row = (await query('SELECT data FROM media WHERE key=$1', [key])).rows[0];
    if (row && row.data) {
      const m = /^data:(image\/[\w.+-]+);base64,(.+)$/s.exec(row.data);
      if (m) {
        res.set('Content-Type', m[1]);
        res.set('Cache-Control', 'no-cache');
        return res.send(Buffer.from(m[2], 'base64'));
      }
    }
    const file = path.join(__dirname, '..', '..', 'public', 'images', key + '.jpg');
    if (fs.existsSync(file)) return res.sendFile(file);
    return res.status(404).end();
  } catch (e) { next(e); }
});

// Thông tin KTX + đơn giá (để hiển thị trên trang đăng ký)
router.get('/info', async (req, res, next) => {
  try {
    const s = await getSettings();
    const facilities = (await query('SELECT id, name, address FROM facilities ORDER BY id')).rows;
    const fac = facilities[0] || {};
    const rooms = (await query('SELECT COUNT(*)::int c FROM rooms')).rows[0].c;
    const occupancy = (await query(
      `SELECT COUNT(*)::int c FROM students s
       WHERE s.check_in_date <= CURRENT_DATE AND (s.check_out_date IS NULL OR s.check_out_date > CURRENT_DATE)`)).rows[0].c;
    const beds = (await query('SELECT COALESCE(SUM(capacity),0)::int c FROM rooms')).rows[0].c;
    res.json({
      dorm_name: s.dorm_name, hotline: s.hotline,
      address: fac.address || '', facility_name: fac.name || '',
      facilities: facilities.map(f => ({ id: f.id, name: f.name, address: f.address })),
      room_count: rooms, bed_count: beds, occupancy, bed_free: Math.max(0, beds - occupancy),
      room_fee: s.room_fee, deposit_fee: s.deposit_fee,
      electric_unit: s.electric_unit, water_fee: s.water_fee, service_fee: s.service_fee,
      washing_fee: s.washing_fee, parking_fee: s.parking_fee,
      intro_hero_title: s.intro_hero_title, intro_hero_desc: s.intro_hero_desc,
      intro_about_eyebrow: s.intro_about_eyebrow, intro_about_title: s.intro_about_title, intro_about_desc: s.intro_about_desc,
      intro_rooms_eyebrow: s.intro_rooms_eyebrow, intro_rooms_title: s.intro_rooms_title, intro_rooms_desc: s.intro_rooms_desc,
      intro_amenities_title: s.intro_amenities_title,
      intro_price_title: s.intro_price_title, intro_price_desc: s.intro_price_desc,
      intro_contact_title: s.intro_contact_title, intro_contact_desc: s.intro_contact_desc,
      'imgcap_khuon-vien-1': s['imgcap_khuon-vien-1'], 'imgcap_khuon-vien-2': s['imgcap_khuon-vien-2'], 'imgcap_khuon-vien-3': s['imgcap_khuon-vien-3'],
      'imgcap_phong-1': s['imgcap_phong-1'], 'imgcap_phong-2': s['imgcap_phong-2'], 'imgcap_phong-3': s['imgcap_phong-3'],
    });
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
      `INSERT INTO applications (name, phone, gender, birth_date, code, class_name, rental_type, pref, note, wants_washing, wants_parking, plate, cccd_front, cccd_back, facility_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [b.name.trim(), b.phone.trim(), b.gender === 'male' ? 'male' : 'female', b.birth_date || null,
       b.code || '', b.class_name || '', b.rental_type === 'phong' ? 'phong' : 'ghep', b.pref || '', b.note || '',
       !!b.wants_washing, !!b.wants_parking, b.plate || '', b.cccd_front || null, b.cccd_back || null, +b.facility_id || null]
    );
    res.status(201).json({ ok: true, id: rows[0].id });
  } catch (e) { next(e); }
});

module.exports = router;
