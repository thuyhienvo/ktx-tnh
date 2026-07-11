const express = require('express');
const { query, getSettings } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

// Cấu hình công khai (mọi người đăng nhập đều xem được đơn giá)
router.get('/', requireAuth, async (req, res, next) => {
  try { res.json(await getSettings()); } catch (e) { next(e); }
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
        await query(
          `INSERT INTO settings (key, value) VALUES ($1,$2)
           ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`,
          [key, String(req.body[key])]
        );
      }
    }
    res.json(await getSettings());
  } catch (e) { next(e); }
});

module.exports = router;
