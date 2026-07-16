# BỘ TEST SEO & TRANG CÔNG KHAI — App Quản lý KTX

> **Phạm vi HẸP có chủ đích.** Đây là PWA nội bộ, gần như toàn bộ nằm sau đăng nhập. Bề mặt SEO thật chỉ vài trang.
> Bỏ qua "SEO doanh nghiệp" (sitemap lớn, hreflang, keyword). Trọng tâm đúng **3 việc thực dụng**:
> (a) link Zalo hiện đẹp khi gửi HV · (b) chặn Google index trang quản trị · (c) HV mở trang đăng ký dễ.
> Nguồn: `public/index.html`, `public/gioi-thieu-he-thong.html`, `public/manifest.webmanifest`, `public/js/app.js`, `server/index.js`.

**Bề mặt công khai thật (không cần đăng nhập):**
`/dang-ky` (form đăng ký cho **học viên**, render phía client) · `/gioi-thieu-he-thong.html` (landing cho **lãnh đạo/khách mua phần mềm**, HTML tĩnh) · `/api/public/doc/noi-quy` (PDF) · trang login (`/`). Mọi thứ còn lại sau login.

---

## NHÓM 1 — CAO (ảnh hưởng trực tiếp mục tiêu)

### SEO-01 · Link dán lên Zalo/Facebook trơ trọi — không tiêu đề, không ảnh
- **Bước:** dán link `/dang-ky` và `/gioi-thieu-he-thong.html` vào một tin nhắn Zalo (hoặc dùng công cụ xem trước OG). Xem có hiện thẻ đẹp không.
- **Đúng:** hiện tiêu đề + mô tả + ảnh 1200×630.
- **Nghi ngờ:** hiện **URL trần**. `index.html:3-15` và `gioi-thieu-he-thong.html:3-7` **không có `og:title/og:description/og:image` hay `twitter:card`** (grep 0 match). App **gửi link đăng ký qua Zalo** (đúng nghiệp vụ) → HV nhận một dòng URL cụt, trông kém tin cậy, giảm tỉ lệ bấm.
- **Đúng cần làm:** thêm thẻ OG **tĩnh trong `<head>` của `index.html`** (xem SEO-02 vì sao phải tĩnh).
- **Mức độ:** Cao. Đây là việc đáng sửa nhất.

### SEO-02 · `/dang-ky` render 100% phía client → bot đọc được HTML rỗng
- **Bước:** `curl https://.../dang-ky` (không chạy JS) → xem HTML trả về.
- **Nghi ngờ:** chỉ có `<div id="app"></div>` rỗng + `<title>Quản lý Ký túc xá</title>`. Toàn bộ nội dung (h1, bảng giá, ảnh) dựng bằng JS sau (`app.js:13` `renderPublicRegister`). Crawler Zalo/Facebook **không chạy JS** → không thấy gì. → Hệ quả: OG (SEO-01) **bắt buộc đặt tĩnh** trong `index.html`, không thể sinh bằng JS.
- **Ghi nhận:** `/gioi-thieu-he-thong.html` ngược lại — nội dung có sẵn trong HTML tĩnh (`:138-268`), bot đọc tốt, chỉ thiếu OG.

### SEO-03 · Không có robots.txt → không có tín hiệu chặn index trang nội bộ
- **Bước:** mở `/robots.txt`. Tìm trên Google `site:ktx-tnh.onrender.com`.
- **Nghi ngờ:** **không tồn tại `robots.txt`**, `server/index.js` không set `X-Robots-Tag`. Vì SPA, mọi route (`/students`, `/invoices`, login) trả cùng `index.html` gần rỗng → Google **không** đọc được dữ liệu HV (nằm sau API + cookie httpOnly) nên rò rỉ dữ liệu **thấp**. Nhưng bản demo `ktx-tnh.onrender.com` có dữ liệu mẫu — nếu bị index sẽ khó coi.
- **Đúng cần làm:** thêm `robots.txt`; đặt `noindex` **toàn bộ** (app nội bộ, gần như không có gì đáng index trừ `/dang-ky`); đặc biệt **`noindex` toàn bộ trên bản demo**.
- **Mức độ:** Cao (chủ yếu cho bản demo).

---

## NHÓM 2 — TRUNG BÌNH

### SEO-04 · Thiếu `<meta name="description">` ở cả hai trang
- **Nghi ngờ:** `index.html:3-15`, `gioi-thieu-he-thong.html:3-7` không có. Google/Zalo tự cắt text bất kỳ làm mô tả (với `/dang-ky` là rỗng vì SPA). Thêm description tĩnh.

### SEO-05 · `<title>` chung chung, dùng chung cho cả `/dang-ky`
- **Nghi ngờ:** `index.html:7` = "Quản lý Ký túc xá", JS không đổi `document.title` → trang đăng ký cũng mang title này. Nên đặt "Đăng ký nội trú — [Tên KTX]".
- **Ghi nhận:** `gioi-thieu-he-thong.html:7` đã tốt ("Hệ thống Quản lý Ký túc xá — Nội trú Esuhai").

---

## NHÓM 3 — THẤP / KHÔNG CẦN (nêu rõ để khỏi làm thừa)

- **SEO-06 · sitemap.xml — KHÔNG cần.** ~2 trang công khai, sitemap vô nghĩa.
- **SEO-07 · hreflang — KHÔNG cần.** Đơn ngữ, `lang="vi"` đã đặt đúng (`index.html:2`, `gioi-thieu:2`).
- **SEO-08 · canonical — tùy chọn, ROI thấp.** Có thể thêm cho 2 trang công khai tránh trùng `/` vs `/dang-ky`.
- **SEO-09 · structured data (schema.org) — tùy chọn.** `EducationalOrganization` cho trang giới thiệu nếu muốn rich result; ROI thấp cho hệ nội bộ.

---

## Đã kiểm — ĐẠT, đừng sửa nhầm
- **PWA/manifest đầy đủ, cài được:** `manifest.webmanifest` có `name/short_name/description/start_url/scope/display:standalone/theme_color/icons` (gồm maskable-512). Link đúng ở `index.html:8`, cache trong SW.
- **Meta cơ bản có:** `charset`, `viewport` (có `viewport-fit=cover`), `lang="vi"`, `theme-color` — đủ ở cả hai trang.
- **Ảnh có `alt` + `loading="lazy"`** (`app.js:19`); heading hierarchy đúng ở trang giới thiệu (1 `h1` rồi `h2/h3`); iframe bản đồ có `title`.
- **Responsive thật:** trang giới thiệu có nhiều `@media`; trang đăng ký mobile-first (HV dùng điện thoại — phù hợp).

## Thứ tự ưu tiên
1. **SEO-01 + SEO-02 + SEO-04 + SEO-05** (một mẻ): thêm khối thẻ tĩnh vào `<head>` của `index.html` — OG + Twitter + description + title tốt cho `/dang-ky`. Đây là việc quan trọng nhất (link Zalo).
2. **SEO-03:** `robots.txt` + `noindex` toàn bộ bản demo.
3. Phần còn lại: tùy chọn.
