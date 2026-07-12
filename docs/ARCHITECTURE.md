# Tài liệu kỹ thuật — Hệ thống Quản lý Ký túc xá (KTX Nội trú Esuhai)

> Tài liệu dành cho lập trình viên/kỹ thuật. Xem tài liệu nghiệp vụ (cho lãnh đạo) tại `docs/BA-DOCUMENT.md`.

## 1. Tổng quan

Ứng dụng web quản lý toàn diện khu nội trú học viên: hồ sơ học viên, phòng, xe, tiền phòng/điện nước, vi phạm, hỗ trợ học viên, bảo trì, và cổng tự phục vụ cho học viên. Có bản cài đặt PWA (dùng như app trên điện thoại).

**Triết lý kiến trúc:** *một kiến trúc duy nhất cho mọi môi trường*. Không rẽ nhánh framework theo môi trường — mọi phase (local dev, staging, UAT, production) chạy **PostgreSQL + S3 object storage**, chỉ khác nhau endpoint/credentials qua biến môi trường. Thiếu cấu hình bắt buộc thì **fail-fast** (app từ chối khởi động) thay vì âm thầm chạy sai.

## 2. Công nghệ

| Lớp | Công nghệ |
|---|---|
| Backend | Node.js 20, Express 4 (thuần, không framework nặng) |
| Frontend | Vanilla JS SPA (không framework/không build), PWA (Service Worker + manifest) |
| CSDL | PostgreSQL 16 (qua `pg`/node-postgres) |
| Object storage | S3 (`@aws-sdk/client-s3`) — MinIO (local) / Supabase Storage (staging) |
| Xác thực | JWT trong cookie httpOnly (SameSite=Lax, Secure khi HTTPS) |
| Email | Nodemailer (SMTP) — thông báo vi phạm cho nhà trường |
| Đóng gói/triển khai | Docker, Render (staging), GitHub auto-deploy |

**Không dùng** thư viện biểu đồ ngoài — mọi biểu đồ (cột, tròn/donut) vẽ bằng SVG thủ công. Không có bước build frontend — các file JS/CSS phục vụ tĩnh.

## 3. Cấu trúc thư mục

```
server/
  index.js            # Khởi tạo Express, middleware (log, audit), mount routes, error handler
  load-env.js         # Nạp .env khi chạy local (không phụ thuộc thư viện ngoài)
  db.js               # Kết nối PostgreSQL (pg Pool), fail-fast, seed mặc định, withTransaction()
  storage.js          # Client S3 (aws-sdk): upload/get/delete/presign; fail-fast nếu thiếu S3_*
  auth.js             # JWT, requireAuth, requireRole, set/clear cookie; fail-fast JWT_SECRET
  mailer.js           # Gửi mail SMTP (nodemailer) + kiểm tra kết nối, có timeout
  billing.js          # Bộ tính tiền phòng (proration theo ngày, chia điện theo số người)
  invoice-calc.js     # Tính lại hóa đơn 1 học viên
  cccd-url.js         # Map key ảnh CCCD -> URL proxy
  schema.sql          # Toàn bộ DDL (CREATE TABLE IF NOT EXISTS + ALTER ADD COLUMN IF NOT EXISTS)
  routes/*.routes.js  # Các route theo phân hệ (xem mục 6)
public/
  index.html          # Vỏ SPA (nạp css/js theo ?v=N để phá cache)
  css/styles.css      # Hệ thống thiết kế (vàng đồng + than chì + sage)
  js/icons.js         # window.IC — bộ icon SVG (lucide-style)
  js/api.js           # Lớp gọi API + Auth (cookie); tự logout khi 401
  js/ui.js            # Tiện ích chung (esc, money, toast, modal, tìm kiếm tức thì...)
  js/app.js           # Toàn bộ SPA: điều phối, các màn hình, form (~2800 dòng)
  sw.js               # Service worker (network-first cho shell, bỏ qua /api)
docs/                 # Tài liệu (file này + BA)
Dockerfile, docker-compose.yml, render.yaml, .env.example
```

## 4. Mô hình môi trường (phase)

