# BỘ TEST BẢO MẬT — App Quản lý KTX

> Bộ này soi **tầng hạ tầng/nền tảng** (header, JWT, cookie, secret, rate-limit, thư viện, injection).
> Phần **lỗ hổng theo logic nghiệp vụ** (leo quyền, mạo danh, rò rỉ dữ liệu qua API) nằm ở
> `TEST-PLAN-ADVERSARIAL.md` (v1) và `TEST-PLAN-ADVERSARIAL-V2.md` (v2). Mục cuối liệt kê chéo các case bảo mật ở đó.
> Nguồn: đọc code thật `server/index.js`, `server/auth.js`, `server/storage.js`, `Dockerfile`, `package-lock.json`.

**Kết luận tổng quát: nền tảng làm khá chắc.** Không secret thật trong repo, không SQLi, JWT có thu hồi,
Docker chạy non-root, đa số header bật. Việc cần làm trước go-live 30/07 gói gọn trong **3 mục CAO/TB** dưới đây.

---

## ⚠️ Lưu ý staleness — code đang được vá trong ngày
Bộ V2 viết sáng 16/07. Đọc lại code chiều 16/07 thấy **một số lỗ đã được vá**, cần **xác minh lại** trước khi báo cáo:
- **SSRF SMTP** (V2-13): nay `valid.js:102-114` + `mailer.js:60` **đã chặn host nội bộ/loopback/metadata** → V2-13 phần lớn đã vá. **Nhưng V2-12 (rò mật khẩu SMTP ra host NGOÀI mình kiểm soát) cần kiểm lại** — chặn host nội bộ không ngăn được việc trỏ ra host ngoài để hứng mật khẩu đã lưu.
- **`smtpTestLimiter` 15 lần/15 phút** (`settings.routes.js:33-36`) đã có → V2-15 (không giới hạn) đã vá.
- **Magic-bytes ảnh** (V2-59): `storage.js:31-51` nay kiểm chữ ký thật → V2-59 đã vá.
- **Phí gửi xe theo tháng** (V2-20/23): nay có `server/vehicle-count.js` `countForMonth` → cần xác minh đã vá.
→ **Việc đầu tiên khi chạy bộ này: `SELECT * FROM schema_guard` và đọc lại 4 mục trên trên code hiện tại.**

---

## NHÓM S1 — HEADER & CSP

### SEC-01 · CSP tắt hoàn toàn → mất lớp chắn XSS cuối
- **Bước:** mở DevTools → Network → xem response header của `GET /`. Tìm `Content-Security-Policy`.
- **Đúng:** có CSP tối thiểu (ít nhất `script-src 'self'`).
- **Nghi ngờ:** **không có**. `index.js:16` `contentSecurityPolicy: false` (tắt vì frontend dùng inline `onclick`/`style`). App lại **ghép chuỗi HTML để dựng giao diện** → nếu có **một** chỗ quên lọc dữ liệu người dùng (tên HV, ghi chú, tên phòng) thì mã chạy, **không còn lớp nào chặn**.
- **Ghép với:** TC-46 (bộ v1 — XSS qua tên/ghi chú). CSP tắt biến mọi lỗ XSS tiềm tàng thành **chí mạng**. Đây là lý do TC-46 phải soi thật kỹ ở mọi màn.
- **Mức độ:** Cao (defense-in-depth). Bật CSP vướng inline `onclick` — cần refactor frontend, không sửa nhanh được.
- **Ghi nhận:** các header còn lại **vẫn bật đúng** (helmet 8 mặc định): `X-Frame-Options: SAMEORIGIN`, `nosniff`, HSTS, `Referrer-Policy`. Đừng báo thiếu.

---

## NHÓM S2 — PHIÊN & XÁC THỰC

