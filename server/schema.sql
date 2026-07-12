-- ===== Lược đồ CSDL quản lý ký túc xá (v2 - theo nghiệp vụ thực tế) =====

-- Cơ sở ký túc xá (hiện có 1, thiết kế sẵn cho nhiều cơ sở)
CREATE TABLE IF NOT EXISTS facilities (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  address    TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rooms (
  id           SERIAL PRIMARY KEY,
  facility_id  INTEGER REFERENCES facilities(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  floor        INTEGER DEFAULT 1,
  gender       TEXT NOT NULL DEFAULT 'male',   -- 'male' | 'female'
  capacity     INTEGER NOT NULL DEFAULT 0,
  monthly_fee  NUMERIC(12,0) NOT NULL DEFAULT 1200000,
  note         TEXT DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS facility_id INTEGER;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS floor INTEGER DEFAULT 1;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'male';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS hang TEXT DEFAULT 'B';   -- hạng phòng A/B/C/D
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;  -- xóa mềm (khôi phục được)

CREATE TABLE IF NOT EXISTS students (
  id                  SERIAL PRIMARY KEY,
  code                TEXT DEFAULT '',
  name                TEXT NOT NULL,
  gender              TEXT NOT NULL DEFAULT 'male',  -- 'male' | 'female'
  phone               TEXT DEFAULT '',
  id_card             TEXT DEFAULT '',
  room_id             INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  check_in_date       DATE,
  check_out_date      DATE,
  status              TEXT NOT NULL DEFAULT 'in',    -- 'in' | 'out'
  note                TEXT DEFAULT '',
  uses_washing        BOOLEAN NOT NULL DEFAULT false, -- đăng ký máy giặt
  uses_parking        BOOLEAN NOT NULL DEFAULT false, -- đăng ký gửi xe
  deposit_amount      NUMERIC(12,0) NOT NULL DEFAULT 0,
  deposit_status      TEXT NOT NULL DEFAULT 'none',   -- 'none'|'held'|'refunded'|'forfeited'
  deposit_date        DATE,
  deposit_refund_date DATE,
  checkout_notice_date DATE,
  checkout_reason      TEXT,                          -- 'normal'|'urgent_visa'
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE students ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'male';
ALTER TABLE students ADD COLUMN IF NOT EXISTS uses_washing BOOLEAN DEFAULT false;
ALTER TABLE students ADD COLUMN IF NOT EXISTS uses_parking BOOLEAN DEFAULT false;
ALTER TABLE students ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(12,0) DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS deposit_status TEXT DEFAULT 'none';
ALTER TABLE students ADD COLUMN IF NOT EXISTS deposit_date DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS deposit_refund_date DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS checkout_notice_date DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS checkout_reason TEXT;
-- Bổ sung theo nghiệp vụ thực tế
ALTER TABLE students ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS class_name TEXT DEFAULT '';        -- Lớp
ALTER TABLE students ADD COLUMN IF NOT EXISTS rental_type TEXT DEFAULT 'ghep';    -- 'ghep' | 'phong'
ALTER TABLE students ADD COLUMN IF NOT EXISTS residency_status TEXT DEFAULT 'unregistered'; -- tạm trú: 'registered'|'unregistered'
ALTER TABLE students ADD COLUMN IF NOT EXISTS contract_no TEXT DEFAULT '';        -- số HĐ
ALTER TABLE students ADD COLUMN IF NOT EXISTS contract_date DATE;                 -- ngày ký HĐ
ALTER TABLE students ADD COLUMN IF NOT EXISTS contract_status TEXT DEFAULT 'unsigned'; -- 'done'|'scanned'|'unsigned'|'none'
ALTER TABLE students ADD COLUMN IF NOT EXISTS cccd_image TEXT;                    -- (cũ) ảnh CCCD 1 mặt
ALTER TABLE students ADD COLUMN IF NOT EXISTS cccd_front TEXT;                    -- ảnh CCCD mặt trước
ALTER TABLE students ADD COLUMN IF NOT EXISTS cccd_back TEXT;                     -- ảnh CCCD mặt sau
ALTER TABLE students ADD COLUMN IF NOT EXISTS deposit_bank TEXT DEFAULT '';       -- ngân hàng hoàn cọc
ALTER TABLE students ADD COLUMN IF NOT EXISTS deposit_account TEXT DEFAULT '';    -- số TK hoàn cọc
ALTER TABLE students ADD COLUMN IF NOT EXISTS deposit_deduction NUMERIC(12,0) DEFAULT 0;  -- khấu trừ hư hao khi trả phòng
ALTER TABLE students ADD COLUMN IF NOT EXISTS deposit_deduction_note TEXT DEFAULT '';     -- chi tiết khấu trừ

-- Xe của học viên
CREATE TABLE IF NOT EXISTS vehicles (
  id           SERIAL PRIMARY KEY,
  student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  plate        TEXT DEFAULT '',      -- biển số
  vehicle_type TEXT DEFAULT '',      -- loại xe
  sticker      TEXT DEFAULT '',      -- mã dán xe
  note         TEXT DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'student', -- 'admin' | 'student'
  full_name     TEXT DEFAULT '',
  student_id    INTEGER REFERENCES students(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS logs (
  id          SERIAL PRIMARY KEY,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,                 -- 'in' | 'out'
  date        DATE NOT NULL,
  room_id     INTEGER,
  note        TEXT DEFAULT '',
  source      TEXT DEFAULT 'admin',          -- 'admin' | 'self'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chỉ số điện công-tơ từng phòng theo tháng (số đầu tự nối tháng trước)
CREATE TABLE IF NOT EXISTS electric_readings (
  id            SERIAL PRIMARY KEY,
  room_id       INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  month         TEXT NOT NULL,               -- 'YYYY-MM'
  reading_start NUMERIC(10,1) NOT NULL DEFAULT 0, -- số đầu (auto = số cuối tháng trước)
  reading_end   NUMERIC(10,1) NOT NULL DEFAULT 0, -- số cuối (nhập tay)
  kwh           NUMERIC(10,1) NOT NULL DEFAULT 0, -- tiêu thụ = cuối - đầu
  UNIQUE (room_id, month)
);
ALTER TABLE electric_readings ADD COLUMN IF NOT EXISTS reading_start NUMERIC(10,1) DEFAULT 0;
ALTER TABLE electric_readings ADD COLUMN IF NOT EXISTS reading_end NUMERIC(10,1) DEFAULT 0;

-- Hóa đơn (phiếu thu) hàng tháng, có phân tách từng khoản
CREATE TABLE IF NOT EXISTS invoices (
  id             SERIAL PRIMARY KEY,
  student_id     INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  room_id        INTEGER,
  month          TEXT NOT NULL,              -- 'YYYY-MM'
  days_stayed    INTEGER NOT NULL DEFAULT 0,
  room_charge    NUMERIC(12,0) NOT NULL DEFAULT 0,
  electric_kwh   NUMERIC(10,1) NOT NULL DEFAULT 0,
  electric_charge NUMERIC(12,0) NOT NULL DEFAULT 0,
  water_charge   NUMERIC(12,0) NOT NULL DEFAULT 0,
  service_charge NUMERIC(12,0) NOT NULL DEFAULT 0,
  washing_charge NUMERIC(12,0) NOT NULL DEFAULT 0,
  parking_charge NUMERIC(12,0) NOT NULL DEFAULT 0,
  other_charge   NUMERIC(12,0) NOT NULL DEFAULT 0,
  other_note     TEXT DEFAULT '',
  total          NUMERIC(12,0) NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'sent'|'paid'
  paid_date      DATE,
  note           TEXT DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, month)
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Đơn đăng ký phòng (học viên tự gửi từ trang công khai)
CREATE TABLE IF NOT EXISTS applications (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT DEFAULT '',
  gender      TEXT DEFAULT 'female',
  birth_date  DATE,
  code        TEXT DEFAULT '',
  class_name  TEXT DEFAULT '',
  rental_type TEXT DEFAULT 'ghep',
  pref        TEXT DEFAULT '',       -- nguyện vọng (tầng/hạng...)
  note        TEXT DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'approved'|'rejected'
  student_id  INTEGER REFERENCES students(id) ON DELETE SET NULL,
  wants_parking BOOLEAN DEFAULT false,  -- đăng ký gửi xe
  plate       TEXT DEFAULT '',          -- biển số xe
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS wants_parking BOOLEAN DEFAULT false;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS plate TEXT DEFAULT '';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS wants_washing BOOLEAN DEFAULT false;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS cccd_front TEXT;   -- ảnh CCCD mặt trước
ALTER TABLE applications ADD COLUMN IF NOT EXISTS cccd_back TEXT;    -- ảnh CCCD mặt sau
ALTER TABLE applications ADD COLUMN IF NOT EXISTS facility_id INTEGER;  -- cơ sở đăng ký
ALTER TABLE applications ADD COLUMN IF NOT EXISTS admin_note TEXT DEFAULT '';  -- ghi chú của quản lý

-- Báo cáo hư hỏng (học viên gửi)
CREATE TABLE IF NOT EXISTS damage_reports (
  id          SERIAL PRIMARY KEY,
  student_id  INTEGER REFERENCES students(id) ON DELETE CASCADE,
  room_id     INTEGER,
  title       TEXT DEFAULT '',
  description TEXT DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'new', -- 'new'|'processing'|'done'
  admin_note  TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Danh mục tài sản / trang thiết bị trong phòng (kèm phí bồi hoàn)
CREATE TABLE IF NOT EXISTS assets (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  unit       TEXT DEFAULT 'Cái',        -- đơn vị tính
  category   TEXT DEFAULT 'fixed',      -- 'person' (theo người) | 'fixed' (cố định)
  quantity   INTEGER DEFAULT 1,
  fee        NUMERIC(12,0) DEFAULT 0,   -- phí bồi hoàn nếu mất/hư/không vệ sinh
  note       TEXT DEFAULT '',
  sort       INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Đơn đăng ký trả phòng (học viên gửi)
CREATE TABLE IF NOT EXISTS checkout_requests (
  id           SERIAL PRIMARY KEY,
  student_id   INTEGER REFERENCES students(id) ON DELETE CASCADE,
  desired_date DATE,
  reason       TEXT DEFAULT 'normal', -- 'normal'|'urgent_visa'
  note         TEXT DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'done'|'rejected'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  handled_at   TIMESTAMPTZ
);
ALTER TABLE checkout_requests ADD COLUMN IF NOT EXISTS admin_note TEXT DEFAULT '';  -- ghi chú của quản lý

-- Danh mục loại vi phạm / nhắc nhở (sửa trong Cài đặt)
CREATE TABLE IF NOT EXISTS violation_types (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  severity   TEXT NOT NULL DEFAULT 'minor',   -- 'minor'|'major'|'severe'
  sort       INTEGER DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vi phạm / nhắc nhở theo từng học viên
CREATE TABLE IF NOT EXISTS violations (
  id              SERIAL PRIMARY KEY,
  student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type_id         INTEGER REFERENCES violation_types(id) ON DELETE SET NULL,
  type_name       TEXT DEFAULT '',
  severity        TEXT DEFAULT 'minor',
  level           INTEGER NOT NULL DEFAULT 1,       -- lần vi phạm thứ mấy của học viên
  date            DATE NOT NULL,
  note            TEXT DEFAULT '',
  admin_note      TEXT DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'open',     -- 'open'|'resolved'
  notified_school BOOLEAN NOT NULL DEFAULT false,   -- đã gửi mail nhà trường
  notified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_violations_student ON violations(student_id);

-- Ảnh trang giới thiệu (upload trong Cài đặt, lưu base64 — bền vững qua deploy)
CREATE TABLE IF NOT EXISTS media (
  key        TEXT PRIMARY KEY,
  data       TEXT,             -- data URL: data:image/...;base64,...
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Nhật ký thao tác (audit) — ai làm gì, khi nào
CREATE TABLE IF NOT EXISTS audit_log (
  id       SERIAL PRIMARY KEY,
  user_id  INTEGER,
  username TEXT DEFAULT '',
  role     TEXT DEFAULT '',
  method   TEXT DEFAULT '',
  path     TEXT DEFAULT '',
  detail   TEXT DEFAULT '',
  at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at DESC);

CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_invoices_month  ON invoices(month);
CREATE INDEX IF NOT EXISTS idx_logs_student    ON logs(student_id);