| Phase | Nơi chạy | CSDL | Object storage |
|---|---|---|---|
| local dev | Máy cá nhân (`docker compose up -d` + `npm start`) | Postgres container | MinIO |
| staging | Render (`ktx-tnh`) | Supabase PostgreSQL | Supabase Storage |
| UAT / production | (sau) | Postgres quản lý | S3 (Supabase/AWS) |

Chỉ khác nhau qua biến môi trường — **không đổi code**. Backing services local dựng bằng `docker-compose.yml` (chỉ Postgres + MinIO, tự tạo bucket).

### Biến môi trường (fail-fast nếu thiếu)
`DATABASE_URL`, `JWT_SECRET` (≥16 ký tự), `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_CCCD_BUCKET`, `S3_INTRO_BUCKET`, `COOKIE_SECURE`, `ADMIN_USERNAME/PASSWORD` (bootstrap admin lần đầu), `PGSSL` (=disable cho Postgres nội bộ), `DORM_NAME`.

## 5. Mô hình dữ liệu (PostgreSQL)

Bảng chính (khóa ngoại + `deleted_at` xóa mềm ở hầu hết bảng):

- **facilities** — cơ sở (địa chỉ).
- **rooms** — phòng: tên, tầng (suy từ tên), hạng A/B/C/D, giới tính, sức chứa, `deleted_at`.
- **students** — học viên: mã, tên, giới tính, SĐT, ngày sinh, lớp, phòng, ngày vào/ra, hình thức thuê, tạm trú, hợp đồng, cọc, **CCCD (lưu KEY S3, không lưu base64)**, `status`, `deleted_at`.
- **users** — tài khoản: username, hash mật khẩu, **role** (`admin`/`staff`/`maintenance`/`student`), `student_id`, `must_change_password`, `deleted_at`.
- **vehicles** — xe của học viên.
- **invoices** — hóa đơn tháng: các khoản (phòng/điện/nước/DV/máy giặt/gửi xe/khác), tổng, trạng thái (`pending`/`sent`/`paid`), `deleted_at`; UNIQUE(student_id, month).
- **electric_readings** — chỉ số điện theo phòng/tháng.
- **logs** — nhật ký ra/vào (check-in/out).
- **violations / violation_types** — vi phạm & danh mục; `level`, `notified_school`.
- **applications** — đơn đăng ký (công khai hoặc admin tạo hộ) → duyệt tạo học viên.
- **damage_reports** — yêu cầu hỗ trợ học viên: `category` (`damage`/`violation`/`other`), `status` (`new`/`processing`/`blocked`/`done`), `assigned_at` (chuyển bảo trì), `admin_note` (ghi chú/lý do).
- **checkout_requests** — đơn xin trả phòng.
- **assets** — danh mục tài sản/thiết bị + phí bồi hoàn.
- **settings** — cấu hình dạng key-value (đơn giá, mã Bravo, nội dung trang giới thiệu, SMTP...).
- **media** — ảnh trang giới thiệu (lưu KEY S3).
- **audit_log** — nhật ký thao tác (ai làm gì, khi nào; ẩn secret/CCCD).

Schema áp bằng `schema.sql` mỗi lần khởi động (idempotent: `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN IF NOT EXISTS`), nên **nâng cấp không cần công cụ migration ngoài**.

## 6. Phân hệ API (server/routes)

