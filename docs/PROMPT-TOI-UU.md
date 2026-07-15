# Prompt tối ưu app KTX — chia 4 đợt

Nguồn: audit ngày 2026-07-16. Chạy TUẦN TỰ từ Đợt 1 → 4, mỗi đợt commit riêng.
Mỗi prompt tự chứa — copy nguyên khối vào agent, không cần context trước đó.

---

## ĐỢT 1 — Quick wins (gzip + cache + service worker)

Rủi ro: rất thấp. Lợi ích: lớn nhất. Làm trước tiên.

```
Bối cảnh: repo tại c:\Users\thuyhien\quan-ly-ktx — app quản lý ký túc xá,
Node/Express + PostgreSQL + PWA vanilla JS, deploy trên Render.
Chạy test bằng: npm test

Nhiệm vụ: tối ưu tầng phân phối static asset. CHỈ làm 3 việc dưới đây,
không refactor gì thêm, không đụng vào logic nghiệp vụ.

1. server/index.js:100 hiện là `app.use(express.static(pub))` trần —
   không nén, không cache header. Hãy:
   - Thêm dependency `compression` vào package.json và bật middleware này
     TRƯỚC express.static.
   - Cấu hình express.static với Cache-Control dài hạn cho asset đã có
     version query (?v=NN): js/css/icons đặt maxAge 1 năm + immutable.
   - QUAN TRỌNG: index.html, sw.js và manifest.webmanifest PHẢI giữ
     no-cache (chúng không có version query — cache chúng là hỏng deploy).
     Kiểm tra kỹ điều kiện phân biệt.

2. public/sw.js:5-6 — mảng SHELL đang precache '?v=25' trong khi
   public/index.html:14,22-25 load '?v=71'. Cache key lệch nhau nên
   precache không bao giờ hit, service worker tải thừa cả bộ asset.
   Sửa SHELL về đúng ?v=71 cho khớp index.html.

3. Sau khi sửa xong, tìm cách chống lỗi này tái diễn: version đang phải
   sửa tay ở 2 file (index.html và sw.js). Đề xuất cho tôi 1-2 phương án
   đơn giản (KHÔNG thêm bundler, KHÔNG thêm build step nặng) rồi CHỜ tôi
   chọn trước khi implement.

Nghiệm thu:
- npm test pass.
- Khởi động server, dùng curl kiểm chứng và báo cáo header thực tế:
  + /js/app.js?v=71 → có Content-Encoding: gzip, có Cache-Control immutable
  + /index.html → KHÔNG có cache dài hạn
  + /sw.js → KHÔNG có cache dài hạn
- Báo cáo kích thước app.js trước/sau nén (kỳ vọng ~278KB → ~70KB).
KHÔNG deploy lên Render, chỉ commit local.
```

---

## ĐỢT 2 — Sửa rủi ro đúng/sai dữ liệu (transaction)

Rủi ro: trung bình — đụng luồng checkout. Bắt buộc test kỹ.

