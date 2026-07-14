const express = require('express');
const { query, getSettings } = require('../db');
const storage = require('../storage');
const { isValidYmd, isValidPhone } = require('../valid');

const router = express.Router(); // KHÔNG yêu cầu đăng nhập

// Danh sách khóa ảnh hợp lệ của trang giới thiệu
const MEDIA_KEYS = ['hero', 'khuon-vien-1', 'khuon-vien-2', 'khuon-vien-3', 'phong-1', 'phong-2', 'phong-3'];

// Phục vụ ảnh giới thiệu: proxy từ S3 (bucket intro) — cùng 1 cơ chế ở mọi môi trường.
// Chưa upload -> 404 (frontend tự hiện ảnh mẫu placeholder).
router.get('/image/:key', async (req, res, next) => {
  try {
    const key = req.params.key;
    if (!MEDIA_KEYS.includes(key)) return res.status(404).end();
    const row = (await query('SELECT path FROM media WHERE key=$1', [key])).rows[0];
    if (!row || !row.path) return res.status(404).end();
    const obj = await storage.getObject(storage.INTRO_BUCKET, row.path);
    res.set('Content-Type', obj.contentType || 'image/jpeg');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'public, max-age=300');
    obj.body.pipe(res);
  } catch (e) { res.status(404).end(); }
});

// Thông tin KTX + đơn giá (để hiển thị trên trang đăng ký)
router.get('/info', async (req, res, next) => {
  try {
    const s = await getSettings();
    const facilities = (await query('SELECT id, name, address FROM facilities ORDER BY id')).rows;
    const fac = facilities[0] || {};
    // Chỉ tính phòng CHO THUÊ GHÉP (bỏ nguyên phòng / an ninh / nhân viên) cho số liệu công khai
    const rooms = (await query("SELECT COUNT(*)::int c FROM rooms WHERE COALESCE(room_type,'shared')='shared' AND deleted_at IS NULL")).rows[0].c;
    const beds = (await query("SELECT COALESCE(SUM(capacity),0)::int c FROM rooms WHERE COALESCE(room_type,'shared')='shared' AND deleted_at IS NULL")).rows[0].c;
    const bedFree = (await query(
      `SELECT COALESCE(SUM(GREATEST(0, r.capacity -
          (SELECT COUNT(*) FROM students s WHERE s.room_id=r.id AND s.deleted_at IS NULL
             AND s.check_in_date<=CURRENT_DATE AND (s.check_out_date IS NULL OR s.check_out_date>CURRENT_DATE)))),0)::int c
       FROM rooms r WHERE COALESCE(r.room_type,'shared')='shared' AND r.deleted_at IS NULL`)).rows[0].c;
    const occupancy = Math.max(0, beds - bedFree);
    res.json({
      dorm_name: s.dorm_name, hotline: s.hotline,
      address: fac.address || '', facility_name: fac.name || '',
      facilities: facilities.map(f => ({ id: f.id, name: f.name, address: f.address })),
      room_count: rooms, bed_count: beds, occupancy, bed_free: bedFree,
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
      FROM rooms r WHERE COALESCE(r.room_type,'shared')='shared' AND r.deleted_at IS NULL ORDER BY r.floor, r.name`);
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
    if (!isValidPhone(b.phone)) return res.status(400).json({ error: 'Số điện thoại không hợp lệ (chỉ chữ số, 8–15 số)' });
    // Ngày sinh: phải là ngày CÓ THẬT và không ở tương lai; sai -> bỏ qua (null) thay vì lỗi 500
    const todayStr = new Date().toISOString().slice(0, 10);
    const birthDate = (isValidYmd(b.birth_date) && b.birth_date <= todayStr) ? b.birth_date : null;
    // Chèn đơn trước (chưa có ảnh) để lấy id
    const { rows } = await query(
      `INSERT INTO applications (name, phone, gender, birth_date, code, class_name, rental_type, pref, note, wants_washing, wants_parking, plate, facility_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [b.name.trim(), b.phone.trim(), b.gender === 'male' ? 'male' : 'female', birthDate,
       b.code || '', b.class_name || '', b.rental_type === 'phong' ? 'phong' : 'ghep', b.pref || '', b.note || '',
       !!b.wants_washing, !!b.wants_parking, b.plate || '', +b.facility_id || null]
    );
    const appId = rows[0].id;

    // Ảnh CCCD -> S3 (bucket riêng tư), lưu key. Bỏ qua ảnh không hợp lệ / quá lớn (chống lạm dụng).
    const upd = {};
    for (const field of ['cccd_front', 'cccd_back']) {
      const v = b[field];
      if (v && /^data:image\//.test(v) && v.length <= 8 * 1024 * 1024) {
        const p = storage.parseDataUrl(v);
        const objKey = `applications/${appId}/${field}.${p ? p.ext : 'jpg'}`;
        try { await storage.putDataUrl(storage.CCCD_BUCKET, objKey, v); upd[field] = objKey; } catch (e) {}
      }
    }
    if (Object.keys(upd).length) {
      const keys = Object.keys(upd);
      await query(`UPDATE applications SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(', ')} WHERE id=$${keys.length + 1}`,
        [...keys.map(k => upd[k]), appId]);
    }
    res.status(201).json({ ok: true, id: appId });
  } catch (e) { next(e); }
});

module.exports = router;
