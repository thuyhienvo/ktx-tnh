# BỘ TEST DEPLOY & GIÁM SÁT — App Quản lý KTX

> Deploy: Render (Docker) · CSDL Supabase · ảnh S3/Supabase Storage · **1 service, không staging riêng**.
> Nguồn: `Dockerfile`, `docker-compose.yml`, `render.yaml`, `.github/workflows/deploy.yml`, `server/index.js`, `server/db.js`.

**Kết luận:** phần "khởi động an toàn" làm tốt (fail-fast biến môi trường, graceful shutdown, secret không lộ,
Docker non-root). Điểm yếu tập trung ở **quy trình phát hành (không có test gate)** và **khả năng quan sát (gần như bằng 0)**.

---

## PHẦN A — DEPLOY

### DP-01 · Push lên `main` là thẳng lên prod, KHÔNG qua test nào
- **Bước:** đọc `.github/workflows/deploy.yml` + `render.yaml`.
- **Đúng:** có job `npm test` chạy trước, deploy chỉ khi xanh.
- **Nghi ngờ:** workflow **chỉ build & push image lên GHCR, không có bước test**. `render.yaml:13` `autoDeploy: true` → **Render tự build từ source mỗi commit trên `main`** (image GHCR gần như thừa, bước trigger Render đã bị comment). → **1 commit lỗi là lên thẳng người dùng.** Với 10 lỗi v1 + hàng chục case v2/mảng mới đang mở, đây là rủi ro thật.
- **Đúng cần làm:** thêm job `npm test` là gate; hoặc `autoDeploy: false` + deploy qua hook sau khi test pass.
- **Mức độ:** Cao.

### DP-02 · Schema áp lại mỗi boot, không versioning, không rollback
- **Bước:** đọc `db.js:62-63`.
- **Nghi ngờ:** mỗi deploy `pool.query(schema.sql)` chạy lại **toàn bộ** file. Hiện file additive/idempotent (`IF NOT EXISTS`, `ON CONFLICT`) nên an toàn — **nhưng không có migration đánh số, không snapshot trước khi áp, không rollback**. Ai sửa `schema.sql` theo kiểu **không** additive (đổi kiểu cột, thêm NOT NULL/UNIQUE lên dữ liệu vi phạm) thì deploy kế tiếp hoặc hỏng dữ liệu, hoặc ràng buộc "trượt trong im lặng" vào `schema_guard`. (Xem DB-02.)
- **Mức độ:** Cao. Ghép chặt với DB-03 (không backup) — sai schema mà không có backup là mất dữ liệu.

### DP-03 · Deploy có gián đoạn — xác minh graceful
- **Bước:** trigger redeploy trên Render, trong lúc đó bấm vài thao tác. Đo thời gian "app không phản hồi".
- **Nghi ngờ:** plan `free` 1 instance → redeploy có khoảng chết (container mới phải boot + chạy **hết** `schema.sql` mới `listen`), cold start ~50s sau khi ngủ.
- **Đúng cần ghi nhận:** `index.js:154-159` **có** bắt SIGTERM/SIGINT → `server.close()` + `pool.end()` + ép thoát sau 10s → **không cắt ngang giao dịch đang chạy**. `render.yaml:12` có `healthCheckPath`. Tốt. Chỉ là 1 instance nên không thật sự zero-downtime.

### DP-04 · Biến môi trường & secret — xác minh (ĐẠT)
- **Bước:** kiểm app có fail-fast khi thiếu biến bắt buộc không.
- **Kết quả (mong đợi PASS):** `db.js:8` (DATABASE_URL), `auth.js:4-6` (JWT_SECRET ≥16), `storage.js:8-13` (6 biến S3), `db.js:85` (ADMIN_PASSWORD) — **đều throw, không chạy với default yếu**. `.env` không bị git track; `render.yaml` dùng `generateValue`/`sync:false` cho secret. → tốt.
- **Lệch nhỏ:** `render.yaml:29` hard-code endpoint Supabase (project-ref lộ, không phải secret); fail-fast rải rác không gộp một chỗ (mức thấp).

---

## PHẦN B — GIÁM SÁT

### MON-01 · `/api/health` trả `{ok:true}` mù — Render tưởng app khỏe khi CSDL đã chết
- **Bước:** ngắt kết nối Supabase (hoặc để pooler chết) → gọi `GET /api/health`.
- **Đúng:** 503 khi CSDL/S3 không với tới được (readiness probe thật).
- **Nghi ngờ:** `index.js:126` `res.json({ ok: true })` — **không ping DB, không kiểm S3**. Supabase rớt → `/health` vẫn 200 → **Render không restart, không cảnh báo**, trong khi mọi request thật đều 500. Health hiện chỉ chứng minh "tiến trình còn sống", không phải "app dùng được".
- **Mức độ:** Cao.

### MON-02 · Không có error tracking — lỗi ngoài đời không ai biết
- **Bước:** tìm Sentry/APM/error reporting trong repo.
- **Nghi ngờ:** **không có gì** (grep sentry/datadog/newrelic/otel = 0). Lỗi 500 chỉ nằm trong stdout log Render (bay mất khi container restart/ngủ). App 500 hàng loạt cũng **không ai được báo** — phải tự vào Dashboard đọc log mới biết.
- **Mức độ:** Cao.

### MON-03 · Không có cảnh báo/uptime; mail hỏng âm thầm
- **Bước:** cấu hình SMTP sai → ghi vi phạm đủ ngưỡng → xem có gì báo không.
- **Nghi ngờ:** không kênh nào báo khi app sập / CSDL đầy / mail hỏng. `mailer.js:125` trả `{sent:false}` **không throw, không alert** → nhà trường không nhận mail mà **không ai biết** (ghép V2-16). Free plan không backup + không alert dung lượng.
- **Đúng cần làm:** ít nhất một uptime monitor ngoài (UptimeRobot…) ping `/api/health` (sau khi MON-01 sửa thành readiness thật), và một kênh báo khi gửi mail thất bại.
- **Mức độ:** Cao.

### MON-04 · Log không cấu trúc + rủi ro lộ PII trong log
- **Bước:** đọc `index.js:55-58, 140`.
- **Nghi ngờ:** mỗi request in `METHOD URL` **kèm query string** (`:56`) — route nào nhận dữ liệu cá nhân qua query là **lọt vào log Render**. Lỗi 500 in nguyên `console.error('❌', err)` (`:140`) — không nuốt lỗi (tốt) nhưng text thô. Không có pino/winston/morgan, không status/latency/request-id → khó tra.
- **Ghi nhận:** audit log DB **có che secret** (`index.js:89`, mask `password|cccd|image|smtp_pass|token`) — tốt.
- **Mức độ:** Trung bình.

### MON-05 · Không có metrics
- **Nghi ngờ:** không đo response time, số lỗi, dung lượng DB/S3, không endpoint `/metrics`. Không biết app đang gần trần tài nguyên hay chưa cho tới khi sập. (Liên quan trực tiếp câu hỏi tải — xem TEST-PLAN-PERFORMANCE.md.)

---

## Thứ tự ưu tiên
**Trước go-live 30/07:** DP-01 (test gate CI) · MON-01 (health kiểm DB) · MON-03 (uptime monitor + báo mail hỏng) · DP-02+DB-03 (backup trước khi có bất kỳ deploy schema nào).
**Ngay sau:** MON-02 (Sentry hoặc tương đương) · MON-04 (bỏ query string khỏi log) · DP-03 (chấp nhận cold start hay nâng plan).