```
Bối cảnh: repo tại c:\Users\thuyhien\quan-ly-ktx — Node/Express +
PostgreSQL. Helper `withTransaction` đã có sẵn ở server/db.js:35-48 và
viết đúng chuẩn (BEGIN/COMMIT/ROLLBACK, release trong finally) — HÃY DÙNG
LẠI nó, đừng viết transaction thủ công. Chạy test: npm test

Nhiệm vụ: sửa 3 lỗ hổng toàn vẹn dữ liệu. Không tối ưu tốc độ ở đợt này.

1. server/routes/students.routes.js:257-268 — hàm resolveCccd (gọi
   storage.putDataUrl → upload ảnh lên S3, tối đa 16MB, 3 field tuần tự)
   đang chạy BÊN TRONG withTransaction. Suốt thời gian upload mạng,
   transaction mở và client pool bị giữ (pool max=10 ở db.js) → chỉ cần
   10 request tạo hồ sơ đồng thời là cạn pool.
   Sửa: upload S3 TRƯỚC, transaction chỉ ghi S3 key vào DB.
   Lưu ý xử lý trường hợp upload xong nhưng DB fail — mô tả cho tôi cách
   bạn xử lý ảnh mồ côi (chấp nhận rác hay cleanup).

2. server/routes/students.routes.js:379-455 (checkout) đang ghi 6 bảng
   bằng các query() rời rạc, KHÔNG có transaction: students → room_stays
   → room_leaders → meter_reads → logs → invoices. Fail giữa chừng =
   HV bị đánh 'out' nhưng room_stays còn treo mở.
   Sửa: bọc vào withTransaction. Cẩn thận vòng lặp recalcInvoice ở dòng
   445 — nó gọi query() dùng pool riêng, phải quyết định đưa vào trong
   hay ngoài transaction; giải thích lựa chọn của bạn.
   Làm tương tự cho students.routes.js:486-507 (transfer) và 379-387
   (checkin).

3. server/routes/invoices.routes.js:209-214 — trong catch, dòng
   `await client.query('ROLLBACK')` không được bọc try. Nếu kết nối đã
   chết (pooler đóng) thì ROLLBACK throw → next(e) không bao giờ chạy →
   request treo + unhandled rejection. So sánh với db.js:43 đang làm đúng.
   Sửa: bọc try/catch quanh ROLLBACK, đảm bảo next(e) luôn chạy.

Nghiệm thu:
- npm test pass — đặc biệt tests/e2e/duplicate-guard.test.js và
  tests/e2e/rooms-validate.test.js.
- Tự viết thêm test cho luồng checkout: giả lập fail ở giữa (ví dụ ném
  lỗi sau khi update students), assert rằng room_stays KHÔNG bị thay đổi.
- Báo cáo trung thực: nếu test nào fail thì dán output, đừng tự sửa test
  cho pass.
KHÔNG deploy. Commit riêng từng mục 1/2/3.
```

---

## ĐỢT 3 — Diệt N+1 ở recalcInvoice (đợt nặng nhất)

Rủi ro: cao — đụng logic tính tiền. Yêu cầu test đối chiếu số liệu.

```
Bối cảnh: repo tại c:\Users\thuyhien\quan-ly-ktx — Node/Express +
PostgreSQL, deploy Render free tier (mỗi round-trip DB ~20-50ms).
Chạy test: npm test

Vấn đề: endpoint checkout là chỗ chậm nhất hệ thống.
- server/routes/students.routes.js:445 gọi recalcInvoice trong vòng lặp
  cho từng HV cùng phòng.
- server/invoice-calc.js:71-89 — bản thân recalcInvoice là ~12 query
  TUẦN TỰ, phần lớn độc lập nhau (inv, s, fees, veh, leaderDays hoàn
  toàn không phụ thuộc nhau).
- server/invoice-calc.js:59-65 — studentElectric có N+1 rõ: vòng lặp gọi
  roomSegments, mà roomSegments (invoice-calc.js:22-42) tự nó là 3 query.
- Mỗi HV cùng phòng lại tính lại roomSegments cho CÙNG một phòng, CÙNG
  một tháng — lặp y hệt nhau, không memo.
Ước tính: phòng 6 người checkout có chốt chỉ số = ~85 round-trip nối
đuôi ≈ 2,5-4 giây.

THAM CHIẾU BẮT BUỘC ĐỌC TRƯỚC KHI SỬA:
server/routes/invoices.routes.js:87-202 (POST /invoices/generate) đã giải
đúng bài toán này rồi: nạp sẵn 8 truy vấn bulk (students,
electric_readings, meter_reads, room_stays, rooms, vehicles, room_leaders,
invoices) rồi tính toàn bộ trong JS. Xem comment ở dòng 146 và 159.
Nhiệm vụ của bạn là làm recalcInvoice học đúng pattern đó.

Nhiệm vụ:
1. Đọc và tóm tắt cho tôi cách generate bulk-load, TRƯỚC khi viết code.
2. Thiết kế hàm recalc theo lô (nhiều student_id + 1 tháng) dùng bulk
   load, thay cho vòng lặp gọi recalcInvoice từng người.
3. Trong đó: Promise.all cho các query độc lập; roomSegments tính 1 lần
   cho mỗi (phòng, tháng) rồi tái sử dụng.
4. Giữ nguyên hàm recalcInvoice cũ cho các chỗ gọi lẻ (1 người), hoặc
   cho nó gọi lại bản lô với 1 phần tử — bạn chọn, giải thích lý do.

RÀNG BUỘC TUYỆT ĐỐI: kết quả tính tiền phải GIỐNG HỆT bản cũ. Đây là
tiền thật của học viên.

Nghiệm thu (bắt buộc, không được bỏ):
- npm test pass, đặc biệt tests/unit/billing.test.js và
  tests/e2e/electric.test.js.
- Viết test đối chiếu: với cùng dữ liệu đầu vào, chạy bản CŨ và bản MỚI,
  assert mọi trường tiền khớp từng đồng. Bao gồm các ca biên: HV chuyển
  phòng giữa tháng, HV có ngày làm phòng trưởng, phòng có chốt chỉ số
  điện giữa kỳ, HV vào/ra giữa tháng.
- Đo và báo cáo số query thực tế trước/sau cho 1 lần checkout phòng 6
  người (đếm bằng cách log trong db.js hoặc pg event).
- Nếu không chứng minh được kết quả tiền khớp, DỪNG LẠI và báo tôi —
  đừng merge.
KHÔNG deploy.
```

