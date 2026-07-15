# KẾT QUẢ TEST UI/UX ĐỐI KHÁNG — 10 CASE ƯU TIÊN

**Ngày:** 16/07/2026 · **Phiên bản:** v71
**Môi trường:** `http://localhost:3000` (bản LOCAL). **Không đụng bản demo trên Render** một request nào.
**Dữ liệu:** 206 học viên · 29 phòng · 129 phiếu — đủ dày để các màn không rỗng.
**Công cụ:** Chrome thật điều khiển qua puppeteer (giả lập màn 360px, chế độ Offline, chế độ In). Có ảnh chụp từng case.
**Dọn dẹp:** đã xoá sạch dữ liệu test, còn đúng 206 HV như trước khi chạy.

---

## Hai điều lệch so với đề bài

1. **Mật khẩu `admin/admin123` không đúng** — em dùng mật khẩu thật trong `.env`.
2. **Không có "mcp Browser"** trong môi trường này — em dùng Chrome thật qua puppeteer, cùng cách đã dùng cho các vòng test trước.

## Bốn lần em tự chấm SAI — đã phát hiện và chạy lại

Nêu ra để chị biết số nào đáng tin:

1. **UX-39 báo FAIL giả.** Em kiểm "modal còn mở?" bằng cách tìm ô `#f_name`. Nhưng `closeModal()` chỉ gỡ class `show`, **không xoá DOM** (`ui.js:27`) — ô vẫn còn trong trang dù modal đã đóng. Kiểm lại đúng chỗ → **PASS**.
2. **UX-19 báo FAIL giả.** Em đếm "112 số trần chưa định dạng" — hoá ra là **chữ số trong mã học viên** (`TXTS-S26040069`), không phải tiền. → **PASS**.
3. **UX-23 suýt báo FAIL giả.** Em cộng tay 113 người ở / 110 chỗ ra "âm 3 giường trống", rồi định kết luận trang công khai nói dối. Thật ra **cả hai bên đều kẹp `max(0, …)` theo TỪNG PHÒNG** — có phòng thừa chỗ, có phòng vượt, cộng lại đúng 3 chỗ trống thật. Phép cộng của em mới là sai. → **PASS**.
4. **UX-23, lần đo đầu:** em so `/api/public/stats` (209) với "đang ở" (122) rồi tưởng vênh. Kiểm ra **`API.publicStats` khai báo rồi bỏ đó, không màn nào gọi** — em đang đo con số người dùng không bao giờ nhìn thấy.

Bài học: đo **cái người dùng thật sự nhìn thấy**, không đo cái mình tưởng họ thấy.

---

## Bảng tổng hợp

| | Số case |
|---|---|
| ✅ PASS | **6** |
| ❌ FAIL | **4** |
| ⚠️ BLOCKED | 0 |

---

## FAIL — xếp theo mức thiệt hại

### 🔴 1. UX-05 · Ngày sinh sai bị nuốt im — app còn nói "Đã gửi đăng ký!"

**Ai gặp:** **mọi học viên tự đăng ký** — người ngoài, chưa có tài khoản, dùng điện thoại.

**Đã làm:** trang `/dang-ky`, gõ ngày sinh `31/02/2005` (đúng định dạng, nhưng **không có ngày này trên đời**), bấm Gửi.

**App phản ứng:**
```
Người ta gõ:   31/02/2005
Ô hiển thị:    ""                    ← xoá trắng, không một lời
Gửi lên:       birth_date = null     ← mất luôn
Màn hình:      "Đã gửi đăng ký!"     ← người ta tưởng đã lưu
```

**Vì sao là lỗi UX nặng:** người dùng **không hề biết mình vừa mất dữ liệu**. Họ đóng máy, yên tâm là đã khai xong. Đến lúc quản lý mở đơn ra thì thiếu ngày sinh — phải gọi điện hỏi lại từng người. Đây là **im lặng nuốt dữ liệu rồi báo thành công** — kiểu lỗi tệ nhất, vì người dùng không có cơ hội sửa.

**Đúng ra phải:** ô ngày sinh **viền đỏ + dòng chữ ngay dưới ô** "Ngày 31/02/2005 không có thật", và **không cho gửi** cho tới khi sửa.

*Chị đoán đúng hoàn toàn.*

---

### 🔴 2. UX-03 · Bấm Lưu 2 lần → tạo 2 học viên trùng nhau

**Ai gặp:** nhân viên nhập liệu — **hàng ngày**, nhất là khi mạng chậm.

**Đã làm:** điền form, bấm "Lưu" **2 lần thật nhanh** (thói quen khi tưởng chưa ăn).

**App phản ứng:** gửi lên server **2 request** → tạo **2 học viên trùng tên**. Nút không khoá lại, không đổi sang "đang lưu…".

