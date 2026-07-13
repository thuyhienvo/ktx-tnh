const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool, types } = require('pg');

// Một kiến trúc CSDL duy nhất cho MỌI môi trường: PostgreSQL qua node-postgres.
// (local dev: Postgres container; staging/UAT/prod: Postgres quản lý — chỉ khác DATABASE_URL.)
if (!process.env.DATABASE_URL) {
  throw new Error('Thiếu DATABASE_URL. Local: chạy "docker compose up -d" rồi đặt DATABASE_URL trong .env.');
}

// Ép DATE -> 'YYYY-MM-DD', NUMERIC -> số (áp dụng toàn cục cho pg)
types.setTypeParser(1082, v => v);
types.setTypeParser(1700, v => (v == null ? null : parseFloat(v)));

// SSL: bật cho DB cloud (Supabase...). Đặt PGSSL=disable cho Postgres nội bộ (container local).
const ssl = process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false };
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl,
  max: 10,
  idleTimeoutMillis: 30000,        // đóng client rảnh sau 30s
  connectionTimeoutMillis: 10000,  // lỗi nếu không lấy được kết nối trong 10s
  statement_timeout: 15000,        // hủy query chạy quá 15s (chống treo connection)
  query_timeout: 15000,
});
// Bắt lỗi client rảnh bị rớt (pooler đóng, mạng chập) — KHÔNG để văng 'error' làm sập process
pool.on('error', (err) => console.error('❌ Lỗi pool PostgreSQL (client rảnh):', err.message));

async function query(text, params) {
  return pool.query(text, params);
}

// Helper transaction dùng chung — không thể quên ROLLBACK/release.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
}

