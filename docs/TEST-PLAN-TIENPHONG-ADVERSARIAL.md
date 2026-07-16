# BỘ TEST ĐỐI KHÁNG — TRANG TIỀN PHÒNG (Hóa đơn)

> **Phạm vi:** đúng một trang **Tiền phòng** (`viewInvoices`, `app.js:2291`) và toàn bộ đường API sau lưng nó:
> `invoices.routes.js` (11 endpoint), `electric.routes.js` (3 endpoint), lõi `billing.js` + `invoice-calc.js`,
> validate `valid.js`, ràng buộc `schema.sql`, và phần xuất CSV ở giao diện.
> Đây là **đường tiền** — sai ở đây là sai sổ sách thật, đối chiếu Bravo/kế toán lệch.

**Mục tiêu:** tìm cho ra lỗi, không xác nhận code chạy đúng như code được viết. Mỗi case ghi **ĐÚNG (nghiệp vụ)**
và **NGHI NGỜ (dự đoán app sai, kèm `file:line`)**. Hai cái lệch nhau = bug.

**Nhãn tin cậy:**
- 🔴 **XÁC NHẬN QUA CODE** — đã đọc code, gần như chắc chắn sai; chạy chỉ để lấy bằng chứng số.
- 🟠 **NGHI NGỜ MẠNH** — logic code cho thấy sẽ sai, cần chạy để chốt.
- 🟡 **CẦN ĐO** — biên/robustness, chưa chắc, phải chạy mới biết.

**Môi trường:** `http://localhost:3000` · **CHỈ LOCAL**. Không bắn một request nào lên `ktx-tnh.onrender.com`.
**Trước khi chạy:** `pg_dump` backup. Nhiều case ghi/sửa/xoá hóa đơn thật — dọn trong `finally`, tiền tố `__test_`.

**Mẹo gọi API:** app nhận `Authorization: Bearer <token>` chứ không chỉ cookie (`auth.js:27-28`).
Lấy token: đăng nhập admin → DevTools → Application → Cookies → `ktx_token`. Phần lớn case chỉ lòi ra khi
**gọi thẳng API** — giao diện chặn ở client, server không kiểm lại.

---

## HAI BẤT BIẾN — HỎNG CÁI NÀO LÀ MẤT TIỀN THẬT

1. **Tổng điện khớp tuyệt đối.** Cộng `electric_charge` của mọi người dùng chung một phòng trong một chặng
   phải **đúng bằng** tiền điện của phòng đó (kWh × đơn giá). Không dư, không hụt, kể cả 1 đồng, kể cả đơn giá lẻ.
2. **Không ai rơi khỏi lưới.** Người chuyển phòng / trả phòng giữa tháng vẫn trả phần điện đã dùng ở **phòng cũ**
   (TC-10). Người ở 1 ngày không trả bằng người ở cả tháng (TC-11).

Ngoài ra, một bất biến của **quy trình**: 3 đường sinh/sửa hóa đơn (`generate`, `recalc`, `PUT`) khi chạy trên
**cùng một dữ liệu** phải cho ra **cùng một `total`**. Nếu lệch nhau → có đường tính sai (xem Nhóm 2).

---

## NHÓM 1 — BẤT BIẾN CHIA TIỀN ĐIỆN (P0, regression cho TC-10/11/12)

`electric.test.js` đã canh phần lõi. Nhóm này canh thêm ở **đường HTTP thật** (`POST /generate`) và các biên.

### TP-01 · Tổng điện phòng khớp tuyệt đối khi đơn giá LẺ 🟠
- **Tiền đề:** 1 phòng 3 người ở trọn tháng, 100 kWh, đơn giá **3.500** (số lẻ, không chia hết cho 3).
- **Bước:** `POST /api/invoices/generate {month, readings:[{room_id, reading_start:0, reading_end:100}]}`.
- **Đúng:** 3 phiếu, tổng `electric_charge` = **350.000** đúng khít (vd 116.667 + 116.667 + 116.666).
- **Nghi ngờ:** thuật toán "phần dư lớn nhất" (`billing.js:83-91`) đúng, nhưng phải chạy để chắc tổng không ra
  350.001 hay 349.999. TC-12 từng là "lỗi ngủ" chỉ lộ khi đổi đơn giá sang số lẻ.
- **Mức độ:** Cao. Mỗi phòng lệch 1đ/tháng × 29 phòng × 12 tháng = sổ sách không bao giờ khớp Bravo.

### TP-02 · Người trả phòng giữa tháng — điện phòng cũ không rơi mất 🟠
- **Tiền đề:** Phòng A 3 người (A1, A2, X). Chốt công-tơ ngày 15 (`meter_reads`). X trả phòng 15/07.
  Phòng dùng 300 kWh: 150 nửa đầu, 150 nửa sau.