**Vì sao nặng:** đây **chính là gốc** của việc thu dư **10.907.925đ/tháng** mà mình vừa dọn hôm nay. Nút không có phanh thì dọn xong rồi lại sinh ra tiếp.

**Ghi chú quan trọng:** tuyến chặn trùng làm hôm nay (`#38`) **không cứu được ca này** — nó chỉ chặn khi có **mã HV hoặc CCCD** trùng. Học viên chưa điền mã thì **2 bản ghi vẫn lọt**.

**Đúng ra phải:** bấm phát đầu là **khoá nút + đổi chữ thành "Đang lưu…"**.

*Chị đoán đúng.*

---

### 🟠 3. UX-01 · Bỏ dở form rồi đổi menu → mất sạch, không một lời cảnh báo

**Ai gặp:** nhân viên nhập liệu. Form học viên có **~20 ô**.

**Đã làm:** mở form thêm HV, điền tên + SĐT, chưa lưu → bấm sang menu Phòng.

**App phản ứng:** **chuyển màn luôn**, không hỏi gì. Chữ vừa gõ (`"UX Test Bo Do Giua Chung"`) mất sạch.

**Vì sao khó chịu:** điền 20 ô, lỡ tay bấm nhầm menu là **gõ lại từ đầu**. Trên điện thoại thì bỏ cuộc luôn.

**Đúng ra phải:** hỏi "Bạn có dữ liệu chưa lưu, rời đi?" trước khi bỏ.

*Chị đoán đúng.*

---

### 🟡 4. UX-07 · Hộp xác nhận xoá KHÔNG nói xoá AI

**Đã làm:** bấm nút thùng rác ở một dòng học viên.

**App phản ứng:**
> *"Xóa học viên này? Đây là xóa mềm — có thể khôi phục lại trong mục "Đã xóa"."*

**Chị đoán sai một nửa.** Chị dự đoán *"xóa ngay, hoặc chỉ hỏi 'Bạn chắc chứ?' trống rỗng, không có hoàn tác"*. Thực tế app **có hỏi**, **có nói rõ là xoá mềm**, **có chỉ chỗ khôi phục** — tốt hơn dự đoán nhiều.

**Nhưng thiếu đúng một thứ: TÊN.** "Xóa học viên **này**?" — bấm nhầm dòng thì đọc hộp thoại cũng **không biết mình sắp xoá ai**. Trên điện thoại các nút san sát, bấm nhầm dòng là chuyện thường.

**Đúng ra phải:** *"Xóa học viên **Trần Văn A** (mã DN25…)?"*. Đổi một dòng chữ.

---

## PASS — chị đoán sai 5 chỗ

### ✅ UX-10 · Bảng trên điện thoại 360px — KHÔNG vỡ
Giả lập màn 360px, mở 3 màn nhiều cột nhất:
```
Học viên:    gọn trong khung
Tiền phòng:  gọn trong khung
Phòng:       gọn trong khung
```
Không màn nào đẩy thân trang tràn ngang. `.table-wrap{overflow-x:auto}` làm đúng việc: bảng tự cuộn trong khung của nó.
*Chị dự đoán "bảng đẩy vỡ layout, phải cuộn ngang cả trang" — không xảy ra.*

### ✅ UX-16 · Mất mạng khi đang lưu — app xử lý ĐÚNG
Ngắt mạng rồi bấm Lưu:
- Báo lỗi đỏ ✓
- **Giữ nguyên modal + chữ đã gõ** ✓ (nối mạng lại là bấm Lưu tiếp được)
- **Không** báo nhầm "đã lưu" ✓
*Chị dự đoán "app treo, hoặc báo lưu thành công nhưng thực ra không" — app làm đúng.*

**Nhưng có một hạt sạn:** nó hiện **`"Failed to fetch"`** — tiếng Anh của trình duyệt. Quản lý KTX đọc dòng này không hiểu gì. Nên đổi thành *"Mất kết nối — chưa lưu được. Kiểm tra mạng rồi bấm Lưu lại."*

### ✅ UX-19 · Định dạng tiền NHẤT QUÁN
Đếm trên màn Tiền phòng:
```
kiểu VN "1.200.000":     724 chỗ
kiểu Mỹ "1,200,000":       0 chỗ
số trần "1200000":         0 chỗ
```
*Chị dự đoán "chỗ này chỗ kia, không nhất quán" — không xảy ra.*

### ✅ UX-23 · Số liệu KHỚP giữa các màn
```
Giường trống — trang công khai: 3    ·  app tự tính: 3        ✓
HV đang ở    — Tổng quan:     122    ·  app tự tính: 122      ✓
```
*Chị dự đoán "lệch nhau → mất niềm tin vào toàn bộ app" — không xảy ra.* (Xem mục "em chấm sai" ở trên — em suýt báo nhầm chỗ này.)