| Route | Vai trò được phép | Chức năng |
|---|---|---|
| `auth` | công khai / mọi user | đăng nhập (đặt cookie), đăng xuất, `/me`, đổi mật khẩu |
| `students` | admin, staff | CRUD, check-in/out, chuyển phòng, cọc, tài khoản, proxy ảnh CCCD, xóa mềm/khôi phục |
| `rooms`, `vehicles`, `assets`, `facilities` | admin/staff | CRUD + xóa mềm |
| `electric` | admin, staff | nhập/lưu chỉ số điện |
| `invoices` | admin, staff | lập hóa đơn (xem trước + idempotent), lẻ, tay, đánh dấu đã thu, xóa mềm/hồi sinh |
| `reports` | admin | doanh thu theo tháng/năm |
| `violations` | admin, staff | ghi nhận, danh mục, thống kê, gửi mail nhà trường |
| `requests` | admin, staff | hỗ trợ học viên (damage/support), duyệt & chuyển bảo trì, đơn trả phòng |
| `applications` | admin, staff | danh sách đơn đăng ký, duyệt (tạo học viên), từ chối |
| `maintenance` | maintenance, admin | hàng đợi công việc bảo trì, cập nhật trạng thái (đang xử lý / chưa xử lý được + lý do / xong) |
| `me` | student | hồ sơ, hóa đơn, vi phạm, gửi yêu cầu hỗ trợ, xin trả phòng |
| `admin` | admin | nhật ký (audit), quản lý tài khoản nhân viên/bảo trì |
| `settings` | admin (đọc: mọi user) | đơn giá, SMTP (ẩn mật khẩu), nội dung trang giới thiệu |
| `public` | công khai | thông tin KTX, phòng trống, gửi đơn đăng ký, proxy ảnh giới thiệu |
| `media` | admin | upload ảnh trang giới thiệu (lên S3) |

## 7. Xác thực & phân quyền

- Đăng nhập → server ký **JWT** đặt vào **cookie httpOnly** (client không đọc được token → chống XSS đánh cắp). Không trả token trong body.
- `requireAuth` đọc token từ cookie (fallback header cho kiểm thử). `requireRole(...roles)` chặn theo vai trò.
- **4 vai trò:**
  - **admin** — toàn quyền.
  - **staff (nhân viên)** — nghiệp vụ (học viên, phòng, xe, check-in/out, tiền phòng, hỗ trợ); KHÔNG Điều hành/Doanh thu/Nhật ký/Cài đặt.
  - **maintenance (bảo trì)** — chỉ hàng đợi công việc bảo trì.
  - **student (học viên)** — chỉ dữ liệu của chính mình.
- Tài khoản admin khởi tạo từ ENV lần đầu **buộc đổi mật khẩu** ở lần đăng nhập đầu; tài khoản do admin tạo/đặt lại mật khẩu cũng vậy.
- Tài khoản bị vô hiệu hóa (xóa mềm) không đăng nhập được.

## 8. Lưu trữ ảnh (S3)

- **Ảnh CCCD** → bucket riêng tư; lưu **KEY** trong DB (không lưu base64). Phục vụ qua **proxy có kiểm soát quyền** `GET /api/students/:id/cccd/:side` (chỉ admin/staff hoặc chính học viên đó; chặn ảnh của học viên đã xóa mềm).
- **Ảnh trang giới thiệu** → bucket công khai; proxy `GET /api/public/image/:key`.
- Chỉ nhận ảnh raster (JPG/PNG/WEBP/GIF) — **từ chối SVG** (chống XSS). Header `X-Content-Type-Options: nosniff`.

## 9. Bảo mật (điểm chính đã kiểm thử)

- Cookie httpOnly + SameSite=Lax + Secure (HTTPS).
- Fail-fast: thiếu `JWT_SECRET`/`DATABASE_URL`/`S3_*`/`ADMIN_PASSWORD` → không khởi động (không dùng secret mặc định).
- `GET /settings` **không bao giờ trả mật khẩu SMTP** (chỉ cờ đã cấu hình). Audit log **ẩn** password/CCCD/token.
- SQL đều tham số hóa; xóa mềm giữ vết; transaction dùng helper `withTransaction()` bảo đảm ROLLBACK (đã sửa lỗi rò transaction nghiêm trọng).
- Error handler: 4xx trả thông báo, 5xx trả chung (không lộ chi tiết nội bộ).

## 10. Kiểm thử & triển khai

- **Kiểm thử:** đã kiểm thử pre-go-live 6 phân hệ song song (338 test case, 100% đạt sau khi vá), gồm phân quyền, đường tiền, bảo mật, fail-fast. Xem `docs/TEST-REPORT.md`.
- **Local:** `docker compose up -d` (Postgres + MinIO) → `npm start` (hoặc `Chay-App.bat`).
- **Staging:** Docker trên Render, tự build & deploy khi push GitHub. CSDL Supabase, ảnh Supabase Storage.
- Phá cache client: mọi asset gắn `?v=N`; service worker versioned; bump N mỗi lần đổi frontend.