### SEC-02 · Cookie phiên thiếu cờ Secure trên prod nếu quên biến môi trường
- **Bước:** trên bản Render, đăng nhập → xem Set-Cookie của `ktx_token`. Kiểm có `Secure` không.
- **Đúng:** có `Secure` (vì Render chạy HTTPS).
- **Nghi ngờ:** `auth.js:9` `COOKIE_SECURE = process.env.COOKIE_SECURE === 'true'` — **không suy theo môi trường, phải set tay**. `.env.example:19` mặc định `false`. Quên set trên Render → cookie **thiếu Secure**. `render.yaml:15-16` hiện đã cứng `="true"` → **kiểm biến thật trên Render Dashboard có đúng không.**
- **Đúng cần ghi nhận:** `httpOnly:true` + `sameSite:'lax'` — JS client không đọc được token, chống được CSRF cơ bản. Tốt.
- **Mức độ:** Trung bình (rủi ro cấu hình).

### SEC-03 · Thu hồi vé — xác minh còn sống
> Đây là TC-13/14/15 của v1, đã sửa. Chạy lại để chắc sau các thay đổi trong ngày.
- **Bước:** login lấy token → admin đổi mật khẩu / giáng chức / xóa tài khoản đó → dùng token cũ gọi `GET /api/students`.
- **Đúng:** 401.
- **Nghi ngờ (mong đợi PASS):** `auth.js:67-80` đọc lại role + `token_epoch` từ DB **mỗi request**; `revokeTokens` gọi đủ ở logout/đổi mật khẩu/đổi quyền. Token hạn 30 ngày (`auth.js:17`) nhưng thu hồi được nên chấp nhận. Đề nghị khai báo `algorithms:['HS256']` ở `jwt.verify` (`auth.js:63`) cho chặt (mức thấp).

### SEC-04 · Chính sách mật khẩu & băm — xác minh
- **Bước:** thử đặt mật khẩu `12345678` (đủ 8 số nhưng không có chữ), `password`, trùng username.
- **Đúng (mong đợi PASS):** từ chối. `valid.js:78-91` `checkPassword`: ≥8, phải có chữ+số, chặn ~19 mật khẩu phổ biến, chặn trùng tên. bcrypt cost 10 nhất quán mọi nơi. Không có mật khẩu admin mặc định (`db.js:85-92` fail-fast + `must_change_password`).
- **Lệch nhỏ:** seed admin cho tối thiểu **6** ký tự (`db.js:86`) trong khi chính sách chung là **8** — vì buộc đổi lần đầu nên rủi ro thấp.

---

## NHÓM S3 — RATE-LIMIT & LẠM DỤNG

### SEC-05 · Kiểm mọi limiter còn đúng chỗ
- **Bước:** đọc `index.js` + route, đối chiếu bảng:

| Limiter | Ngưỡng | Phạm vi | Nguồn |
|---|---|---|---|
| apiLimiter | 600/phút/IP | toàn `/api` | `index.js:28,49` |
| authLimiter | 20/15ph/IP (bỏ qua lần đúng) | login + change-password | `index.js:32-36` |
| applyLimiter | 10/phút/IP | `/api/public/apply` | `index.js:45-48` |
| smtpTestLimiter | 15/15ph | `/settings/smtp/test` | `settings.routes.js:33-36` |
| khóa tài khoản | theo username | login | `auth.routes.js:35-47` |

- **Nghi ngờ còn lại:** `POST /api/violations/student/:id/notify` (`violations.routes.js:166`) **gửi mail thật, chỉ có apiLimiter chung**. Đã có `requireRole('admin','staff')` và đích mail cố định (`school_email`) → không phải open relay, nhưng admin/staff bị chiếm tài khoản vẫn spam được hộp thư nhà trường. Nên thêm limiter nhẹ. (Mức thấp.)
- **Cảnh báo vận hành (không phải bug):** rate-limit theo **IP**. Cả văn phòng chung 1 IP NAT → chung ngân sách 600/phút và 20 login/15 phút → trùng **TC-19**. Mùa tuyển sinh HV dùng chung wifi KTX gửi `/apply` cũng chung 10/phút.

