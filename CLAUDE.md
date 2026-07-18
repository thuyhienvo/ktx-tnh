# CLAUDE.md — Context dự án quan-ly-ktx

> File này được Claude Code tự đọc mỗi phiên. Giữ ngắn gọn, cập nhật khi có thay đổi lớn.

## App là gì
Ứng dụng quản lý **Ký túc xá Nội trú Esuhai**: check-in/check-out, tiền phòng, tiền điện, đơn từ, vi phạm, bảo trì, xe, trực nhật... PWA + API + PostgreSQL. UI 100% tiếng Việt.
Demo STAGING (dữ liệu mẫu, demo cho sếp): https://ktx-tnh.onrender.com

## Tech stack (KHỚP package.json — không tự đổi)
- **Backend:** Node 20 + Express 4 (CommonJS, **vanilla JS — KHÔNG TypeScript, KHÔNG framework FE**)
- **Frontend:** PWA thuần trong `public/` (index.html + `js/app.js`, `js/api.js`, `js/ui.js`, service worker `sw.js`)
- **DB:** PostgreSQL (driver `pg`) — schema duy nhất ở `server/schema.sql` (boot tự áp, KHÔNG có hệ migration đánh số)
- **Khác:** JWT + bcryptjs (auth), helmet, express-rate-limit, nodemailer (mail), @aws-sdk/client-s3 (Supabase Storage giao thức S3)
- **Test:** `npm test` = `node tests/run.js` (unit + e2e trong `tests/`) — không dùng jest/mocha

## Hạ tầng / Deploy
- **Local:** `npm run services` (docker compose: Postgres + S3) → `npm run dev` → http://localhost:3000
- **Staging Render:** service `ktx-tnh` (plan free, Docker), **`autoDeploy: true` → cứ `git push` là deploy THẲNG, không có bước chặn**
- **CSDL staging:** **Supabase** project `sceuwqrpyungzkhohmvj` (session pooler port 5432) — KHÔNG phải Render Postgres. Storage = Supabase Storage (S3).
- Health check: `/api/health`. Hướng dẫn chi tiết: `HUONG-DAN-DEPLOY.md`, `HUONG-DAN-CICD.md`

## ⚠️ RÀNG BUỘC AN TOÀN (bắt buộc tuân thủ)
- **TUYỆT ĐỐI KHÔNG** đụng Supabase project `jaktkfycrgjhjusdgnhc` (đó là app esuhai-ttb — khác dự án)
- **Test/thí nghiệm chỉ chạy LOCAL** (`localhost:3000`) — không bắn request phá hoại vào `ktx-tnh.onrender.com`
- **PHẢI HỎI user trước khi `git push`** — autoDeploy bật nên push = lên staging ngay
- Mail test: dùng hộp thư giả local (127.0.0.1), không gửi mail thật
- Trước khi coi là xong: `npm test` phải PASS

## Trạng thái hiện tại (cập nhật 2026-07-18) — CHUẨN BỊ GO-LIVE
- **Mục tiêu production: trước 06/08/2026**. Mảng **tài chính (QR/phiếu thu) = GIAI ĐOẠN 2** (sau khi GĐ1 chạy ổn) — đã GỠ khỏi app, code ở nhánh `feature/finance-qr`. Xem [[finance-roadmap-qr]] trong memory.
- **Rà soát logic toàn diện 18/07 (6 agent, code v80)** — báo cáo `docs/REVIEW-LOGIC-GO-LIVE-2026-07-18.md`. Kết luận: lõi tính tiền + auth/phân quyền VỮNG; báo cáo "71 FAIL" (16/07) phần lớn đã vá ở #64–#71.
- **7 lỗi CHẶN PHÁT HÀNH đã fix (#76) + 6 lỗi TRUNG BÌNH (#77):** 3 đường trả phòng gộp về `server/checkout.js` chung; chặn ngày trả < lượt ở; đổi giới tính phòng có người khác giới; reject/delete đơn nguyên tử; **TZ=Asia/Ho_Chi_Minh** (index.js+db.js+render.yaml); schema chốt tiền âm; máy trạng thái cọc; check-out 2 lần; rate-limit ip+username; escape mail; trùng biển số; advisory lock duyệt trùng SĐT. `npm test` **256 PASS**.
- **CÒN LẠI trước go-live:** ① **BLK-6 backup CSDL** — công ty bật **Supabase PITR** + cron `tools/backup-db.sh` (chưa xong) ② nhóm 🟠 còn vài mục nhỏ (siết validate biên, CSP đang tắt) — xem cuối báo cáo review.
- UI/UX: xem `docs/TEST-RESULT-UIUX-2026-07-16.md`

## Quy ước code (theo repo hiện có)
- Routes theo module: `server/routes/*.routes.js` (18 module: students, rooms, invoices, electric, applications...)
- Logic dùng chung: `server/` gốc (`auth.js`, `billing.js`, `invoice-calc.js`, `valid.js`, `db.js`...)
- Đổi schema = sửa `server/schema.sql` (nhớ tương thích với DB staging đang chạy — additive)
- Giữ vanilla JS + phong cách & tiếng Việt hiện có; icon PWA sinh bằng `server/gen-icons.js`
- File `scratch_*.js` ở gốc là file nháp thí nghiệm — không phải code app

## Tài liệu
- **Nghiệp vụ:** `docs/BA-DOCUMENT.md` · **Kiến trúc:** `docs/ARCHITECTURE.md`
- **Bộ đề test đối kháng:** `docs/TEST-PLAN-ADVERSARIAL.md` (V1), `docs/TEST-PLAN-ADVERSARIAL-V2.md`, `docs/TEST-PLAN-UI-UX-ADVERSARIAL.md`
- **Kết quả test mới nhất:** các file `docs/TEST-RESULT-*-2026-07-1x.md`