- **Bước:** `POST /generate` kỳ 2026-07.
- **Đúng:** X trả phần **nửa đầu** (150 kWh chia 3 = 50 kWh); A1, A2 trả nửa đầu (50) + nửa sau (75) mỗi người.
  Tổng cả 3 = 300 kWh × đơn giá.
- **Nghi ngờ:** phải kiểm `buildSegments` (`billing.js:100-134`) cắt chặng đúng ở ngày 15, và `studentElectric`
  (`invoice-calc.js:54-68`) cộng đúng phần X ở phòng cũ. Đây là TC-10 đã sửa — canh không cho tái phát.
- **Mức độ:** Chặn phát hành nếu sai (người ở lại gánh thay).

### TP-03 · Ở đúng 1 ngày không trả điện bằng người ở cả tháng 🟠
- **Tiền đề:** Phòng B, C3 vào 01/07 ra 01/07 (đúng 1 ngày), cùng 2 người ở trọn tháng. 310 kWh.
- **Đúng:** C3 trả phần điện của **1 ngày** (nhỏ), không phải 1/3 cả tháng.
- **Nghi ngờ:** `splitElectricByDays` chia theo `days` (`billing.js:81`) — kiểm C3.days=1 làm phần rất nhỏ.
  Đây là TC-11 đã sửa.
- **Mức độ:** Cao.

### TP-04 · Chuyển phòng giữa tháng — trả cả hai phòng, không sót không trùng 🟠
- **Tiền đề:** X ở phòng A (01→15/07) rồi chuyển sang phòng B (16→31/07). Cả A và B đều có chỉ số điện.
- **Đúng:** hóa đơn X = phần điện phòng A (nửa đầu) **+** phần điện phòng B (nửa sau). Tổng mỗi phòng vẫn khớp.
- **Nghi ngờ:** `studentElectric` quét `DISTINCT room_id FROM room_stays` (`invoice-calc.js:55-58`) — kiểm nó
  cộng đủ 2 phòng, không tính trùng ngày giao. Làm tròn TỪNG phòng riêng (`:64`) — kiểm tổng người = tổng 2 phần.
- **Mức độ:** Cao.

### TP-05 · Quên chốt công-tơ giữa kỳ → quay về chia đều cả tháng theo ngày ở 🟡
- **Tiền đề:** Có người chuyển đi giữa tháng nhưng **KHÔNG** nhập `meter_reads` giữa kỳ.
- **Đúng:** app chia cả tháng thành 1 chặng, theo số ngày ở (nghiệp vụ đã chốt: chốt chỉ số KHÔNG bắt buộc).
- **Nghi ngờ:** `buildSegments` không có mid-read → 1 chặng (`billing.js:123`). Kiểm không sập, không ra 0.
- **Mức độ:** Trung bình.

### TP-06 · Chỉ số chốt giữa kỳ MÂU THUẪN → fallback thay vì xuất số sai 🟡
- **Tiền đề:** Chốt giữa kỳ = 5000 nhưng chỉ số cuối tháng = 4000 (chốt giữa > cuối, dữ liệu vô lý).
- **Đúng:** phát hiện mâu thuẫn, quay về chia cả tháng (`fellback:true`), KHÔNG xuất kWh âm.
- **Nghi ngờ:** `billing.js:129-132` cờ `bad` bắt `kwh<0` hoặc tổng chặng lệch >0.05. Kiểm nó bắt được ca này.
- **Mức độ:** Trung bình.

---

## NHÓM 2 — BA ĐƯỜNG SỬA HÓA ĐƠN MÂU THUẪN & KHÓA "ĐÃ THU" (P0)

Đây là nhóm **nặng nhất** — tôi đã xác nhận qua code, không phải đoán.

### TP-07 · Nút "Tính lại" (recalc) QUA MẶT khóa "đã thu" 🔴
- **Tiền đề:** 1 hóa đơn `status='paid'` (đã chốt với Bravo), total 1.200.000.
- **Bước:** đổi số ngày ở của HV (hoặc chỉ số điện) rồi `POST /api/invoices/:id/recalc`. Hoặc bấm nút refresh
  hiện **trên mọi dòng kể cả đã thu** (`app.js:2346`).
- **Đúng:** từ chối như PUT — "Hóa đơn đã thu, không sửa".
- **Nghi ngờ:** **200, total đổi.** `recalcInvoice` (`invoice-calc.js:72-107`) **không kiểm `status`** trước khi
  `UPDATE`. Trong khi `PUT /:id` chặn paid rõ ràng (`invoices.routes.js:313`). Cùng mục tiêu (khóa số đã thu),
  hai đường một đường hở. Đây đúng là lỗ TC-02 định vá — vá được ở PUT, quên recalc.
