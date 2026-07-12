const express = require('express');
const { query, getSettings } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { testConnection } = require('../mailer');

const router = express.Router();

// Các khóa bí mật KHÔNG bao giờ trả về client (chỉ trả cờ "đã cấu hình")
const SECRET_KEYS = ['smtp_pass'];

// Bỏ secret khỏi object cấu hình, thêm cờ <key>_set để UI biết đã cấu hình hay chưa
function sanitize(s) {
  const out = { ...s };
  for (const k of SECRET_KEYS) { out[k + '_set'] = !!(s[k] && String(s[k]).trim()); delete out[k]; }
  return out;
}

// Cấu hình (mọi người đăng nhập đều xem được đơn giá) — ẩn secret
router.get('/', requireAuth, async (req, res, next) => {
  try { res.json(sanitize(await getSettings())); } catch (e) { next(e); }
});

// Kiểm tra kết nối SMTP (chỉ admin) — không lưu gì, chỉ verify
router.post('/smtp/test', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const b = req.body || {};
    const r = await testConnection({
      smtp_host: b.smtp_host, smtp_port: b.smtp_port, smtp_secure: b.smtp_secure,
      smtp_user: b.smtp_user, smtp_pass: b.smtp_pass,
    });
    res.json(r);
  } catch (e) { next(e); }
});

// Cập nhật cấu hình (chỉ admin)
router.put('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const allowed = ['dorm_name', 'hotline', 'room_fee', 'water_fee', 'electric_unit', 'service_fee',
      'washing_fee', 'parking_fee', 'deposit_fee', 'partial_half_min', 'partial_full_min',
      'legal_female', 'legal_male', 'due_day_from', 'due_day_to',
      'room_price_A', 'room_price_B', 'room_price_C', 'room_price_D',
      'bravo_fee_type', 'bravo_room', 'bravo_water', 'bravo_service', 'bravo_electric', 'bravo_parking', 'bravo_washing', 'bravo_other',
      'school_name', 'school_email', 'violation_mail_threshold',
      'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass', 'smtp_from',
      'intro_hero_title', 'intro_hero_desc', 'intro_about_eyebrow', 'intro_about_title', 'intro_about_desc',
      'intro_rooms_eyebrow', 'intro_rooms_title', 'intro_rooms_desc', 'intro_amenities_title',
      'intro_price_title', 'intro_price_desc', 'intro_contact_title', 'intro_contact_desc',
      'imgcap_khuon-vien-1', 'imgcap_khuon-vien-2', 'imgcap_khuon-vien-3',
      'imgcap_phong-1', 'imgcap_phong-2', 'imgcap_phong-3'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        // Không ghi đè mật khẩu SMTP bằng chuỗi rỗng (form ẩn pass, để trống = giữ nguyên)
        if (SECRET_KEYS.includes(key) && !String(req.body[key]).trim()) continue;
        await query(
          `INSERT INTO settings (key, value) VALUES ($1,$2)
           ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`,
          [key, String(req.body[key])]
        );
      }
    }
    res.json(sanitize(await getSettings()));
  } catch (e) { next(e); }
});

module.exports = router;