async function init() {
  // chờ DB sẵn sàng (container/pooler có thể khởi động sau app)
  for (let i = 0; i < 30; i++) {
    try { await pool.query('SELECT 1'); break; }
    catch (e) {
      if (i === 29) throw new Error('Không kết nối được PostgreSQL: ' + e.message);
      console.log(`⏳ Chờ PostgreSQL... (${i + 1}/30)`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.log('🐘 Dùng PostgreSQL');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  await seedDefaults();
  console.log('✅ CSDL sẵn sàng');
}

async function seedDefaults() {
  // Tài khoản quản trị khởi tạo lần đầu — fail-fast nếu thiếu mật khẩu (không dùng default yếu)
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', [adminUser]);
  if (rows.length === 0) {
    const adminPass = process.env.ADMIN_PASSWORD;
    if (!adminPass || adminPass.length < 6) {
      throw new Error('Chưa có tài khoản quản trị và ADMIN_PASSWORD thiếu/quá ngắn (≥6). Đặt ADMIN_PASSWORD rồi khởi động lại.');
    }
    await pool.query(
      "INSERT INTO users (username, password_hash, role, full_name, must_change_password) VALUES ($1, $2, 'admin', $3, true)",
      [adminUser, bcrypt.hashSync(adminPass, 10), 'Quản trị viên']
    );
    console.log(`👤 Đã tạo tài khoản quản trị: ${adminUser} (bắt buộc đổi mật khẩu lần đầu)`);
  }

  // Cấu hình mặc định
  const dormName = process.env.DORM_NAME || 'Ký túc xá Nội trú Esuhai';
  const defaults = {
    dorm_name: dormName,
    room_fee: '1200000', water_fee: '100000', electric_unit: '3000', service_fee: '50000',
    washing_fee: '70000', parking_fee: '100000', deposit_fee: '1200000',
    partial_half_min: '10', partial_full_min: '15',
    legal_female: 'E2', legal_male: 'S2', due_day_from: '1', due_day_to: '5', hotline: '',
    room_price_A: '5500000', room_price_B: '4800000', room_price_C: '4200000', room_price_D: '3600000',
    bravo_fee_type: 'T0704',
    bravo_room: 'GP00180', bravo_water: 'GP00181', bravo_service: 'GP00183',
    bravo_electric: 'GP00184', bravo_parking: 'GP00182', bravo_washing: '', bravo_other: '',
    intro_hero_title: 'Không gian nội trú\nan tâm & nề nếp',
    intro_hero_desc: 'chỗ ở tiện nghi, kỷ luật, đồng hành cùng học viên trên hành trình sang Nhật.',
    intro_about_eyebrow: 'Về khu nội trú',
    intro_about_title: 'Khuôn viên ngăn nắp, an ninh, gần trường',
    intro_about_desc: 'Khu nội trú bố trí gọn gàng với khu tự học, sinh hoạt chung và bảo vệ 24/7 — nơi học viên rèn nếp sống kỷ luật kiểu Nhật.',
    intro_rooms_eyebrow: 'Phòng ở',
    intro_rooms_title: 'Phòng ở tiện nghi, sạch sẽ',
    intro_rooms_desc: 'Phòng ghép đầy đủ nội thất: giường tầng, tủ locker riêng, máy lạnh, kệ đồ — vệ sinh định kỳ.',
    intro_amenities_title: 'Tiện ích & dịch vụ',
    intro_price_title: 'Bảng giá chi phí',
    intro_price_desc: 'Minh bạch theo từng khoản. Tiền điện tính theo công-tơ, chia đều số người ở phòng.',
    intro_contact_title: 'Liên hệ & đường đến',
    intro_contact_desc: 'Ghé thăm hoặc gọi cho ban quản lý để được tư vấn xếp phòng.',
    'imgcap_khuon-vien-1': 'Khuôn viên', 'imgcap_khuon-vien-2': 'Sảnh sinh hoạt chung', 'imgcap_khuon-vien-3': 'Khu tự học',
    'imgcap_phong-1': 'Phòng ghép', 'imgcap_phong-2': 'Nội thất phòng', 'imgcap_phong-3': 'Khu vệ sinh',
    school_name: 'Nhà trường', school_email: '', violation_mail_threshold: '3',
    smtp_host: '', smtp_port: '587', smtp_secure: 'false',
    smtp_user: '', smtp_pass: '', smtp_from: '',
  };
  for (const [key, value] of Object.entries(defaults)) {
    await pool.query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, [key, value]);
  }

  const assetCount = await pool.query('SELECT COUNT(*)::int c FROM assets');
  if (assetCount.rows[0].c === 0) {
    const seed = [
      ['Chìa khoá tủ locker', 'Cái', 'person', 1, 50000],
      ['Chìa khoá phòng', 'Cái', 'person', 1, 50000],
      ['Remote máy lạnh', 'Cái', 'person', 1, 200000],
      ['Vệ sinh phòng ở', 'Lần', 'person', 1, 200000],
      ['Giường tầng sắt', 'Cái', 'fixed', 1, 0],
      ['Tủ locker', 'Cái', 'fixed', 1, 0],
      ['Máy lạnh 1 HP', 'Cái', 'fixed', 1, 0],
      ['Kệ dép gỗ 3 tầng', 'Cái', 'fixed', 1, 0],
      ['Thùng rác', 'Cái', 'fixed', 2, 0],
      ['Kệ nhà tắm', 'Cái', 'fixed', 1, 0],
    ];
    for (let i = 0; i < seed.length; i++) {
      const [name, unit, category, quantity, fee] = seed[i];
      await pool.query('INSERT INTO assets (name, unit, category, quantity, fee, sort) VALUES ($1,$2,$3,$4,$5,$6)',
        [name, unit, category, quantity, fee, i]);
    }
    console.log('🪑 Đã tạo danh mục tài sản mặc định');
  }

  const vtCount = await pool.query('SELECT COUNT(*)::int c FROM violation_types');
  if (vtCount.rows[0].c === 0) {
    const vt = [
      ['Về ký túc xá trễ giờ quy định', 'minor'],
      ['Gây ồn ào, mất trật tự', 'minor'],
      ['Không giữ vệ sinh chung', 'minor'],
      ['Không tham gia sinh hoạt / điểm danh', 'minor'],
      ['Hút thuốc / uống rượu bia trong KTX', 'major'],
      ['Tự ý cho người lạ vào ở lại', 'major'],
      ['Nấu ăn / dùng thiết bị gây cháy nổ', 'major'],
      ['Đánh nhau, gây gổ', 'severe'],
      ['Trộm cắp tài sản', 'severe'],
      ['Vi phạm nghiêm trọng khác', 'severe'],
    ];
    for (let i = 0; i < vt.length; i++) {
      await pool.query('INSERT INTO violation_types (name, severity, sort) VALUES ($1,$2,$3)', [vt[i][0], vt[i][1], i]);
    }
    console.log('⚠️  Đã tạo danh mục loại vi phạm mặc định');
  }

  const fac = await pool.query('SELECT id FROM facilities LIMIT 1');
  if (fac.rows.length === 0) {
    await pool.query('INSERT INTO facilities (name, address) VALUES ($1, $2)',
      ['Cơ sở 1', '11/9/4 Thoại Ngọc Hầu, Phường Hòa Thạnh, Quận Tân Phú, Thành phố Hồ Chí Minh']);
    console.log('🏢 Đã tạo cơ sở mặc định');
  }
}

async function getSettings() {
  const { rows } = await pool.query('SELECT key, value FROM settings');
  const o = {};
  for (const r of rows) o[r.key] = r.value;
  return o;
}

module.exports = { pool, query, withTransaction, init, getSettings };
