# KẾT QUẢ TEST ĐỐI KHÁNG — TRANG TIỀN PHÒNG (Hoá đơn)

**Ngày:** 17/07/2026 · **Phiên bản:** v79 · **Môi trường:** `http://localhost:3000` (LOCAL, Docker DB).
**Không một request nào chạm `ktx-tnh.onrender.com`.** Mọi dữ liệu test tiền tố `__test_`, đã dọn — CSDL về đúng **205 HV, 0 rác**.

> Chị dặn kiểu cũ: **test và báo lỗi trước, fix sau.** Báo cáo này không sửa code.

---

## Tổng hợp

| | Số case |
|---|---|
| ❌ FAIL (lỗi thật) | **15** |
| ✅ PASS (regression giữ được) | 6 (TP-01, TP-02, TP-12, TP-13, TP-22, TP-39) |
| ⚠️ Chưa chạy / không đo được ở local | phần còn lại (xem cuối) |

**Nhóm nặng nhất — Nhóm 2 (khoá "đã thu" & tính total): 5/5 FAIL, đều đường tiền, đề bài đã xác nhận qua code và em chạy lấy số thật.**

---

## 🔴 NHÓM 2 — KHOÁ "ĐÃ THU" HỞ & BA ĐƯỜNG TÍNH LỆCH (chặn phát hành)

### TP-07 · Nút "Tính lại" qua mặt khoá "đã thu"
Phiếu **đã thu** (paid) total **1.700.000**. Đổi chỉ số điện phòng rồi bấm **Tính lại** (recalc):
```
POST /invoices/:id/recalc → HTTP 200 (KHÔNG chặn)
total: 1.700.000 → 3.100.000   (đổi SAU LƯNG)
```
`recalcInvoice` (invoice-calc.js) **không kiểm `status`** trước khi UPDATE — trong khi `PUT /:id` chặn paid rõ ràng. Số đã chốt với Bravo bị đổi qua một nút bấm.

### TP-08 · Sửa hoá đơn (PUT) không trừ khoản GIẢM
Phiếu phòng trưởng: total **1.200.000**, giảm phòng trưởng **150.000**. Bấm bút chì sửa (PUT) gửi lại y nguyên các số:
```
total: 1.200.000 → 1.350.000   (tăng ĐÚNG BẰNG khoản giảm)
```
PUT tính `total = tổng 7 khoản phí`, **không trừ** `leader_discount`/`room_discount`, và hai cột đó không nằm trong SET nên giữ giá trị cũ. Kết quả: cột "Giảm" vẫn hiện **−150.000** nhưng total **không** trừ nó → **phiếu tự mâu thuẫn, HV được giảm bị thu dư**.

### TP-11 · Ba đường ra ba total (hệ quả TP-08)
Cùng một hoá đơn, cùng dữ liệu:
```
recalc  = 1.200.000
generate= 1.200.000
PUT     = 1.350.000   ← lệch
```

### TP-09 · Xoá hoá đơn ĐÃ THU
```
DELETE /invoices/:id (phiếu paid) → HTTP 200, deleted_at đã set
```
Không kiểm `status`. Phiếu biến khỏi mọi màn hình → **tổng "đã thu" tụt, doanh thu đã ghi nhận biến mất**, server không hỏi.

### TP-10 · Chuỗi flip trạng thái — nhật ký không tra ra số bị hạ
`paid → pending → PUT total xuống 1đ → paid`: cả chuỗi **200/200/200**. Nhật ký ghi 3 dòng nhưng **chỉ lưu body request, không lưu total trước/sau** → nhìn nhật ký **không biết** tiền đã bị hạ từ **1.200.000 xuống 1đ**. Endpoint `status` chỉ cần role **staff**.

---

## 🟠 NHÓM 4 — CÔNG-TƠ & MẺ LẬP HOÁ ĐƠN

### TP-17 · Một phòng đảo chỉ số → CẢ MẺ generate sập
Công-tơ 1 phòng vừa thay (số mới < cũ: 9000→100). Lập hoá đơn cả kỳ gồm phòng đó lẫn phòng bình thường:
```
POST /invoices/generate → HTTP 500, ROLLBACK cả mẻ, 0 phiếu nào ra
```
`ck_electric_sane` (DB) chặn `reading_end < reading_start` → INSERT vi phạm → ROLLBACK. **Một phòng thay công-tơ làm hỏng hoá đơn cả KTX tháng đó.**

### TP-18 · `POST /electric/bulk` lưu NỬA CHỪNG
Lưu chỉ số nhiều phòng, phòng giữa đảo số:
```
HTTP 500 · phòng TRƯỚC lỗi: đã lưu · phòng SAU lỗi: chưa lưu
```
`bulk` lặp `query()` **không transaction** (khác `generate` có transaction). Lưu dở dang, nhập lại đè lộn xộn.

### TP-19 · `GET /api/electric` thiếu `month` → 500 thô
`prevMonth(undefined)` → TypeError → 500 thay vì 400 "thiếu kỳ".

