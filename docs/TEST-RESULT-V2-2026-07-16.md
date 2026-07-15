# KẾT QUẢ TEST ĐỐI KHÁNG V2 — 10 CASE ƯU TIÊN

**Ngày:** 16/07/2026 · **Phiên bản:** v72
**Môi trường:** `http://localhost:3000` (LOCAL). **Không gửi một request nào lên `ktx-tnh.onrender.com`.**
**An toàn:** đã `pg_dump` backup trước khi chạy. Mail test bay vào **hộp thư giả trên chính máy này (127.0.0.1)** — không một byte nào ra Internet. **Chưa chạy V2-71** (case tự khoá quyền admin).
**Dọn dẹp:** mọi dữ liệu test mang tiền tố `__v2*`, đã xoá sạch. Cài đặt SMTP đã trả về nguyên trạng.

> Chị dặn: **chỉ test và báo lỗi, fix sau.** Báo cáo này không sửa một dòng code nào.

---

## Tổng hợp

| | Số case |
|---|---|
| ❌ **FAIL** | **11** |
| ✅ PASS | 0 |
| ⚠️ Chưa chạy | V2-71 (tự khoá quyền admin — cần chuẩn bị đường phục hồi) |

**Người viết bộ V2 dự đoán rất chính xác.** 11/11 case em chạy đều đúng như dự đoán, kể cả `file:line`. Chỉ có **1 chỗ dự đoán sai về cơ chế** (V2-56, xem bên dưới).

---

## 🔴 CHẶN PHÁT HÀNH

### V2-12 · Nút "Test SMTP" gửi mật khẩu email của KTX sang máy chủ bất kỳ

**Em bắt được tận tay**, không phải suy đoán:

```
Trong CSDL:  smtp_host = smtp.congty-that.com
             smtp_pass = "MatKhauSMTP_BiMat_2026"

Em gọi:      POST /api/settings/smtp/test
             { smtp_host: "127.0.0.1",  smtp_pass: "" }   ← trỏ sang máy em, BỎ TRỐNG mật khẩu

Máy em nhận: AUTH PLAIN AGt0eEBlc3VoYWkuY29tAE1hdEtoYXVTTVRQX0JpTWF0XzIwMjY=
             giải mã →  ktx@esuhai.com   MatKhauSMTP_BiMat_2026

App trả về:  HTTP 200  {"ok":true}
```

**Mật khẩu email thật của ký túc xá bay sang máy chủ do người gọi chỉ định, và app báo "thành công".**

Ai làm được: **bất kỳ ai có tài khoản admin**. Một request. Không để lại dấu vết bất thường nào trong nhật ký — vì nhật ký che `smtp_pass` thành `***`, mà ở đây ô đó **vốn để trống**; cái bị rò là giá trị **trong CSDL**.

Điều này **vô hiệu hoá toàn bộ công sức giấu mật khẩu SMTP** ở `settings.routes.js:10-17`, nơi app hứa *"mật khẩu SMTP không bao giờ được trả về"*.

**Kèm — V2-13/V2-14:** thông điệp lỗi trả nguyên văn về client (`connect ECONNREFUSED 127.0.0.1:25`) → phân biệt được cổng đóng / firewall / có dịch vụ → **dùng máy chủ KTX quét mạng nội bộ**. Cổng `"abc"` và cổng `-1` đều được nhận (HTTP 200) — `valid.js:39` **có sẵn** luật 1–65535 nhưng đường này không gọi.

---

### V2-36 · Nhân viên bảo trì tự đặt ngày trả phòng cho học viên bất kỳ, tiền tự giảm

```
Tài khoản:   role = maintenance   (chỉ được phép xác nhận bàn giao)
Gọi:         POST /api/maintenance/handovers/<id HV bất kỳ>/checkout
             { actual_date: "2026-07-02" }
             ← học viên này ĐANG Ở BÌNH THƯỜNG, không có đơn trả phòng nào

Kết quả:     HTTP 200
             học viên → status="out", ngày ra = 02/07/2026
             hoá đơn  → 1.350.000 (31 ngày)  ➜  77.419 (2 ngày)
```

**Bảo trì hạ hoá đơn của bất kỳ ai xuống còn 6%, không cần admin duyệt.**

**Kèm — V2-37:** đường này **bỏ sót 3 việc** mà đường check-out chuẩn đều làm. Em kiểm: **lượt ở phòng VẪN TREO MỞ** → người đã đi **vẫn gánh tiền điện các tháng sau** và làm loãng phần chia của bạn cùng phòng. Đúng cái lỗi TC-10 mình vừa sửa hôm qua — **đường bảo trì đi vòng qua nó**.