### SEC-06 · SSRF qua "Test SMTP" — XÁC MINH LẠI (đã vá một phần)
- **Bước:** `POST /api/settings/smtp/test` với `smtp_host:"127.0.0.1"`, `"169.254.169.254"`, `"10.0.0.5"`.
- **Đúng:** chặn.
- **Trạng thái:** `valid.js:102-114` + `mailer.js:60` nay **đã chặn host nội bộ/loopback/link-local/metadata** → V2-13 đã vá. **Còn phải kiểm V2-12:** trỏ `smtp_host` ra một host **ngoài Internet mình kiểm soát**, để `smtp_pass` trống → server có gửi mật khẩu đã lưu ra host đó không? Nếu có, lỗ rò mật khẩu **vẫn còn** dù SSRF nội bộ đã bịt.

---

## NHÓM S4 — INJECTION, UPLOAD, THƯ VIỆN, DOCKER (xác minh — phần lớn ĐẠT)

### SEC-07 · SQL injection
- **Kết quả đọc code:** **không có**. Mọi giá trị tham số hóa `$1..$n`; các chỗ nội suy `${}` vào SQL đều là **tên cột từ whitelist nội bộ hoặc hằng** (`SIDE_COL`, `CCCD_FIELDS`, `LIMIT` ép số). Đừng báo `LIMIT ${lim}` (`logs.routes.js:23`) là injection — `lim` luôn qua `Math.min/+`.

### SEC-08 · Upload ảnh — kiểm magic-bytes (đã vá)
- **Bước:** `POST /api/media/hero` với `data:image/png;base64,<byte không phải PNG>`; và SVG chứa script.
- **Đúng (mong đợi PASS):** từ chối cả hai. `storage.js:31-51` nay kiểm chữ ký thật; SVG bị whitelist chặn (`storage.js:26`); `nosniff` đặt đúng. → V2-59 và TC-47a đã vá. Vẫn nên xác minh trên bản hiện tại.

### SEC-09 · Thư viện có CVE nghiêm trọng?
- **Kết quả đọc lockfile:** express 4.22.2, jsonwebtoken 9.0.3, pg 8.22.0, helmet 8.3.0, nodemailer 9.0.3, bcryptjs 2.4.3 — **không CVE nghiêm trọng đã biết tính tới đầu 2026**. Dockerfile `npm ci --omit=dev` chốt theo lock. Khuyến nghị: chạy `npm audit` định kỳ (mức thấp).

### SEC-10 · Docker & secret
- **Kết quả:** `Dockerfile:18` `USER node` (non-root), không secret trong image, `.dockerignore` loại `.env`/`.git`/`node_modules`. `.env` **không** bị git track. Thiếu `HEALTHCHECK` trong Dockerfile (Render dùng `healthCheckPath` thay) — mức thấp.

---

## Case bảo mật nằm ở bộ nghiệp vụ (tham chiếu chéo — đừng bỏ)
Những lỗ nặng nhất về bảo mật của app **không** ở tầng hạ tầng mà ở logic:
- **V2-12** rò mật khẩu SMTP ra host ngoài · **V2-71** admin tự khóa quyền vĩnh viễn · **V2-73** admin đặt mật khẩu tài khoản HV rồi mạo danh (ghép V2-63 không audit đăng nhập) · **V2-45** HV đọc được `admin_note` · **V2-74** `data-health` đọc CCCD hàng loạt không audit · **TC-46** XSS (nặng vì SEC-01).

## Thứ tự ưu tiên trước go-live 30/07
1. `SELECT * FROM schema_guard` + xác minh 4 mục staleness ở đầu file.
2. **SEC-02** bật `COOKIE_SECURE=true` trên Render (kiểm biến thật).
3. **SEC-06/V2-12** xác minh rò mật khẩu SMTP ra host ngoài.
4. **SEC-01** quyết định CSP (phối hợp refactor inline onclick) — kèm rà TC-46 mọi màn.