- **Mức độ:** **Chặn phát hành.** Số đã chốt với Bravo đổi sau lưng qua một nút bấm.

### TP-08 · Sửa hóa đơn (PUT) làm TỔNG lệch khỏi khoản GIẢM đang hiển thị 🔴
- **Tiền đề:** hóa đơn có `leader_discount=150.000` (phòng trưởng) hoặc `room_discount`. Total hiện tại đã trừ giảm.
- **Bước:** `PUT /api/invoices/:id` sửa 1 khoản bất kỳ (vd `other_note`), gửi lại các charge như cũ.
- **Đúng:** total = tổng phí **− các khoản giảm**, giữ đúng con số ròng.
- **Nghi ngờ:** total tăng vọt đúng bằng khoản giảm. `PUT` tính `total = Σ 7 khoản phí` (`invoices.routes.js:314-315`)
  **KHÔNG trừ** `leader_discount`/`room_discount`, và hai cột đó **không nằm trong SET** (`:317-319`) nên giữ giá trị cũ.
  Kết quả: cột "Giảm" vẫn hiện `−150.000` (`app.js:2340`) nhưng total **không** trừ nó nữa → dòng tự mâu thuẫn.
  Trong khi `generate` (`:182-183`) và `recalc` (`invoice-calc.js:96-97`) **có** trừ. **Ba đường, ba kết quả total.**
- **Mức độ:** **Chặn phát hành.** Thu dư của HV được giảm giá; hoặc sổ ghi một đằng, phiếu một nẻo.

### TP-09 · Xóa hóa đơn ĐÃ THU → tụt tổng "đã thu", không chặn ở server 🔴
- **Tiền đề:** hóa đơn `paid` 3.000.000.
- **Bước:** `DELETE /api/invoices/:id`.
- **Đúng:** chặn (hoặc ít nhất cảnh báo + ghi vết đặc biệt), vì xóa một khoản đã thu là xóa doanh thu đã ghi nhận.
- **Nghi ngờ:** **200, xóa mềm bất kể status** (`invoices.routes.js:364-366`). Biến khỏi mọi GET
  (`WHERE deleted_at IS NULL`, `:46`) → tổng "đã thu" ở thẻ đầu trang (`app.js:2314`) tụt. Server không hỏi
  (chỉ có `confirm()` phía UI, `:2364`).
- **Mức độ:** Cao.

### TP-10 · Chuỗi flip trạng thái qua mặt khóa "đã thu" 🟠
- **Bước:** hóa đơn `paid` → `POST /:id/status {status:'pending'}` → `PUT /:id` sửa total xuống 1đ →
  `POST /:id/status {status:'paid'}`.
- **Đúng:** mỗi bước để lại vết ĐỦ để tra ra "số đã đổi từ X xuống Y bởi ai".
- **Nghi ngờ:** cả chuỗi 200. Audit (`index.js:96-99`) ghi 3 dòng nhưng **chỉ lưu body request**, không lưu giá trị
  total **trước/sau** → nhìn nhật ký không biết số tiền đã bị hạ. Khóa "đã thu" bị vòng qua hợp lệ.
- **Mức độ:** Cao. `status` endpoint chỉ cần role staff (`:11`) — nhân viên thường làm được cả chuỗi.

### TP-11 · Hai đường tính cùng dữ liệu phải ra cùng total 🟠
- **Bước:** với 1 HV có giảm phòng trưởng: gọi `POST /:id/recalc`, ghi lại total. Rồi `POST /generate` cả kỳ,
  đọc lại total của HV đó. Rồi mở nút bút chì, `PUT` y nguyên các số.
- **Đúng:** ba total bằng nhau.
- **Nghi ngờ:** recalc = generate (đều trừ giảm), nhưng PUT ≠ (không trừ — xem TP-08). Chốt bằng số cụ thể.
- **Mức độ:** Cao (là cách chứng minh gọn cho TP-08).

---

## NHÓM 3 — VALIDATE ĐẦU VÀO HÓA ĐƠN (P0/P1)

### TP-12 · Kỳ (month) rác 🔴 (đã vá — canh regression)
- **Bước:** `POST /api/invoices {student_id, month:"2026-13"}` · `"xyz"` · `"9999-99"` · `""`.
- **Đúng:** 400 tất cả.
- **Nghi ngờ:** `isValidMonth` (`valid.js:26-31`) chặn ở `POST /` (`:270`), `/generate` (`:67`), `/generate-one` (`:223`).
  Đây là chốt đã có — canh không ai gỡ. Bổ sung: DB có `ck_invoices_month` (`schema.sql:419-421`) **nhưng chỉ từ
  boot lần 2** (xem TP-40). Kiểm cả tầng API lẫn tầng DB.