### TP-20 · Chỉ số điện "abc" / âm qua bulk
```
reading_end:"abc" → HTTP 200, âm thầm thành 0 kWh (MẤT tiền điện phòng đó)
reading_end:-50   → HTTP 500
```
`+r.reading_end || 0` chỉ ép kiểu, không validate.

---

## 🟡 NHÓM 3 — VALIDATE ĐẦU VÀO

### TP-14 · `days_stayed` không có trần
`POST /invoices {days_stayed:99999}` cho tháng 31 ngày → **HTTP 201, lưu 99999 ngày**. `badMoney` chỉ chặn `<0`, không có trần, không ràng buộc với check-in/check-out.

### TP-15 · `electric_kwh` và `electric_charge` mâu thuẫn
`{electric_kwh:0, electric_charge:500000}` → **201, lưu cả hai**. Phiếu hiện "0 kWh — 500.000đ". HV khiếu nại là đúng.

---

## 🟡 NHÓM 5 — TRẠNG THÁI

### TP-24 · `status="PAID"` (hoa) → âm thầm về pending
Phiếu đang **paid**, gửi `{status:"PAID"}` (viết hoa) → **HTTP 200, status thành "pending"**. Whitelist rồi fallback pending → **gõ nhầm hoa/thường làm phiếu đã thu lật về chưa thu mà không báo**.

---

## 🔴 NHÓM 6 — HIỂN THỊ & XUẤT FILE

### TP-26 · CSV chạy như CÔNG THỨC trong Excel
`exportCSV` (app.js:2585) và CSV doanh thu (app.js:1785) bọc ngoặc kép + escape `"` nhưng **không chèn ký tự chặn** (`'`) trước `= + - @`. Tên HV = `=1+1` (người ngoài tự nhập ở `/dang-ky`) → mở file bằng Excel **chạy công thức**. Đường tấn công qua tên HV.

### TP-27 · Cột "Điện (kWh)" hiện kWh CẢ PHÒNG
Phòng 300 kWh, 3 người ở đều:
```
Mỗi phiếu: electric_kwh = 300 (cả phòng) · tiền điện = 350.000 (phần 100 kWh của họ)
```
Hiển thị "300 kWh" nhưng chỉ thu phần 1/3. HV đọc "300 kWh sao chỉ trả 350k?" → **tưởng app tính sai → khiếu nại hàng loạt dù tiền đúng**.

---

## 🟠 NHÓM 8 — ĐỒNG THỜI

### TP-35 · `generate-one` gặp race → 500
Hai request `generate-one` cùng `{student_id, month}` song song → **một cái 500** (UNIQUE `23505` không được catch; `POST /` thì có catch).

---

## ✅ REGRESSION VẪN GIỮ ĐƯỢC (các lần vá trước không bị gỡ)

- **TP-01** đơn giá lẻ 3500 · 3 người · 100kWh → tổng khớp **350.000 tuyệt đối** (116.667+116.667+116.666).
- **TP-02** X trả phòng 15/7 → trả phần nửa đầu, tổng phòng khớp 1.050.000. Không ai gánh thay.
- **TP-12** kỳ rác (2026-13, xyz, 9999-99, rỗng) → 400 hết.
- **TP-13** tiền âm → 400.
- **TP-22** mark-paid: body rỗng→400, thiếu confirm→400, staff→403 (lỗi số 1 cũ không tái phát).
- **TP-39** electric_unit rác → 400 (toàn bộ tiền điện được bảo vệ).

---

## Chưa chạy / không đo được ở local

- **TP-23 (UTC lệch ngày thu), TP-38 (chỉ số lùi boot-1), TP-40 (ràng buộc boot-1)** — chỉ bùng nổ trên prod (TZ=UTC / DB trắng boot lần 1). Cần dựng container `-e TZ=UTC` hoặc `psql -f schema.sql` trên DB trắng để đo. Đề bài đã phân tích kỹ qua code.
- **TP-04** (chuyển phòng — tách theo phòng): tổng 2 phòng khớp 1.4M, nhưng phép đo "mỗi phòng khớp" của em dùng phòng hiện tại của HV nên chưa tách được — lõi đã có `electric.test.js` canh, cần đo lại kỹ hơn.
- **TP-03, TP-05, TP-06, TP-16, TP-21, TP-25, TP-28..34, TP-36, TP-37** — biên/robustness 🟡, chưa chạy. TP-33/34 là regression của V2-20/23 (xe, giá phòng) em đã sửa & test ở vòng trước.

---

## Đề nghị thứ tự sửa (nếu chị duyệt)

1. **TP-07, TP-08, TP-09, TP-11** — bịt khoá "đã thu" ở recalc + delete; PUT trừ giảm. Đường tiền, chặn phát hành.
2. **TP-17, TP-18** — một phòng thay công-tơ không được giết cả mẻ / lưu nửa chừng.
3. **TP-27** — hiện kWh phần của HV (hoặc ghi rõ "300 kWh cả phòng, phần bạn 1/3") — chống khiếu nại.
4. **TP-26** — chặn CSV injection (thêm `'` trước `= + - @`).
5. **TP-24, TP-14, TP-15, TP-19, TP-20, TP-35** — validate + robustness.
6. **TP-10** — nhật ký lưu total trước/sau khi đổi.