---

### V2-73 + V2-63 · Mạo danh học viên, không để lại dấu vết

```
V2-73:  POST /api/admin/users/<id tài khoản HỌC VIÊN>/password { password: "maodanh123" }
        → HTTP 200
        → đăng nhập bằng mật khẩu vừa đặt → VÀO ĐƯỢC
        (endpoint này comment ghi rõ là "quản lý tài khoản NHÂN VIÊN")

V2-63:  số dòng nhật ký cho /api/auth/* = 0
        → KHÔNG ghi đăng nhập, đăng xuất, đổi mật khẩu
```

Ghép lại: **admin đặt mật khẩu cho tài khoản học viên → đăng nhập dưới danh nghĩa họ → làm gì cũng ghi tên học viên → bước đăng nhập không có trong nhật ký.** Đường mạo danh hoàn chỉnh.

---

### V2-54 · Hai người bấm Duyệt cùng lúc → một người thành 2 hồ sơ

```
2 request POST /api/applications/:id/approve song song
→ HTTP 200 + 200  →  tạo ra 2 hồ sơ học viên
```

Chốt chặn `if (app.status === 'approved')` đọc **ngoài transaction, không khoá dòng** → cả hai cùng thấy `pending`.

**Đây chính là gốc của 10.907.925đ thu dư** mà mình vừa dọn tay hôm nay — chỉ khác lối vào. Và **double-click cũng đủ** (bản sửa chống-bấm-2-lần hôm nay chặn ở giao diện, nhưng 2 nhân viên trên 2 máy thì không).

---

### V2-30 · Bảng phí bồi hoàn chỉ là trang trí — khấu trừ cọc tính ở máy khách

```
Danh mục:  "Chìa khoá phòng — 100.000"
Gọi:       POST /api/students/:id/deposit-settle
           { deduction: 1199999, deduction_note: "Chìa khoá x1" }
Kết quả:   HTTP 200 · CSDL ghi khấu trừ = 1.199.999
```

Server **không hề đọc bảng `assets`** — nó chỉ kiểm số ≥ 0 và ≤ tiền cọc. Toàn bộ phép nhân `số lượng × phí` chạy ở **trình duyệt** rồi gửi lên **một con số**.

---

## 🟠 NẶNG

### V2-01 + V2-03 · Mail báo nhà trường

Em trỏ SMTP vào hộp thư giả trên máy mình và **đếm mail thật**:

```
Ngưỡng báo trường = 3
   vi phạm lần 1 → 0 mail
   vi phạm lần 2 → 0 mail
   vi phạm lần 3 → 1 mail   ✔ đúng
   vi phạm lần 4 → 1 mail   ❌ gửi lại
   vi phạm lần 5 → 1 mail   ❌ gửi lại
```
`violations.routes.js:126` dùng `if (level >= threshold)` — **`>=` chứ không phải `===`**, và **không kiểm cột `notified_school`** dù cột đó sinh ra chính để làm việc này. **Nhà trường bị dội mail trùng về cùng một học viên.**

```
V2-03: học viên MỚI vi phạm 1 lần → bấm "Gửi mail" → 1 mail BAY ĐI
       bấm thêm 5 lần            → 5 mail nữa
```
`:164-174` **không kiểm ngưỡng, không kiểm đã gửi chưa**. Giao diện hứa *"đủ 3 lần mới gửi"* (`app.js:1959`) — **lời hứa đó chỉ là chữ trên màn hình**. Gọi bao nhiêu lần, gửi bấy nhiêu mail, mang danh Ban quản lý KTX.

---

### V2-20 · Xoá xe rồi tính lại hoá đơn → phí gửi xe sống dậy

```
Khi còn xe:                 100.000
Xoá xe → tính lại hoá đơn:  100.000    ← vẫn thu
```
`invoice-calc.js:78` thiếu `AND deleted_at IS NULL`, trong khi **hai chỗ kia đều có**. Nghĩa là **đường tạo tính đúng, mọi đường tính lại tính sai** — cùng một hoá đơn, số tiền phụ thuộc *thao tác cuối cùng chạm vào nó*. Recalc bị kích hoạt bởi **9 nơi**, kể cả khi **bạn cùng phòng chuyển đi**. Không ai cố ý làm gì, tiền tự sai.

---

### V2-21 · Xe không biển số → cộng tiền tuỳ ý

