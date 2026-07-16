# BỘ TEST CƠ SỞ DỮ LIỆU — App Quản lý KTX

> Soi tầng CSDL: toàn vẹn dữ liệu, ràng buộc, index, kiểu số, múi giờ, migration, backup, kết nối.
> Nguồn: đọc `server/schema.sql` (toàn bộ), `server/db.js`, `invoice-calc.js`, `billing.js`, `render.yaml`.
> CSDL prod nay là **Supabase** (session pooler, port 5432).

**Nguyên tắc đọc bộ này:** mọi CHECK/UNIQUE nằm trong khối `DO $ktx$` (`schema.sql:377-448`) **chỉ áp được nếu
dữ liệu hiện tại không vi phạm** — nếu vi phạm thì **âm thầm tắt** (ghi vào bảng `schema_guard`, in cảnh báo lúc boot).
Nên **"có ràng buộc trong file" ≠ "đang được bảo vệ"**. Vì vậy case đầu tiên là kiểm `schema_guard`.

---

## DB-00 · Kiểm ràng buộc nào đang thật sự có hiệu lực (CHẠY ĐẦU TIÊN)
- **Bước:** trên Supabase, `SELECT * FROM schema_guard;`
- **Đúng:** bảng rỗng — mọi ràng buộc đã áp.
- **Nghi ngờ:** có dòng → ràng buộc đó **đang bị vô hiệu** vì dữ liệu cũ vi phạm. Mỗi dòng là một lớp phòng thủ đã tắt (tiền âm, chỉ số điện vô lý, biển số trùng...). Xử lý dữ liệu vi phạm rồi cho boot lại để áp.

---

## NHÓM D1 — BỐN LANDMINE PROD (P0)

### DB-01 · TZ=UTC → sai ngày trên toàn hệ thống lúc 0h–7h giờ VN
- **Bước:** đặt giờ máy chủ (hoặc test lúc rạng sáng VN) → tạo check-in, ghi thu tiền, HV gửi đơn trả phòng. So ngày lưu với ngày thật ở VN.
- **Đúng:** mọi "hôm nay" theo giờ VN (UTC+7).
- **Nghi ngờ:** **KHÔNG có `TZ` ở đâu** — `Dockerfile` `node:20-alpine` (UTC), `render.yaml` không set, code không set. Hơn 30 chỗ tính "hôm nay" bằng `new Date().toISOString().slice(0,10)` → **từ 00:00–07:00 giờ VN trả về NGÀY HÔM QUA**. Ảnh hưởng tiền: `invoices.routes.js:342,353` (ngày thu tiền), `students.routes.js:237,239,398,421,487,541` (nhận/trả phòng, cọc), `violations.routes.js:114` (ngày vi phạm), `me.routes.js:88-189` (cửa sổ HV tự trả phòng).
- **Ghi nhận:** lõi `billing.js` **TZ-an toàn** (chỉ dùng năm/tháng, so hai chuỗi `YYYY-MM-DD`). Lỗi nằm **hoàn toàn ở tầng route lúc sinh "hôm nay"**, không ở phép tính. → Sửa: đặt `TZ=Asia/Ho_Chi_Minh` (env Render) là gần như dứt điểm.
- **Mức độ:** Nghiêm trọng. Đây là landmine chắc chắn bùng khi lên prod.

### DB-02 · schema.sql chạy mỗi boot — bug thứ tự làm rơi chốt chặn tiền âm ở lần boot đầu
- **Bước:** dựng một CSDL **mới tinh** → boot 1 lần → `SELECT * FROM schema_guard` → thử tạo hóa đơn tiền âm.
- **Đúng:** chốt `ck_invoices_no_negative` chặn ngay từ boot đầu.
- **Nghi ngờ:** khối `DO $ktx$` (`schema.sql:377`) tạo `ck_invoices_no_negative` (`:410`) tham chiếu cột `leader_discount`/`room_discount` — nhưng 2 cột này chỉ `ADD COLUMN` ở **dòng 473/479** (SAU khối DO); và `ck_room_leaders_dates` (`:430`) sửa bảng `room_leaders` tạo ở **dòng 455** (SAU). → Trên DB mới, boot #1 hai ràng buộc này ném lỗi "không tồn tại" → rơi vào `schema_guard` → **hóa đơn không có chốt tiền âm suốt vòng đời boot đầu**. Chỉ tự lành ở boot #2. Supabase đã boot nhiều lần nên **có thể đã áp — kiểm `schema_guard` để chắc**.
- **Mức độ:** Trung bình–Cao.

### DB-03 · Không có backup/PITR/pg_dump tự động
- **Bước:** tìm trong repo: cron backup, script `pg_dump`, cấu hình Supabase PITR.
- **Nghi ngờ:** **không có gì**. `render.yaml` không có cron. `README.md:66` chỉ có `pg_dump` **thủ công cho Postgres container local**, không áp cho Supabase. PITR là tính năng trả phí bật ở dashboard, không có dấu vết trong repo. → **Một lệnh xóa nhầm (vd V2-... mark-paid, xóa HV) là mất, không hoàn tác.** Bật Supabase PITR hoặc cron `pg_dump` ra chỗ khác **trước** go-live.
- **Mức độ:** Nghiêm trọng (rủi ro mất dữ liệu).

