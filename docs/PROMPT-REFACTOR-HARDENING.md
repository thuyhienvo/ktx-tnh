# PROMPT REFACTOR — tách app.js + CSP chặt + migration + hết hard-code

> Mục tiêu: gỡ 3 điểm dễ bị đội quản lý hệ thống "vịn" khi review code lên prod.
> Vanilla JS, giữ phong cách + tiếng Việt. **KHÔNG push.** Làm trên NHÁNH RIÊNG để `main` (bản go-live) an toàn.
> Làm TUẦN TỰ theo 5 chặng. **Hết mỗi chặng: bật server + `ADMIN_P=<mật khẩu> node tests/run.js` phải PASS (280)**, rồi báo PM để smoke-test trước khi sang chặng sau.

## Chuẩn bị
```
git checkout -b refactor/frontend-hardening
```
Bối cảnh đã khảo sát: `public/js/app.js` ~3687 dòng; **283 inline onclick**; frontend nạp NGOÀI: **Google Fonts**
(`fonts.googleapis.com`, `fonts.gstatic.com` — index.html) và **Google Maps iframe** (`www.google.com/maps` — app.js trang giới thiệu).
`public/sw.js` có precache + tên cache `ktx-shell-vNN`; `public/index.html` gắn `?v=NN`; bộ test `tests/unit/version.test.js`
BẮT các asset index.html phải nằm trong precache sw.js và số version phải khớp.

═══════════════════════════════════════════════════════
## CHẶNG 1 — Hệ migration đánh số (an toàn, backend)
═══════════════════════════════════════════════════════
Giữ `server/schema.sql` làm BASELINE idempotent (không bỏ). Thêm cơ chế migration cho thay đổi TƯƠNG LAI:
1. Tạo thư mục `server/migrations/` (rỗng, kèm `README.md`: "mỗi thay đổi schema từ nay = 1 file `NNNN_ten.sql`").
2. Trong `server/db.js`, sau khi áp `schema.sql`, thêm `runMigrations()`:
   - Tạo bảng `schema_migrations(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())` nếu chưa có.
   - Đọc `migrations/*.sql` sắp xếp theo tên; file nào chưa có trong `schema_migrations` → chạy trong 1 transaction rồi ghi nhận.
   - Lỗi 1 file → rollback file đó + log rõ, không nuốt im lặng.
3. (Tuỳ chọn) chuyển vài ràng buộc còn nợ (FK/CHECK enum trong review) thành migration `0001_constraints.sql` — bọc an toàn (dữ liệu cũ có thể vi phạm thì để schema_guard xử như hiện tại).
**Verify:** boot lại app (DB hiện tại: migrations rỗng → không đổi gì); `node tests/run.js` PASS.

═══════════════════════════════════════════════════════
## CHẶNG 2 — Dọn hard-code vào settings (xem docs/PROMPT-DOT-2-3.md phần Đợt 3)
═══════════════════════════════════════════════════════
Làm đúng bảng ngưỡng trong `docs/PROMPT-DOT-2-3.md` (Đợt 3): `overdue_remind_days`(7), `shortterm_max_days`(60),
`deposit_notice_min_days`(30), `partial_half_factor`(0.5), `room_cap_A..D`, `checkout_max_future_days`, `max_cccd_mb`.
Thêm vào `db.js` defaults + cho sửa ở màn Cài đặt + đọc từ settings (có fallback). Gom hằng vai/lý-do-trả-phòng.
**Verify:** `node tests/run.js` PASS; đổi 1 ngưỡng trong Cài đặt thấy app đổi theo.

═══════════════════════════════════════════════════════
## CHẶNG 3 — CSP baseline (bật CSP, chưa siết inline)
═══════════════════════════════════════════════════════
`server/index.js` — thay `contentSecurityPolicy: false` bằng (giữ `'unsafe-inline'` TẠM cho script/style vì còn inline onclick):
```js
contentSecurityPolicy: {
  useDefaults: false,
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    connectSrc: ["'self'"],
    frameSrc: ['https://www.google.com'],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    frameAncestors: ["'none'"],
    formAction: ["'self'"],
  },
},
```
(KHÔNG thêm `upgradeInsecureRequests` để không gãy http localhost.)
**Verify:** app chạy bình thường, font + bản đồ hiện, Console KHÔNG có lỗi CSP; header `Content-Security-Policy` có mặt.

═══════════════════════════════════════════════════════
## CHẶNG 4 — Tách app.js thành nhiều file (giữ global scope)
═══════════════════════════════════════════════════════
Tách `public/js/app.js` theo ranh giới `view*` thành **classic script** (KHÔNG dùng ES module — để giữ hàm ở global scope cho onclick hiện tại vẫn chạy). Ví dụ:
`app-core.js` (boot/nav/refreshCache/state + helper roomById…), `app-students.js`, `app-rooms-services.js`,
`app-invoices-electric.js`, `app-requests.js` (reg/checkout/repair/violations/feedback), `app-exec-dashboard.js`,
`app-settings-admin.js`, `app-public.js`.
BẮT BUỘC đồng bộ 3 chỗ, nếu không `version.test.js` đỏ và PWA cache sai:
1. `index.html`: thêm `<script src="/js/app-XXX.js?v=NN"></script>` theo đúng THỨ TỰ phụ thuộc (core trước).
2. `sw.js`: thêm mọi file mới vào danh sách precache (dùng `${V}`), **tăng số version** (tên cache `ktx-shell-vNN` + `?v=NN` ở index.html phải KHỚP).
3. Không để lọt hàm nào ra ngoài global (các onclick gọi tên hàm trực tiếp).
**Verify:** `node tests/run.js` PASS (đặc biệt version.test) + PM smoke-test mọi màn trên trình duyệt.

═══════════════════════════════════════════════════════
## CHẶNG 5 — Bỏ 283 inline onclick → event delegation + SIẾT CSP
═══════════════════════════════════════════════════════
Đây là chặng RỦI RO NHẤT — làm sau khi 4 chặng trên xanh.
1. Thay `onclick="foo(a,b)"` bằng thuộc tính dữ liệu, vd `data-act="foo" data-args="a,b"`, và **một handler uỷ quyền** gắn 1 lần trên `document` (bắt sự kiện click, đọc `data-act`/`data-args`, gọi hàm tương ứng qua một bảng ánh xạ tên→hàm). Vì app render lại `innerHTML` liên tục nên PHẢI dùng delegation trên phần tử cha ổn định, KHÔNG addEventListener từng nút.
2. Làm theo NHÓM MÀN, mỗi nhóm xong smoke-test ngay (283 chỗ — chia nhỏ để dễ bắt lỗi).
3. Khi KHÔNG còn inline handler: trong `index.js` bỏ `'unsafe-inline'` khỏi `scriptSrc` (giữ ở styleSrc nếu vẫn còn inline style, hoặc chuyển style ra class rồi bỏ nốt).
**Verify:** `node tests/run.js` PASS + PM smoke-test TOÀN BỘ thao tác (mọi nút bấm) + Console không lỗi CSP.

## Khi xong cả 5 chặng
- Để nguyên trên nhánh `refactor/frontend-hardening`, báo PM verify tổng thể rồi mới bàn cách trộn vào `main`.
- KHÔNG tự merge vào main / KHÔNG push khi chưa được đồng ý.