- **Mức độ:** Cao (kỳ "xyz" làm hỏng ràng buộc 1-HV-1-phiếu và ô chọn năm báo cáo).

### TP-13 · Tiền âm gọi thẳng API 🔴 (đã vá ở API — canh regression + boot-1)
- **Bước:** `POST /api/invoices {..., room_charge:-99999999}` · `PUT` với `electric_charge:-5000000`.
- **Đúng:** 400.
- **Nghi ngờ:** `badMoney` (`invoices.routes.js:16-24`) chặn ở cả POST (`:271`) và PUT (`:308`). Canh regression.
  **CẢNH BÁO prod:** tuyến phòng thủ DB `ck_invoices_no_negative` (`schema.sql:412-418`) **không tồn tại ở lần boot
  đầu của CSDL trắng** — nếu ai đó gỡ `badMoney` sau này, trên prod ngày go-live tiền âm sẽ lọt. Xem TP-40.
- **Mức độ:** Cao.

### TP-14 · `days_stayed` vô lý — không có trần 🟡
- **Bước:** `POST /api/invoices {..., days_stayed:99999}` cho kỳ 30 ngày. Và `days_stayed:0` với tiền phòng > 0.
- **Đúng:** 400 hoặc kẹp về số ngày thật của tháng; ít nhất cảnh báo days > số ngày trong tháng.
- **Nghi ngờ:** lưu tuốt. `badMoney` chỉ chặn `<0` và không-phải-số (`:21`), **không có trần**. `days_stayed` nhập
  tay không hề ràng buộc với `check_in/check_out`. Phơi bày: hóa đơn lẻ nhập tay có thể ghi "ở 99999 ngày".
- **Mức độ:** Trung bình.

### TP-15 · `electric_kwh` và `electric_charge` mâu thuẫn nội tại 🟡
- **Bước:** `POST /api/invoices {..., electric_kwh:0, electric_charge:500000}` và ngược lại `kwh:1000, charge:0`.
- **Đúng:** hoặc chặn, hoặc buộc nhất quán (charge = kwh × đơn giá).
- **Nghi ngờ:** lưu cả hai; `total` chỉ cộng `electric_charge` (`:275-276`), `electric_kwh` chỉ để hiển thị.
  Phiếu hiện "0 kWh — 500.000đ" hoặc "1000 kWh — 0đ". HV khiếu nại là đúng.
- **Mức độ:** Thấp–TB.

### TP-16 · `other_charge` khổng lồ / `total` không kiểm trần 🟡
- **Bước:** `POST` với `other_charge: 9e14` (trong ngưỡng NUMERIC(12,0) hay tràn?).
- **Đúng:** kiểm trần hợp lý, hoặc báo lỗi rõ khi vượt kiểu cột.
- **Nghi ngờ:** `total` là `NUMERIC(12,0)` (schema) — số > 12 chữ số → lỗi DB → 500 thô thay vì 400 thân thiện.
- **Mức độ:** Thấp.

---

## NHÓM 4 — CHỈ SỐ CÔNG-TƠ & MẺ LẬP HÓA ĐƠN (P0)

### TP-17 · Một phòng đảo chỉ số → CẢ MẺ generate sập 500 🟠
- **Tiền đề:** công-tơ 1 phòng vừa thay (số mới nhỏ hơn số cũ): `reading_start:9000, reading_end:100`.
- **Bước:** `POST /api/invoices/generate` với readings gồm phòng đó lẫn vào các phòng bình thường.
- **Đúng:** phòng đó xử lý riêng (kWh=0 hoặc hỏi lại), các phòng khác vẫn ra hóa đơn.
- **Nghi ngờ:** **500, ROLLBACK cả mẻ, KHÔNG phiếu nào ra.** `generate` lưu `reading_start/end` như nhập
  (`invoices.routes.js:79-86`), DB có `ck_electric_sane CHECK (reading_end >= reading_start)` (`schema.sql:429-430`)
  → INSERT vi phạm → `catch` ROLLBACK (`:210-212`). Một phòng thay công-tơ làm hỏng hóa đơn cả KTX tháng đó.
- **Mức độ:** Cao. (Trên DB **boot-1** không có CHECK → ngược lại: lọt, kWh=0 âm thầm, kéo lệch kỳ sau — N-04.)

### TP-18 · `POST /electric/bulk` lưu NỬA CHỪNG khi 1 phòng lỗi 🟠
- **Bước:** lưu chỉ số nhiều phòng, phòng ở giữa đảo số.
- **Đúng:** all-or-nothing hoặc bỏ qua phòng lỗi + báo rõ.
- **Nghi ngờ:** `electric.routes.js:62-80` lặp `query()` **không transaction** → phòng lỗi ném 500, các phòng
  **trước đó đã lưu**. Nhập lại đè lộn xộn (kiểu TC-36). `generate` thì có transaction (`:70`), `bulk` thì không.