### DB-04 · NUMERIC nhận 'NaN' — một lỗ ở chỉ số điện
- **Bước:** `POST /api/electric/bulk` với `reading_start:"abc"`.
- **Đúng:** 400.
- **Nghi ngờ:** `electric.routes.js:69` `+r.reading_start` **không có `Number.isFinite`** → `NaN` → INSERT `reading_start=NaN, kwh=NaN` vào NUMERIC (Postgres **chấp nhận** 'NaN'). Chốt duy nhất là CHECK `ck_electric_sane` (`schema.sql:426`) — **nhưng nếu CHECK này đang nằm trong `schema_guard`** (DB-00) thì NaN lọt thẳng, mọi phép tính điện downstream ra NaN.
- **Ghi nhận:** các đường tiền khác **đã chặn NaN tốt** (`Number.isFinite` ở cọc/hóa đơn/phòng/tài sản). Chỉ điện còn hở.
- **Ghép với V2-56:** `deposit_amount:"abc"` ở duyệt đơn cũng cho NaN — kiểm cả hai.

---

## NHÓM D2 — RÀNG BUỘC TOÀN VẸN (P1)

### DB-05 · Cột trạng thái phần lớn là TEXT tự do, không CHECK enum
- **Bước:** qua API/SQL, đặt `status='xyz'`, `deposit_status='abc'`, `role='sieuquantri'`, `severity='catastrophic'`.
- **Nghi ngờ:** lọt hết vào DB. Chỉ `invoices.month` (regex) và giới tính (ở `valid.js`) được siết; còn `status`/`deposit_status`/`contract_status`/`role`/`severity`/`reason`/`category`/`rental_type`/`residency_status` **đều TEXT không CHECK**. Rác lọt vào báo cáo/bộ lọc. (Ghép V2-07.)

### DB-06 · Bảng thiếu CHECK tiền ≥ 0 ở tầng DB
- **Nghi ngờ:** `assets.fee`, `students.deposit_deduction`, `meter_reads.reading` **không CHECK ≥0 ở DB** (chỉ chặn ở app — vá sót một đường ghi là rác nằm lại). `vehicles` **không CHECK `to_date >= from_date`** (trong khi `room_stays`/`room_leaders` có). (Ghép V2-28.)

### DB-07 · Thiếu khóa ngoại — dữ liệu mồ côi
- **Nghi ngờ:** `invoices.room_id` (`schema.sql:141`), `logs.room_id` (`:118`), `damage_reports.room_id` (`:197`), `applications.facility_id` (`:190`) đều là **INTEGER trần, KHÔNG FK** → trỏ tới id không tồn tại vẫn lưu được → JOIN ra null, báo cáo lệch.

### DB-08 · Mâu thuẫn UNIQUE username — xóa mềm không giải phóng tên
- **Bước:** tạo user `nhanvien1` → xóa → tạo lại `nhanvien1`.
- **Nghi ngờ:** bị chặn "đã tồn tại" dù danh sách trống. `schema.sql:100` `username ... UNIQUE` (CỨNG, tính cả dòng đã xóa) mâu thuẫn với `uq_users_username_ci` (`:402`, partial loại `deleted_at`). → ghép **V2-76**.

---

## NHÓM D3 — HIỆU NĂNG CSDL & KẾT NỐI (P1 — xem thêm TEST-PLAN-PERFORMANCE.md)

### DB-09 · Sinh hóa đơn = 1 giao dịch dài trên 1 kết nối
- **Nghi ngờ:** `invoices.routes.js:61` `pool.connect()` → BEGIN → vòng lặp tuần tự ~240 HV → COMMIT, giữ **1/10 slot pool** suốt thời gian chạy. Với `statement_timeout 15s` + trần pooler Supabase → nguy cơ **ROLLBACK sạch** khi dữ liệu lớn. (= P-01 bộ hiệu năng, TC-48.)

### DB-10 · Thiếu index ở cột hay lọc
- **Nghi ngờ:** thiếu index cho `invoices.status` (lô "đã thu"), `violations.date` (báo cáo theo năm), `logs.date`, `damage_reports`/`checkout_requests`/`applications.status`. Bảng đơn do người ngoài gửi (`applications`, `damage`) có thể phình → quét bảng chậm dần.
- **Ghi nhận:** đã có index cho các cột chính (`students.status/deleted/room`, `invoices.month/deleted`, `electric.month`, `meter_reads`, `room_stays/leaders`, `audit_at`).

### DB-11 · Cấu hình kết nối Supabase — xác minh (phần lớn ĐẠT)
- **Kết quả đọc code:** `pool max:10`, `idleTimeout 30s`, `connectionTimeout 10s`, `statement_timeout 15s`, `pool.on('error')` chống pooler drop. Dùng **statement không tên** → an toàn với PgBouncer. `render.yaml:17` là **session pooler** → prepared statement không phải vấn đề. Thiếu `maxUses` để tái tạo kết nối định kỳ (mức thấp). Tiền là **NUMERIC(12,0)** (số nguyên VND, không float — tốt); ngày là **DATE thật** (không phải TEXT — tốt).

---

## Thứ tự ưu tiên
**Trước go-live 30/07, đúng 4 việc:** DB-00 (kiểm schema_guard) · DB-01 (đặt TZ) · DB-03 (bật backup/PITR) · DB-02 (xác minh chốt tiền âm đã áp).
**Ngay sau:** DB-04 (NaN điện) · DB-05/06/07 (bổ sung CHECK/FK) · DB-08 (mâu thuẫn username).