### ✅ UX-29 · Bản in phiếu báo SẠCH
Chuyển sang chế độ In rồi soi:
```
menu bên:        ẩn
thanh tiêu đề:   ẩn
nút bấm:         0 cái còn hiện
chiều cao phiếu: ~142mm   (A4 = 297mm → vừa 1 trang, thừa nửa trang)
```
*Chị dự đoán "in cả menu/nút, tràn nhiều trang" — không xảy ra.*

### ✅ UX-39 · Có phản hồi sau khi lưu
Toast **"Đã lưu học viên"** + modal tự đóng + **danh sách tự cập nhật** (không phải F5).
*Chị dự đoán "không có phản hồi" — không xảy ra.*

---

## Vấn đề em thấy mà KHÔNG có trong bộ test

### 🔴 A. Service worker tải sẵn bộ asset CŨ 46 phiên bản — học viên mạng yếu lãnh đủ

`public/sw.js:5-6` khai báo tải sẵn `?v=25`, trong khi `index.html` nạp `?v=71`:
```js
const SHELL = [
  '/', '/index.html', '/css/styles.css?v=25',
  '/js/icons.js?v=25', '/js/api.js?v=25', '/js/ui.js?v=25', '/js/app.js?v=25',
];
```
**Hậu quả:** service worker tải nguyên bộ `?v=25` mà **không lần nào dùng tới** (trang chỉ xin `?v=71`). Máy học viên tải **thừa gần gấp đôi** dung lượng ngay lần mở app đầu tiên. Đúng nhóm người dùng dùng **điện thoại đời thấp, mạng yếu** — nhóm bộ test này nói là **yếu thế nhất**.

**Gốc rễ:** phiên bản phải sửa tay ở **2 file** (`index.html` và `sw.js`), sửa một chỗ quên chỗ kia. Không có gì bắt chúng khớp nhau.

*Liên quan UX-18 nhưng không phải cùng một lỗi — UX-18 hỏi "có mời cập nhật không", đây là "tải thừa ngay từ đầu".*

### 🟠 B. Lời báo lỗi bằng tiếng Anh lọt ra người dùng
`"Failed to fetch"` — nguyên văn từ trình duyệt. Toàn app tiếng Việt, riêng lúc hỏng nhất thì nói tiếng Anh.

### 🟡 C. Tuyến chặn trùng vừa làm hôm nay có LỖ
Chặn dựa vào **mã HV / CCCD**. Học viên **chưa có mã** (đăng ký mới, chưa cấp mã) → bấm Lưu 2 lần vẫn ra **2 hồ sơ**. Cần chặn thêm ở tầng giao diện (khoá nút — xem UX-03).

---

## Nhận định

Ba vấn đề gốc mà bộ test nêu, sau khi chạy thật thì **chỉ đúng 1**:

| Bộ test nói | Thực tế |
|---|---|
| ① App không bảo vệ công sức nhập liệu | **ĐÚNG** — UX-01, UX-03, UX-05 đều FAIL. Đây là nhóm cần sửa trước. |
| ② App viết cho màn rộng, mobile chịu trận | **SAI phần lớn** — UX-10 PASS, bảng không vỡ ở 360px. Nhưng sw.js tải thừa thì mobile lãnh đủ (mục A). |
| ③ Thiếu phản hồi và thiếu phanh | **SAI phần lớn** — UX-39 có toast, UX-16 báo lỗi đúng, UX-07 có xác nhận + nói rõ khôi phục được, UX-23 số liệu khớp. Chỉ thiếu tên trong hộp xoá. |

**Việc đáng làm trước, xếp theo tiền và số người ảnh hưởng:**

1. **Khoá nút Lưu sau cú bấm đầu** (UX-03) — đây là **gốc của 10,9 triệu/tháng** vừa dọn. Không khoá thì dọn xong lại sinh.
2. **Báo lỗi ngày sinh thay vì nuốt im** (UX-05) — mọi học viên tự đăng ký đều dính.
3. **Sửa `sw.js` về `?v=71`** (mục A) — một dòng, cứu băng thông của nhóm dùng điện thoại.
4. **Cảnh báo khi rời form dở** (UX-01).
5. **Thêm tên vào hộp xoá** (UX-07) + **dịch "Failed to fetch"** (mục B) — mỗi cái một dòng chữ.

---

## Còn lại

30 case chưa chạy (UX-02, 04, 06, 08, 09, 11–15, 17, 18, 20–22, 24–28, 30–38, 40). Chạy tiếp khi chị bảo.