- **Mức độ:** Cao.

### TP-19 · `GET /api/electric` thiếu `month` → 500 thô 🟡
- **Bước:** `GET /api/electric` (không kèm `?month=`).
- **Đúng:** 400 "thiếu kỳ".
- **Nghi ngờ:** `prevMonth(undefined)` → `undefined.split` → TypeError → 500 (`electric.routes.js:9-13,19`).
- **Mức độ:** Thấp (UI luôn gửi month, nhưng đường API trần thì hở).

### TP-20 · Chỉ số điện âm / phi số qua bulk 🟡
- **Bước:** `POST /electric/bulk {readings:[{room_id, reading_end:"abc"}]}` · `reading_end:-50`.
- **Đúng:** 400.
- **Nghi ngờ:** `+r.reading_end || 0` (`:70`) biến `"abc"`→0, `-50`→-50 rồi `Math.max(0,...)`. Không validate,
  chỉ ép kiểu. `"abc"` âm thầm thành 0 kWh (mất tiền điện phòng đó), không cảnh báo.
- **Mức độ:** Trung bình.

### TP-21 · Số điện trọn tháng gọn — kiểm tổng KHỚP kWh phòng 🟡
- **Bước:** phòng 4 người ở đều, 217 kWh, đơn giá 3000.
- **Đúng:** Σ electric_charge 4 người = 217 × 3000 = 651.000 đúng khít.
- **Nghi ngờ:** chốt lại bất biến 1 ở ca không-có-chuyển-phòng, đơn giá chẵn (đề phòng hồi quy làm tròn).
- **Mức độ:** Trung bình.

---

## NHÓM 5 — THU TIỀN, TRẠNG THÁI & MÚI GIỜ (P0)

### TP-22 · `mark-paid` — chốt lại các lớp bảo vệ đã thêm 🔴 (regression TC-01)
- **Bước:** `POST /api/invoices/mark-paid {}` (body rỗng) · `{month:"2026-07"}` (thiếu confirm) ·
  gọi bằng tài khoản **staff** · `{month:"toàn-bộ"}`.
- **Đúng:** body rỗng/kỳ sai → 400; thiếu confirm → 400 kèm số phiếu sẽ đổi; staff → 403.
- **Nghi ngờ:** đã vá (`invoices.routes.js:332-341`, `requireRole('admin')` + regex kỳ + `confirm:true`).
  **Canh không cho tái phát** — đây từng là lỗi số 1 (134 phiếu/3 kỳ thành "đã thu" bằng 1 request rỗng).
- **Mức độ:** Chặn phát hành nếu hồi quy.

### TP-23 · Ngày thu tiền (`paid_date`) lệch 1 ngày do UTC 🔴
- **Tiền đề:** máy chủ chạy TZ=UTC (mặc định Render — Dockerfile/render.yaml không đặt TZ).
- **Bước:** lúc **00:30 sáng giờ VN** ngày 01/08, `POST /:id/status {status:'paid'}` (không kèm `date`).
- **Đúng:** `paid_date = 2026-08-01`.
- **Nghi ngờ:** `= 2026-07-31`. `new Date().toISOString().slice(0,10)` (`invoices.routes.js:342` và `:353`) là
  ngày **UTC**. 00:00–07:00 giờ VN mỗi ngày ghi lùi 1 ngày → ngày thu tiền vênh, đối chiếu Bravo/kế toán sai kỳ.
- **Mức độ:** Cao (xảy ra HÀNG NGÀY trên prod, 7 tiếng mỗi ngày). Test bằng cách chạy container `-e TZ=UTC` rồi
  đặt giờ, hoặc gọi lúc rạng sáng.

### TP-24 · `status` nhận giá trị lạ → âm thầm về 'pending' 🟡
- **Bước:** `POST /:id/status {status:"PAID"}` (hoa) · `{status:"đã thu"}` · `{status:"deleted"}`.
- **Đúng:** 400 "trạng thái không hợp lệ".
- **Nghi ngờ:** ép về `'pending'` im lặng (`invoices.routes.js:352` whitelist rồi fallback pending). Gõ nhầm hoa/thường
  làm hóa đơn tưởng đã thu bị lật về chưa thu mà không báo. (So với `depositRefundEligible`/`SEV()` cùng kiểu ép ngầm.)
- **Mức độ:** Trung bình.