---

## ĐỢT 4 — Database (index + retention)

Rủi ro: thấp-trung bình. Lưu ý schema.sql chạy lại mỗi lần khởi động.

```
Bối cảnh: repo tại c:\Users\thuyhien\quan-ly-ktx — PostgreSQL.
KHÔNG có hệ thống migration: server/schema.sql là file duy nhất, được
chạy lại MỖI LẦN khởi động (server/db.js:62) theo kiểu idempotent
(CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN IF NOT EXISTS).
Mọi thay đổi của bạn PHẢI idempotent, chạy lại nhiều lần không lỗi.
Lưu ý: CREATE INDEX CONCURRENTLY không chạy được trong khối
transaction/DO — với kích thước bảng hiện tại thì bỏ CONCURRENTLY đi,
khóa bảng vài chục ms không đáng kể.
Chạy test: npm test

Nhiệm vụ 1 — thêm index FK còn thiếu (đối chiếu lại với query thực tế
trong server/routes/*.js trước khi thêm, đừng tin danh sách này mù quáng):
  - damage_reports(student_id)      — dùng ở me.routes.js:116, requests.routes.js:17
  - checkout_requests(student_id)   — me.routes.js:137,152
  - users(student_id)               — students.routes.js:75,583, JOIN mỗi lần mở DS học viên
  - meter_reads(read_date)          — invoices.routes.js:107 quét dải ngày
  - logs(date DESC, id DESC)        — logs.routes.js:22 ORDER BY không có index
  - applications(student_id)

Nhiệm vụ 2 — xóa index trùng:
  meter_reads(room_id, read_date) đang có BA index giống hệt nhau:
  UNIQUE ở schema.sql:322, idx_meter_reads_room ở :324, và
  uq_meter_reads_room_date ở :400. Giữ UNIQUE gốc, bỏ 2 cái thừa.
  Xác minh lại bằng cách đọc schema trước khi drop.

Nhiệm vụ 3 — retention cho audit_log (việc quan trọng nhất đợt này):
  server/index.js:67 ghi 1 dòng cho MỖI request ghi. Không có bất kỳ cơ
  chế dọn nào trong toàn codebase (đã grep: không DELETE, không cron,
  không partition). Bảng tăng vô hạn tới khi hết dung lượng.
  Bảng chỉ được đọc bởi admin.routes.js:64 với LIMIT.
  Hãy ĐỀ XUẤT 2 phương án (ví dụ: dọn theo tuổi khi khởi động vs.
  partition theo tháng), nêu ưu nhược, rồi CHỜ tôi chọn trước khi code.

Nghiệm thu:
- npm test pass.
- Khởi động server 2 lần liên tiếp, xác nhận schema.sql chạy lại không lỗi.
- Báo cáo EXPLAIN trước/sau cho ít nhất 2 query hưởng lợi rõ nhất.
KHÔNG deploy.
```
