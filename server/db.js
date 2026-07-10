const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Hai chế độ:
//  - Có DATABASE_URL  -> dùng PostgreSQL (khi chạy bằng Docker)
//  - Không có         -> dùng PGlite (Postgres nhúng, lưu ra thư mục .data, không cần server/Docker)
const USE_PG = !!process.env.DATABASE_URL;

let impl;        // triển khai thực (pg Pool hoặc bộ bọc PGlite), gán trong init()
let pgliteDb;    // instance PGlite (khi dùng nhúng)

// Proxy ổn định để các route destructure { pool } lúc require vẫn dùng được sau init()
const pool = {
  query: (text, params) => impl.query(text, params),
  connect: () => impl.connect(),
};

// Ép DATE -> 'YYYY-MM-DD', NUMERIC -> số
const PARSERS = { 1082: v => v, 1700: v => (v == null ? null : parseFloat(v)) };

async function query(text, params) {
  return impl.query(text, params);
}

async function connectPg() {
  const { Pool, types } = require('pg');
  types.setTypeParser(1082, v => v);
  types.setTypeParser(1700, v => (v == null ? null : parseFloat(v)));
  const p = new Pool({ connectionString: process.env.DATABASE_URL });
  // chờ DB sẵn sàng
  for (let i = 0; i < 30; i++) {
    try { await p.query('SELECT 1'); break; }
    catch (e) { console.log(`⏳ Chờ PostgreSQL... (${i + 1}/30)`); await new Promise(r => setTimeout(r, 2000)); }
  }
  return p;
}

async function connectPglite() {
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = process.env.PGLITE_DIR || path.join(__dirname, '..', '.data');
  pgliteDb = new PGlite(dir, { parsers: PARSERS });
  await pgliteDb.waitReady;
  // Bọc lại để có cùng giao diện với pg (query + connect/transaction)
  return {
    query: (text, params) => pgliteDb.query(text, params || []),
    connect: async () => ({
      query: (text, params) => pgliteDb.query(text, params || []),
      release: () => {},
    }),
    _pglite: pgliteDb,
  };
}

async function init() {
  impl = USE_PG ? await connectPg() : await connectPglite();
  console.log(USE_PG ? '🐘 Dùng PostgreSQL' : '📦 Dùng CSDL nhúng PGlite (.data)');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  if (USE_PG) await impl.query(schema);
  else await pgliteDb.exec(schema);

  // Tài khoản quản trị mặc định
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', [adminUser]);
  if (rows.length === 0) {
    await pool.query(
      "INSERT INTO users (username, password_hash, role, full_name) VALUES ($1, $2, 'admin', $3)",
      [adminUser, bcrypt.hashSync(adminPass, 10), 'Quản trị viên']
    );
    console.log(`👤 Đã tạo tài khoản quản trị: ${adminUser}`);
  }

  // Cấu hình mặc định
  const dormName = process.env.DORM_NAME || 'Ký túc xá Học viên';
  const defaults = {
    dorm_name: dormName,
    room_fee: '1200000', water_fee: '100000', electric_unit: '3000', service_fee: '50000',
    washing_fee: '70000', parking_fee: '100000', deposit_fee: '1200000',
    partial_half_min: '10', partial_full_min: '15',
    legal_female: 'E2', legal_male: 'S2', due_day_from: '1', due_day_to: '5', hotline: '',
    // Giá thuê nguyên phòng theo hạng
    room_price_A: '5500000', room_price_B: '4800000', room_price_C: '4200000', room_price_D: '3600000',
    // Mã sản phẩm Bravo (để đối chiếu doanh thu)
    bravo_fee_type: 'T0704',
    bravo_room: 'GP00180', bravo_water: 'GP00181', bravo_service: 'GP00183',
    bravo_electric: 'GP00184', bravo_parking: 'GP00182', bravo_washing: '', bravo_other: '',
    // Nhà trường + email (vi phạm lần 3 sẽ gửi mail)
    school_name: 'Nhà trường', school_email: '', violation_mail_threshold: '3',
    // Cấu hình SMTP (admin điền sau để bật gửi mail tự động)
    smtp_host: '', smtp_port: '587', smtp_secure: 'false',
    smtp_user: '', smtp_pass: '', smtp_from: '',
  };
  for (const [key, value] of Object.entries(defaults)) {
    await pool.query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, [key, value]);
  }

  // Danh mục tài sản mặc định (theo biên bản bàn giao)
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

  // Danh mục loại vi phạm mặc định (sửa được trong Cài đặt)
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

  // Cơ sở mặc định
  const fac = await pool.query('SELECT id FROM facilities LIMIT 1');
  if (fac.rows.length === 0) {
    await pool.query('INSERT INTO facilities (name, address) VALUES ($1, $2)',
      ['Cơ sở 1', '11/9/4 Thoại Ngọc Hầu, Tân Phú']);
    console.log('🏢 Đã tạo cơ sở mặc định');
  }

  console.log('✅ CSDL sẵn sàng');
}

async function getSettings() {
  const { rows } = await pool.query('SELECT key, value FROM settings');
  const o = {};
  for (const r of rows) o[r.key] = r.value;
  return o;
}

module.exports = { pool, query, init, getSettings };