### TP-25 · `mark-paid` cũng lật cả phiếu 'sent' 🟡
- **Bước:** kỳ có phiếu `sent` (đã gửi QR chờ thu). `mark-paid {month, confirm:true}`.
- **Đúng:** rõ ràng cho người dùng biết 'sent' cũng thành 'paid'.
- **Nghi ngờ:** `WHERE status<>'paid'` (`:344`) gộp cả `sent` → đánh thu cả phiếu chưa thật sự thu tiền. Đúng ý?
  Cần xác nhận nghiệp vụ.
- **Mức độ:** Thấp–TB (câu hỏi nghiệp vụ hơn là bug).

---

## NHÓM 6 — HIỂN THỊ, PHIẾU BÁO & XUẤT FILE (P0/P1)

### TP-26 · CSV chạy như CÔNG THỨC trong Excel 🔴 (TC-45 chưa vá)
- **Bước:** đặt tên HV = `=1+1` (hoặc `=cmd|'/c calc'!A1`, `@SUM(...)`, `+1`, `-1+1`). Lập hóa đơn → trang Tiền phòng
  → **Xuất Excel (CSV)**. Mở bằng Excel.
- **Đúng:** ô hiện đúng văn bản `=1+1`, không tính toán.
- **Nghi ngờ:** Excel chạy công thức. `exportCSV` (`app.js:2586`) chỉ `"${String(c).replace(/"/g,'""')}"` — bọc ngoặc
  kép nhưng **không chèn ký tự chặn** (`'`) trước `= + - @`. Kế toán/sếp mở file dính. `\r\n` + BOM đã có, chỉ thiếu
  chốt injection.
- **Mức độ:** Cao (đường tấn công qua tên HV do người ngoài tự nhập ở `/dang-ky`).

### TP-27 · Cột "Điện (kWh)" hiện kWh CẢ PHÒNG, không phải phần của HV 🔴
- **Tiền đề:** phòng 3 người, 300 kWh.
- **Bước:** xem trang Tiền phòng và **Phiếu báo** của 1 HV; xuất CSV.
- **Đúng:** dòng điện của HV hiển thị kWh **tương ứng phần họ trả** (≈100), hoặc ghi rõ "300 kWh cả phòng, phần bạn 1/3".
- **Nghi ngờ:** hiện **300 kWh** cho mỗi người nhưng chỉ thu tiền 1/3. `computeInvoice` trả `electric_kwh =
  Number(kwh||0)` = kWh **cả phòng** (`billing.js:205`; `kwh=kwhByRoom[room_id]`). Hiển thị `${i.electric_kwh} kWh`
  (`app.js:2335`) và cột CSV "Dien (kWh)" (`:2584`). HV đọc "300 kWh → sao chỉ trả 100k?" → tưởng app tính sai.
- **Mức độ:** Cao (gây khiếu nại hàng loạt dù tiền đúng).

### TP-28 · Thẻ "Tổng tiền phiếu (dự báo)" cộng cả phiếu ĐÃ XÓA? 🟡
- **Bước:** xóa 1 hóa đơn (soft) → xem lại thẻ tổng và số phiếu ở đầu trang.
- **Đúng:** tổng & đếm bỏ phiếu đã xóa.
- **Nghi ngờ:** `all` lấy từ `API.invoices(invMonth)` đã lọc `deleted_at IS NULL` (`:46`) → có vẻ đúng. Kiểm để chắc
  `total`/`paid` (`app.js:2313-2314`) không lệch sau xóa.
- **Mức độ:** Thấp (nhiều khả năng PASS — vẫn nên đo).

### TP-29 · Phiếu báo cho HV không phòng / kỳ chưa có chỉ số 🟡
- **Bước:** HV `room_id=null` → `generate-one`; và HV ở phòng chưa nhập điện kỳ đó.
- **Đúng:** điện = 0, không sập, phiếu vẫn ra.
- **Nghi ngờ:** `studentElectric` trả null → về nhánh roster/occupants (`billing.js:186-192`). Kiểm không lỗi.
- **Mức độ:** Thấp.

---

## NHÓM 7 — BIÊN NGHIỆP VỤ TÍNH TIỀN (P1)

### TP-30 · Hệ số phí cố định ở đúng ngưỡng nửa tháng 🟡
- **Tiền đề:** `partial_half_min` và `partial_full_min` (Cài đặt). HV ở đúng **bằng** `partial_half_min` ngày.
- **Đúng:** rõ ràng theo quy tắc: `≤ half → 0`, `> half → 0.5`.
- **Nghi ngờ:** `partialFactor` dùng `days > halfMin` (`billing.js:45`) — tại **bằng** ngưỡng thì **factor=0**
  (mất nước+dịch vụ). Người ở đúng 15 ngày (nếu half=15) bị tính 0 nước — đúng ý hay lệch 1 ngày? Assert biên.