```
10 lần POST /api/vehicles { student_id: X }   (không có biển số)
→ 10/10 được nhận · CSDL có 10 xe
→ phí gửi xe tháng 7 = 1.000.000
```
Quyền cần: chỉ **staff**. Ràng buộc chống trùng biển số có `WHERE plate <> ''` → **biển rỗng không bị chặn**.

---

### V2-44 · Học viên tự né trọn tiền máy giặt

```
Dùng máy giặt cả tháng      → phí 70.000
Ngày cuối tự tắt (HTTP 200) → lập lại phiếu → 0đ
```
`billing.js:174` đọc **giá trị HIỆN TẠI lúc chốt sổ**; `me.routes.js:85` chỉ `UPDATE uses_washing` — **không lịch sử, không giới hạn số lần, không nhật ký**. Lặp vô hạn, không ai phát hiện.

**Đây lại là bài học đã rút cho phòng trưởng mà chưa áp cho máy giặt** — `room-leaders.js:4-7` có comment mô tả **chính xác cái bẫy này**.

**Kèm:** gửi `on:"false"` (chuỗi) → `uses_washing` thành **`true`**. Chỉ đúng boolean `false` mới tắt được.

---

### V2-56 · Duyệt đơn đi vòng qua mọi validate

Em tách từng trường ra đo riêng:

| Gửi lên | Kết quả | |
|---|---|---|
| `check_in_date: "1990-01-01"` | **HTTP 200** → hồ sơ ghi vào ở từ **36 năm trước** | ❌ |
| `check_in_date: "abc"` | **HTTP 500** (sập, không phải chặn) | 💥 |
| `deposit_amount: -50000000` | **HTTP 500** | 💥 |
| `deposit_amount: "abc"` | **HTTP 200** → cọc = **0đ nhưng trạng thái "đã đóng"** | ❌ |

`applications.routes.js` **không import `valid.js` một dòng nào**.

> **Chỗ bộ V2 dự đoán sai:** plan đoán cọc âm sẽ **lọt vào CSDL**. Thực tế nó **500**. Vẫn là FAIL (sập thay vì báo lỗi tử tế), nhưng cơ chế khác dự đoán. Riêng `"abc"` thì tệ hơn dự đoán: không NaN, mà **âm thầm thành 0 và vẫn đánh dấu "đã đóng cọc"**.

---

## Em tự kiểm lại 3 lần trước khi báo

Chị nhắc em hay báo rồi mới kiểm. Vòng này em làm ngược lại — 3 kết quả đầu tiên em **không báo** vì chưa đủ chắc:

1. **V2-56 em suýt chấm PASS** vì thấy HTTP ≥ 400. Nhưng **500 là sập, không phải chặn**. Tách từng trường ra đo mới thấy đúng bản chất.
2. **V2-01 "PASS" đầu tiên là giả** — SMTP chưa cấu hình nên mail không bay, cờ không được set, em không phân biệt được "gửi 1 lần" với "gửi 3 lần". Phải dựng hộp thư giả và **đếm mail thật** mới ra 3.
3. **V2-12 chưa chứng minh được** ở lần đầu — cổng 25 không ai nghe. Phải dựng hộp thư giả **có trả lời AUTH** mới bắt được mật khẩu trên dây.

---

## Bốn vấn đề gốc — em xác nhận cả bốn

| Bộ V2 nói | Em kiểm chứng |
|---|---|
| **① Quên áp dụng công cụ của chính mình** | ✔ `violations.routes.js` và `applications.routes.js` **không import `valid.js`** dòng nào · `checkSetting` có luật cổng 1–65535 nhưng `/smtp/test` không gọi |
| **② Hai đường vào, hai kết quả** | ✔ Phí xe: đường tạo lọc `deleted_at`, đường tính lại thì không · check-out qua bảo trì bỏ sót 3 việc |
| **③ Nuốt lỗi im lặng rồi báo thành công** | ✔ `deposit_amount:"abc"` → 0đ + "đã đóng" · `on:"false"` → bật · Test SMTP rò mật khẩu mà trả `{"ok":true}` |
| **④ Nhật ký thủng đúng chỗ cần nhất** | ✔ 0 dòng cho `/api/auth/*` — không ghi đăng nhập |

---

## Còn lại

**72 case chưa chạy.** Trong đó **V2-71 (tự khoá quyền admin vĩnh viễn)** em để lại vì nó cần chuẩn bị đường phục hồi và phải chạy cuối cùng của cả bộ.

Chị bảo là em chạy tiếp.