- **Mức độ:** Trung bình.

### TP-31 · Giảm phòng trưởng đổi trưởng giữa tháng — tổng giảm = ĐÚNG MỘT suất 🟡
- **Tiền đề:** trưởng cũ làm 20 ngày, trưởng mới 11 ngày (cùng tháng 31 ngày).
- **Đúng:** tổng `leader_discount` hai người = đúng một suất (không phát thành 2).
- **Nghi ngờ:** `leaderDiscount` tính theo tỉ lệ ngày (`billing.js:227-231`), nạp `leaderDaysByStudent` cộng qua
  nhiều nhiệm kỳ (`invoices.routes.js:149-158`). Kiểm không ai bị âm, tổng không vượt (nước+dịch vụ).
- **Mức độ:** Trung bình.

### TP-32 · Giảm tiền phòng % = 100 → tiền phòng ròng 0, KHÔNG âm 🟡
- **Bước:** HV `room_fee_discount_pct=100` → generate.
- **Đúng:** `room_discount = room_charge`, total ≥ 0.
- **Nghi ngờ:** `pct` kẹp 0..100 (`billing.js:167`), `room_discount = r0(room_charge*pct/100)` (`:168`). Kiểm total
  không âm khi cộng dồn mọi khoản giảm. (Ràng buộc `ck_invoices_no_negative` chỉ chặn từng cột giảm ≥0, không chặn total.)
- **Mức độ:** Trung bình.

### TP-33 · Thuê "nguyên phòng" giá theo hạng vs thuê ghép giá/người 🟡
- **Bước:** HV `rental_type='phong'` phòng hạng A; và HV thuê ghép phòng chưa đặt `monthly_fee`.
- **Đúng:** nguyên phòng → `room_price_A`; ghép, phòng chưa đặt giá → đơn giá `room_fee` Cài đặt (KHÔNG phải 0).
- **Nghi ngờ:** `billing.js:154-161` — nhánh `monthly_fee>0 ? monthly_fee : room_fee`. Đây là lỗi cũ "thuê ghép
  bị tính 0" đã sửa (commit #23) — canh regression. Lưu ý CLAUDE.md: form đăng ký mới **đã ẩn** "thuê nguyên phòng".
- **Mức độ:** Trung bình.

### TP-34 · Số xe tính theo THÁNG lập hóa đơn, không phải hôm nay 🟡
- **Tiền đề:** HV có 1 xe đăng ký 06/2026, gỡ (`to_date`) 20/07/2026. Lập lại hóa đơn tháng 06.
- **Đúng:** tháng 06 vẫn tính 1 xe (xe còn hiệu lực tháng đó).
- **Nghi ngờ:** `vehicleCount.countForMonth` dùng `from_date/to_date` theo tháng (`vehicle-count.js:8-15`) — đây là
  V2-20/23 đã sửa. Kiểm tính lại tháng cũ không lấy số xe hôm nay.
- **Mức độ:** Trung bình.

---

## NHÓM 8 — ĐỒNG THỜI & TOÀN VẸN (P1)

### TP-35 · `generate-one` gặp race UNIQUE → 500 thay vì 400 🟠
- **Bước:** hai request `POST /generate-one` cùng `{student_id, month}` **song song**.
- **Đúng:** một cái tạo, cái kia báo "đã có hóa đơn" (400) hoặc cập nhật.
- **Nghi ngờ:** `generate-one` INSERT không **catch `23505`** (`invoices.routes.js:251-259`) — khác `POST /` có catch
  (`:299`). Va UNIQUE(student_id,month) → 500 trần.
- **Mức độ:** Trung bình.

### TP-36 · `generate` cả kỳ chạy 2 lần đồng thời 🟡
- **Bước:** bấm "Tạo hóa đơn theo tháng" hai lần liền / hai tab.
- **Đúng:** không trùng phiếu, không double tiền (TC-48 từng PASS — canh lại).
- **Nghi ngờ:** mỗi lần là 1 transaction (`:70`), UNIQUE đỡ trùng; nhưng hai transaction cùng UPDATE có thể deadlock
  hoặc phiếu cuối ghi đè. Đo thời gian + kết quả.
- **Mức độ:** Thấp–TB.

### TP-37 · `recalc` một hóa đơn trong khi `generate` cả kỳ đang chạy 🟡
- **Bước:** chạy `generate` (nặng) rồi lập tức `recalc` cùng HV.
- **Đúng:** kết quả cuối nhất quán, không nửa nạc nửa mỡ.
- **Nghi ngờ:** recalc dùng `query` autocommit, generate dùng client transaction — thứ tự commit quyết định số cuối.
- **Mức độ:** Thấp.

---

## NHÓM 9 — RỦI RO CHỈ BÙNG NỔ TRÊN PROD (đọc kèm, không test được ở local thường)

### TP-38 · Chỉ số điện lùi làm lệch DÂY CHUYỀN sang kỳ sau (N-04) 🟠
- **Bối cảnh:** trên **DB boot-1** (prod ngày đầu, chưa có `ck_electric_sane`), nhập `reading_start:5000,
  reading_end:4000` → kWh=0 nhưng **vẫn lưu reading_end=4000**. Kỳ sau lấy 4000 làm `reading_start`
  (`electric.routes.js:23`, `invoices.routes.js:78-79`) → mọi kỳ tiếp theo lệch.
- **Đúng:** chặn chỉ số lùi ngay tại API (không chỉ dựa CHECK của DB, vì boot-1 chưa có).
- **Mức độ:** Cao trên prod.

### TP-39 · Tiền điện = 0 toàn app nếu đơn giá điện lỗi 🔴 (regression TC-04)
- **Bước:** `PUT /api/settings {electric_unit:"abc"}` · `-1000` · `""`.
- **Đúng:** 400.
- **Nghi ngờ:** `checkSetting` (`valid.js:49-59`, `SETTING_NUM.electric_unit {min:0,max:1000000}`) chặn ở
  `settings.routes.js`. Đây là TC-04 đã vá — **canh regression** vì nó điều khiển TOÀN BỘ tiền điện. Gõ nhầm 1 ký tự
  → mọi hóa đơn điện = 0.
- **Mức độ:** Chặn phát hành nếu hồi quy.

### TP-40 · Ràng buộc tiền-âm/kỳ-hợp-lệ KHÔNG áp ở boot đầu của CSDL trắng 🔴
- **Bối cảnh:** khôi phục `pg_dump` vào CSDL trắng (kịch bản sau sự cố) → `schema.sql` boot lần 1 áp
  `ck_invoices_no_negative`/`ck_invoices_month` **TRƯỚC** khi cột `leader_discount`/`room_discount` được tạo
  (`schema.sql:412-421` chạy trước `:475,481`) → lỗi nuốt vào `schema_guard`, ràng buộc **không tồn tại**.
- **Bước test (bản sao):** `createdb probe && psql -f server/schema.sql` (1 lần) → `SELECT * FROM schema_guard`
  (phải rỗng, thực tế có dòng) → thử INSERT hóa đơn tiền âm (phải chặn, thực tế lọt).
- **Đúng:** ràng buộc có đủ ngay lần boot đầu.
- **Mức độ:** Chặn phát hành (cửa sổ nguy hiểm rơi đúng ngày go-live / ngày khôi phục sự cố).

---

## GỢI Ý ĐƯA VÀO BỘ TEST TỰ ĐỘNG (`npm test`)

Ưu tiên biến các case 🔴 thành e2e/unit để canh vĩnh viễn (12 lỗi đã sửa hiện **không có lưới**):

| Case | Kiểu | Ghi chú |
|---|---|---|
| TP-07 (recalc qua mặt khóa) | e2e | tạo phiếu paid → recalc → phải 400/không đổi |
| TP-08 / TP-11 (PUT không trừ giảm) | e2e | phiếu có leader_discount → PUT → assert total trừ giảm |
| TP-01 / TP-21 (bất biến tổng điện) | unit `billing` | mở rộng `billing.test.js` với đơn giá lẻ, 4 người |
| TP-13 / TP-39 (tiền âm, đơn giá điện) | e2e | canh regression TC-04/03 ở tầng **API** (hiện chỉ canh tầng DB) |
| TP-17 / TP-18 (đảo chỉ số) | e2e `electric` | một phòng lỗi không được giết cả mẻ / lưu nửa chừng |
| TP-26 (CSV injection) | unit | tách `csvCell()` ra hàm thuần, test chặn `= + - @` |
| TP-40 (boot-1) | script | `psql -f schema.sql` 1 lần rồi kiểm `schema_guard` rỗng |

---

## THỨ TỰ CHẠY ĐỀ NGHỊ (nếu chỉ có nửa ngày)

1. **TP-07, TP-08, TP-09** — ba lỗ khóa "đã thu" / tính total, đã xác nhận qua code, chạy để lấy số.
2. **TP-01, TP-02, TP-04** — bất biến tổng điện + chuyển phòng (đường tiền, chặn phát hành).
3. **TP-17, TP-18** — robustness mẻ generate (một phòng thay công-tơ làm sập cả KTX).
4. **TP-26, TP-27** — hai lỗi hiển thị/xuất file gây khiếu nại và rủi ro Excel.
5. **TP-23, TP-40, TP-39** — ba rủi ro prod-only (đọc kèm bảng CLAUDE.md "4 rủi ro go-live").
