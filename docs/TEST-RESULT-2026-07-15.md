# KẾT QUẢ TEST ĐỐI KHÁNG — TOÀN BỘ 48 CASE

> ## 📌 CẬP NHẬT SAU KHI SỬA — 15/07/2026 (cuối ngày)
>
> **Đã sửa xong 36/43 lỗi.** Bộ test nay nằm trong repo: **`npm test` → 88 case**, xem `tests/README.md`.
>
> **TC-10 (chuyển phòng giữa tháng) — ĐÃ SỬA.** Sếp chốt quy tắc: *khi có người rời phòng thì chốt chỉ số
> công-tơ ngay hôm đó; tháng cắt thành các chặng; mỗi chặng chia cho người có mặt theo số ngày ở.*
> Kiểm chứng trên CSDL thật (phòng dùng 300 kWh, X chuyển đi 15/07):
>
> | | Cách cũ | Cách mới |
> |---|---:|---:|
> | X (chuyển đi) | **0đ** | **111.364đ** |
> | A1 (ở lại) | 525.000đ | 469.318đ |
> | A2 (ở lại) | 525.000đ | 469.318đ |
> | **Tổng** | 1.050.000đ | **1.050.000đ** |
>
> **Sửa lại chỗ em chấm SAI:** **TC-25b (2 HV trùng mã) — em xếp FAIL là chấm sai, thực tế KHÔNG phải lỗi.**
> Mã `Nhân viên` dùng chung cho nhiều người là **cố ý** trong nghiệp vụ. App cũng không dựa vào mã HV làm khoá;
> chỗ duy nhất mã HV có thể gây hại là dùng làm tên đăng nhập mặc định, và chỗ đó **app đã chặn đúng**.
> Đã **không** thêm ràng buộc `UNIQUE(code)` — thêm là gãy nghiệp vụ. **Việc này đóng.**
>
> **Lỗi mới tìm ra trong lúc sửa:**
> - **N-05** — chống dò mật khẩu đếm **cả lần đăng nhập ĐÚNG**. Người dùng thật đăng nhập vài thiết bị là bị
>   khoá 15 phút, mà app báo *"đăng nhập **sai** quá nhiều lần"* — sai sự thật. Đã sửa: chỉ đếm lần sai.
> - **Lỗi giao diện** — `.hint` là flex nên mỗi thẻ con thành một cột; dòng giải thích bị **vỡ thành 3 cột
>   chồng nhau**, đọc không nổi. Đã sửa + thêm rào chắn CSS cho các hint sau này.

**Ngày:** 15/07/2026
**Môi trường:** `http://localhost:3000` (bản LOCAL). **Không đụng vào staging** (`ktx-tnh.onrender.com`) một request nào.
**Xác thực:** đã kiểm chứng — app nhận **cả cookie lẫn `Authorization: Bearer`** (`server/auth.js:27-28`), đúng như mẹo trong bộ test.
**An toàn dữ liệu:** `pg_dump` backup 2 lần, TC-01 chạy cuối nhóm P0, TC-19 chạy cuối cùng (nó khoá đăng nhập 15 phút). **Đã khôi phục nguyên trạng**: 214 HV · 29 phòng · 130 phiếu `pending` · đơn giá về cũ · **0 fixture rác, 0 tài khoản test còn sót**.

---

## ⚠️ Hai lần chính em test sai — đã phát hiện và chạy lại

Nêu ra để anh/chị biết số liệu nào đáng tin:

1. **Lần chạy P0 đầu tiên bị hỏng:** server local đang chạy **code cũ**. TC-21 trả *"Phòng đã đủ chỗ"* trong khi code hiện tại **không còn dòng đó**. → Restart server, **chạy lại toàn bộ**.
2. **Ba case tự phá bởi thiết kế test của em:**
   - **TC-11/TC-08** gửi field `check_out_date` — endpoint thật đọc `date` → app lặng lẽ lấy ngày hôm nay → kịch bản không diễn ra như ý. Đã chạy lại. *(Chính chỗ này lòi ra lỗi mới **N-01**.)*
   - **TC-27** đặt tên phòng có tiền tố `G3R_` — chữ số **3** trong tiền tố làm mọi phòng ra tầng 3. Đã chạy lại với tên sạch.
   - **TC-18** đếm nhật ký mà không so trước/sau → 2 dòng rác từ test cũ bị tính nhầm thành "có ghi vết" (**PASS giả**). Đã đếm lại: **0 dòng**.
   - **TC-12** chọn số chia hết (33 kWh × 3.000 ÷ 3 người) nên không lộ lỗi. Đã chạy lại với đơn giá 3.500.

Mọi số liệu dưới đây là kết quả **sau khi sửa** các sai sót trên, trên code `8d5594e`.

---

## BẢNG TỔNG HỢP

| Kết quả | Số lượng |
|---|---|
| **FAIL** | **43 / 48** |
| **PASS** | **5 / 48** — TC-16, TC-35, TC-46, TC-47, TC-48 |
| BLOCKED | 0 |
| **Lỗi mới ngoài bộ test** | **4** (N-01 → N-04) |

---

## 10 LỖI NGUY HIỂM NHẤT (xếp theo mức tàn phá)

| # | Case | Hậu quả bằng ngôn ngữ người dùng |
|---|---|---|
| 1 | **TC-01** | 1 request body rỗng → **134 hoá đơn / 3 kỳ** thành "đã thu". **Nhân viên thường cũng làm được.** Không hoàn tác. Sổ công nợ xoá sạch trong 1 giây. |
| 2 | **TC-04** | Gõ nhầm 1 ký tự vào ô đơn giá điện ("abc") → **toàn bộ tiền điện = 0đ**, không một cảnh báo. Đơn giá tiền phòng ÂM cũng lưu được. |
| 3 | **TC-14 + TC-15 + TC-15b** | Người **bị giáng chức / bị đuổi / đã đăng xuất** vẫn dùng vé cũ **30 ngày**: sửa được đơn giá, đọc được toàn bộ HV. Ghép với TC-04 = phá hoại có chủ đích. |
| 4 | **TC-13** | Mật khẩu mặc định + màn "bắt buộc đổi mật khẩu" chỉ là tấm rèm → vẫn lấy được danh sách tài khoản. |
| 5 | **TC-05** | 2 HV cùng thuê nguyên 1 phòng → thu **11.000.000 cho phòng giá 5.500.000** (thu 2 lần). |
| 6 | **TC-07** | Khấu trừ cọc **âm** → trả cho HV nhiều hơn số họ đã cọc. Khấu trừ **vượt** số cọc cũng qua. |
| 7 | **TC-06** | HV rời 15/07 nhưng hoá đơn **tháng 8 vẫn đòi 1.350.000**. |
| 8 | **TC-10 + TC-11** | Chuyển phòng giữa tháng: người chuyển đi **không trả đồng điện nào** cho nửa tháng đã ở; người ở lại **gánh thay**. Ở 1 ngày vẫn è cổ trả **300.000 tiền điện** như người ở cả tháng. |
| 9 | **TC-17** | **Bảo trì** ghi được ngày trả phòng → **tính lại hoá đơn**. Bộ phận kỹ thuật đứng trên đường tiền. |
| 10 | **TC-45** | File CSV xuất ra chứa `"=1+1"` → Excel **chạy như công thức**. Kế toán/sếp mở file có thể dính. |

---

## KẾT QUẢ TỪNG CASE

### NHÓM 1 — ĐƯỜNG TIỀN

| Case | KQ | Đã làm → App trả về → Vì sao là lỗi |
|---|---|---|
| **TC-01** | 🔴 FAIL | `POST /api/invoices/mark-paid` body `{}` → **HTTP 200, updated:134**. Trước: 132+1+1 `pending` ở 3 kỳ. Sau: tất cả `paid`. **Staff cũng làm được** (reset về pending, staff gọi → 134 phiếu đổi). → Xoá sạch sổ công nợ, không biết ai đã đóng. |
| **TC-02** | 🔴 FAIL | Hoá đơn `paid` 1.200.000 → `PUT /api/invoices/:id` sửa xuống **1đ** → **HTTP 200**, trạng thái vẫn "đã thu". → Số đã chốt với Bravo bị đổi sau lưng. |
| **TC-03** | 🔴 FAIL | `room_charge:-99999999` → **201**, DB lưu âm. `deposit -5.000.000` → **200**. `monthly_fee -9.000.000` → **201**. → `min=0` chỉ là thuộc tính HTML; server không kiểm. |
| **TC-04** | 🔴 FAIL | `{"electric_unit":"abc"}` → **200**, DB lưu `"abc"`. Phòng 120 kWh → **tiền điện 0đ**. `room_fee:"-1200000"` → lưu được. |
| **TC-05** | 🔴 FAIL | 2 HV cùng phòng hạng A, đều "nguyên phòng" → mỗi người **5.500.000** → **thu 11.000.000 cho 1 phòng**. |
| **TC-06** | 🔴 FAIL | Hoá đơn T8 (1.350.000) → check-out 15/07 → hoá đơn T8 **còn nguyên 31 ngày / 1.350.000**. |
| **TC-07** | 🔴 FAIL | Cọc 1.200.000 → khấu trừ **10.000.000** → 200. Khấu trừ **-500.000** → 200. |
| **TC-08** | 🔴 FAIL | Báo trước 5 ngày (quy định 30). App tự kết luận `{"eligible":false,"reason":"Chỉ báo trước 5 ngày (< 1 tháng)"}` → gọi `deposit-settle` → **200, cọc = "refunded"**. → Kết luận đủ/không đủ điều kiện chỉ để trang trí. |
| **TC-09** | 🔴 FAIL | Chỉ số đầu 5000 > cuối 4000 → **200, kWh = 0**, im lặng. |
| **TC-09b** | 🟠 FAIL | Chỉ số cuối 999.999.999 → **200**, tiền điện ≈ **3 nghìn tỷ**, không ngưỡng cảnh báo. |
| **TC-10** | 🔴 FAIL | Phòng A (300 kWh, 3 người) → chuyển X sang B ngày 15/07. Kết quả: **X trả 0đ điện cho phòng A** (chỉ tính theo phòng mới B: 300.000); **A1 và A2 gánh thay** (300 kWh chia 2 thay vì 3 → mỗi người 180.000). |
| **TC-11** | 🔴 FAIL | C3 vào 01/07 ra 01/07 (**đúng 1 ngày**, DB xác nhận): tiền phòng chia đúng theo ngày (**38.710**) nhưng **tiền điện 300.000 — bằng người ở trọn 31 ngày**. Điện chia đều đầu người, không nhân ngày. |
| **TC-12** | 🟡 FAIL | Với đơn giá **3.000** hiện tại: 3 người → chia hết, không lệch (PASS). Đổi sang **3.500**: 100 kWh = 350.000 → thu `116.667 × 3 = 350.001` → **dư 1đ/phòng/tháng**. → **Lỗi đang ngủ**, chỉ cần đổi đơn giá sang số lẻ là sổ sách bắt đầu lệch. |

### NHÓM 2 — PHÂN QUYỀN & ĐĂNG NHẬP

| Case | KQ | Đã làm → App trả về → Vì sao là lỗi |
|---|---|---|
| **TC-13** | 🔴 FAIL | Cờ "bắt buộc đổi mật khẩu" = true → không đổi → `GET /api/admin/users` → **200**, ra `["admin","baotri"]`. |
| **TC-14** | 🔴 FAIL | Admin B → giáng xuống staff → dùng **token cũ** `PUT /api/settings` → **200**, tên KTX bị đổi. |
| **TC-15** | 🔴 FAIL | Staff C → **xoá tài khoản C** (login lại: 401) → token cũ `GET /api/students` → **200, ra 214 học viên**. |
| **TC-15b** | 🔴 FAIL | `POST /api/auth/logout` (200) → dùng lại đúng token đó → **200**. → Đăng xuất chỉ xoá cookie máy khách, không huỷ vé. |
| **TC-16** | ✅ **PASS** | Staff `POST /api/admin/users/:id/password` đổi mật khẩu HV → **403**, có ghi nhật ký `[TỪ CHỐI 403]`. **Anh/chị đoán sai.** |
| **TC-17** | 🔴 FAIL | Tài khoản **bảo trì** → `POST /maintenance/handovers/:id/checkout {"actual_date":"2026-07-10"}` → **200**: HV thành "đã trả", hoá đơn T7 **tính lại từ 31 ngày/1.200.000 → 10 ngày/387.097**. Bảo trì chỉ đọc được tên/phòng/ngày (không lộ SĐT — điểm tốt). |
| **TC-18** | 🔴 FAIL | HV bật máy giặt (200) + gửi đơn trả phòng (201) → nhật ký `role=student`: **trước 2 → sau 2 (tăng 0)**. → Thao tác mất phí không để lại vết nào. *(2 dòng kia là rác `[TỪ CHỐI 403]` từ test cũ.)* |
| **TC-19** | 🔴 FAIL | Đồng nghiệp login đúng → **200**. Một người gõ sai 21 lần → **429**. Đồng nghiệp login **đúng mật khẩu** → **429 "Đăng nhập sai quá nhiều lần"**. → Chặn theo **địa chỉ mạng**, không theo tài khoản → **cả văn phòng bị khoá 15 phút**. |
| **TC-20** | 🔴 FAIL | `/api/public/stats`: 216 → thêm HV → 217 → **xoá HV → vẫn 217**. → Trang công khai khoe cả HV đã xoá. |

### NHÓM 3 — QUY TẮC PHÒNG Ở

| Case | KQ | Đã làm → App trả về → Vì sao là lỗi |
|---|---|---|
| **TC-21** | 🔴 FAIL | (a) `POST /students {"gender":"male","room_id":<phòng nữ còn chỗ>}` → **201**, HV nam nằm trong phòng nữ. (b) Không cần API: tạo HV nam ở phòng nam → sửa giới tính thành **nữ** → **200**. → Server không kiểm giới tính phòng ở bất kỳ đâu. |
| **TC-22a/b/c/d** | 🔴 FAIL | Phòng 2 giường đủ 2 người: **sửa hồ sơ** → 3/2 · **chuyển phòng** → 3/2 · **check-in lại** → 4/2 · **duyệt đơn** → 5/2. Tất cả **HTTP 200/201**. |
| **TC-23** | 🔴 FAIL | 2 request song song vào phòng 3/4 → cả hai **201** → **5/4**. *(Không phải lỗi tranh chấp đồng thời — xem lỗi mới N-02.)* |
| **TC-24** | 🔴 FAIL | `capacity:-5` → lưu được. `capacity:99` cho hạng D → lưu được. |
| **TC-25** | 🔴 FAIL | 2 phòng cùng tên → được · ~~2 HV cùng mã → được~~ *(**chấm sai — không phải lỗi**, xem cập nhật đầu file)* · **2 HV cùng CCCD → được** · 2 lần gợi ý số HĐ đồng thời → **ra CÙNG số `01/2026/HDKTX-E2`**. |
| **TC-26** | 🔴 FAIL | Tạo "Nam" rồi "nam" tuần tự → **400 (chặn đúng)**. Nhưng gửi **song song** "Race"/"race" → cả hai **201** → DB có **2 tài khoản trùng tên**. → Login tìm không phân biệt hoa thường → **đăng nhập nhầm người**. |
| **TC-27** | 🔴 FAIL | `"305"` → tầng 3 ✅ · `"A203"` → tầng 2 ✅ · **`"Nhà 2 - 305"` → tầng 2 (phải là 3)** ❌ · **`"1305"` → tầng 1 (phải là 13)** ❌ → tầng sai → pháp nhân E2/S2 sai → **số hợp đồng cấp sai**. |

### NHÓM 4 — XÓA & TRẠNG THÁI

| Case | KQ | Đã làm → App trả về → Vì sao là lỗi |
|---|---|---|
| **TC-28** | 🟠 FAIL | HV nợ 2.000.000 → `DELETE` → **200, không hỏi han**. Doanh thu **68.860.677 trước = sau**. → Xem mục "đoán sai". |
| **TC-29** | 🔴 FAIL | HV có hoá đơn `paid` 3.000.000 → xoá HV → doanh thu **70.247.774 → 70.247.774 (không đổi)**. |
| **TC-30** | 🟠 FAIL | Phòng có 1 HV → xoá HV (200) → xoá phòng → **400 "Phòng đang có học viên ở"**. → Phòng kẹt vĩnh viễn. |
| **TC-31** | 🔴 FAIL | Phòng 2 giường: xoá 2 HV cũ → xếp 2 HV mới → khôi phục 2 HV cũ (200, 200) → **4/2**. |
| **TC-32a** | 🔴 FAIL | Duyệt đơn (tạo ra HV id=1471) → bấm **Từ chối** chính đơn đó → **200**, đơn ghi "rejected" nhưng **HV vẫn tồn tại, vẫn ở, vẫn bị lập hoá đơn**. |
| **TC-32b** | 🔴 FAIL | Xác nhận đơn trả phòng 2 lần → cả 2 lần **200** → **2 dòng nhật ký "ra"** cho 1 lần rời đi thật + tính lại hoá đơn thêm lần nữa. |
| **TC-33** | 🔴 FAIL | HV ngày vào **01/09/2026** (còn 1,5 tháng): DB ghi `status="in"` ngay · màn Phòng báo **0 người** · nhưng **xoá phòng → 400 "đang có học viên ở"**. → Hai cách hiểu "đang ở", hai màn hai số. |

### NHÓM 5 — DỮ LIỆU RÁC & VALIDATE

| Case | KQ | Đã làm → App trả về → Vì sao là lỗi |
|---|---|---|
| **TC-34** | 🔴 FAIL | `month:"2026-13"` → **201** · `"xyz"` → **201** · `""` → 400. DB lưu kỳ `["2026-13","xyz"]`. → Quy tắc "1 HV 1 HĐ mỗi kỳ" mất tác dụng; báo cáo cắt 4 ký tự đầu → năm "xyz". |
| **TC-35** | ✅ **PASS** | `/api/electric?month=abc` → **200** (không sập). `month=2026-13` → **200**. **Anh/chị đoán sai** (dự đoán 500). |
| **TC-36** | 🔴 FAIL | Bulk 3 phòng, phòng giữa lỗi → **HTTP 500** nhưng **phòng A đã lưu**, phòng B không. → Lưu nửa chừng, nhập lại ghi đè lộn xộn. |
| **TC-37** | 🔴 FAIL | (a) tạo HV vào 01/08 ra 01/07 → **400 chặn đúng** · (c) cổng bảo trì ngày lùi → **400 chặn đúng** · **(b) màn CHECK-OUT: `{"date":"2026-06-01"}` (trước ngày vào 01/07) → 200**, DB lưu ra < vào, hoá đơn T6 = 0 ngày. → Cùng một luật, 2 nơi có 1 nơi không. |
| **TC-38** | 🔴 FAIL | Ngày sinh `2050-01-01` và `2000-02-31` → cả hai **201**, DB lưu **TRỐNG**. → Người khai tưởng đã điền, dữ liệu mất âm thầm. |
| **TC-39** | 🔴 FAIL | Công khai: `abc`→400, `123`→400, quá dài→400, `090 123 4567`→201, `+84901234567`→201 (**đúng**). **Quản trị: TẤT CẢ → 201**, lưu được `"abc"`, `"123"`. → Hai nơi hai luật. |
| **TC-40** | 🔴 FAIL | Biển `59X1-12345` cho HV A → 201; **đúng biển đó** cho HV B → **201**. DB có 2 xe cùng biển. → Thu tiền 2 người cho 1 xe. |
| **TC-41** | 🔴 FAIL | **W1 bật ô "có gửi xe", 0 xe → phí = 0đ (THU THIẾU)**. W2 tắt ô, 2 xe → phí = 200.000. → App chỉ tính theo danh sách xe; ô "có gửi xe" **không có tác dụng gì lên tiền** nhưng vẫn hiện như lựa chọn thật. |

### NHÓM 6 — VI PHẠM & THÔNG BÁO

| Case | KQ | Đã làm → App trả về → Vì sao là lỗi |
|---|---|---|
| **TC-42** | 🔴 FAIL | HV có 2 vi phạm, 2 nhân viên **đồng thời** ghi vi phạm thứ 3 → cấp độ trong DB `[1, 2, 3, 3]`, **app kích hoạt gửi mail 2 lần** → nhà trường nhận 2 email về cùng 1 HV. |
| **TC-43** | 🔴 FAIL | 3 vi phạm đã báo trường → xoá vi phạm số 2 → còn `lần 1 (đã báo=CÓ) · lần 2 (đã báo=CÓ)`. → Cấp độ đánh lại đúng nhưng **cờ "đã báo nhà trường" không được gỡ**. HV còn 2 vi phạm (dưới ngưỡng 3) mà hồ sơ vẫn ghi đã báo trường. |
| **TC-44** | 🔴 FAIL | Ngưỡng = `0` → 200 lưu "0" · `-5` → 200 lưu "-5" · `"abc"` → 200 lưu "abc". → Ngưỡng 0/âm = **mọi vi phạm đầu tiên đều báo trường ngay**. |

### NHÓM 7 — XUẤT FILE & GIAO DIỆN

| Case | KQ | Đã làm → App trả về → Vì sao là lỗi |
|---|---|---|
| **TC-45** | 🔴 FAIL | Tên HV = `=1+1` → xuất CSV màn Tiền phòng → file chứa: `"=1+1","XSS_3","XSSR_1",...` → Excel **chạy như công thức**. App bọc ngoặc kép nhưng **không chặn `=` `+` `-` `@` đầu ô**. |
| **TC-46** | ✅ **PASS** | Tên HV = `<img src=x onerror=...>` và `<b>DAM</b>` → mở **5 màn** (HV, Tổng quan, Điều hành, Tiền phòng, Phòng) trong Chrome thật: **không màn nào chạy mã**, không thẻ nào bị chèn, hiện nguyên văn. **Anh/chị đoán sai.** *(Rủi ro còn treo: app tắt CSP nên chỉ cần 1 chỗ quên `esc()` là thủng.)* |
| **TC-47** | ✅ **PASS** | (a) `.svg` có `<script>` → **400 chặn** · (b) file 20MB → **413 chặn** · (d) HV A đọc ảnh CCCD của HV B → **403 chặn**. **Anh/chị đoán sai.** *(Riêng (c) file exe đổi đuôi jpg → 200 nhận; rủi ro thấp vì app phục vụ ảnh kèm `nosniff`.)* |
| **TC-48** | ✅ **PASS** | Lập hoá đơn 128 HV → **0.09 giây** (xa ngưỡng 15 giây của DB). Bấm 2 lần đồng thời → không trùng, không kẹt. **Anh/chị đoán sai.** |

---

## CHỖ ANH/CHỊ ĐOÁN SAI (dự đoán FAIL nhưng thực tế PASS)

| Case | Dự đoán trong file | Thực tế |
|---|---|---|
| **TC-16** | *"làm được, xem toàn bộ HĐ + vi phạm của HV đó"* | **403** — nhân viên **không** đổi được mật khẩu HV, và bị **ghi nhật ký** `[TỪ CHỐI 403]`. Chức năng này đã giới hạn cho admin. |
| **TC-35** | *"lỗi 500"* | **200** — app xử lý được `month=abc` và `month=2026-13`, không sập. |
| **TC-46** | *"chỉ cần 1 chỗ quên lọc là chạy mã"* | **Không chỗ nào chạy** trên 5 màn đã thử. `esc()` dùng nhất quán. |
| **TC-47a/b/d** | *"kiểm tra còn vá không"* | **Vẫn vá**: svg → 400, 20MB → 413, đọc CCCD người khác → 403. |
| **TC-48** | *"có thể timeout giữa chừng… quá 10 giây thì bom hẹn giờ"* | **0.09 giây** cho 128 HV. Không có nguy cơ timeout. |
| **TC-37c** | *"thử qua cổng bảo trì với ngày lùi tương tự"* (ngụ ý lọt) | **400 chặn đúng**. Chỉ màn check-out (37b) là thủng. |
| **TC-28** | *"khoản nợ biến mất khỏi mọi báo cáo"* | **Ngược lại**: doanh thu **không đổi** — hoá đơn của người đã xoá **vẫn nằm trong báo cáo**. Việc xoá vẫn là lỗi, nhưng hậu quả là kịch bản **TC-29**. |
| **TC-12** | *"33.333 × 3 = 99.999đ, **hụt** 1đ"* | **Dư** 1đ (làm tròn lên), và **không xảy ra** ở đơn giá 3.000 hiện tại — chỉ lộ khi đổi đơn giá sang số lẻ. Lỗi **đang ngủ**. |
| **TC-22 (tiền đề)** | *"App chỉ check sức chứa đúng 1 chỗ: lúc tạo HV mới"* | **Sai** — không check ở đâu cả, kể cả lúc tạo mới. Xem N-02. |

---

## LỖI MỚI TÌM RA — KHÔNG CÓ TRONG BỘ TEST

### N-01 · API im lặng nuốt field sai tên → tự lấy ngày HÔM NAY 🔴
`POST /api/students/:id/checkout` đọc field `date`. Nếu gửi **`check_out_date`** (đúng bằng tên cột trong DB — cách đặt tên tự nhiên nhất):
```
Gửi:  {"check_out_date":"2026-07-01","checkout_reason":"personal"}
Trả:  HTTP 200 — "thành công"
DB:   check_out_date = 2026-07-15  (HÔM NAY, không phải ngày đã gửi)
      checkout_reason = "other"    (bị ép về "khác")
```
Hoá đơn được **tính lại theo ngày sai** mà không một cảnh báo. Người gọi tưởng đã ghi đúng ngày mình chọn. **Đây là bẫy cho mọi tích hợp về sau (Bravo, Kaizen)** và cho chính đội test — nó đã làm hỏng 2 case của em.

### N-02 · Không có luật sức chứa ở BẤT KỲ đâu — kể cả cửa chính 🔴
Bộ test giả định đường "tạo HV mới" có chặn nên mới đi tìm 4 đường vòng (22a-d). Kiểm chứng riêng:
```
Phòng sức chứa 1 → tạo HV thứ 1 → 201
                 → tạo HV thứ 2 (phòng đã đầy) → 201   ← KHÔNG chặn
Kết quả: 2/1
```
→ **Không cần đi vòng, cửa chính đã mở sẵn.** Điều này làm TC-22b/c/d và TC-23 trở thành cùng một gốc: *luật sức chứa không tồn tại ở server*.

> ### ✅ ĐÃ CHỐT NGHIỆP VỤ (15/07/2026)
> **Vượt sức chứa là CỐ Ý — không được chặn.** Lý do: có giai đoạn học viên mới vào ở chờ học viên cũ xuất cảnh, phòng tạm thời đông hơn số giường. Đây là việc thật, diễn ra thường xuyên.
>
> Vậy TC-22a/b/c/d và TC-23 **KHÔNG phải bug cần chặn**. Yêu cầu đúng là:
> 1. **Cho phép** xếp vượt ở **mọi đường**: tạo mới · sửa hồ sơ · chuyển phòng · check-in lại · duyệt đơn.
> 2. **Bắt buộc cảnh báo trước khi lưu**: người xếp phải thấy rõ *"Phòng 202 đã đủ 4/4 — xếp thêm sẽ thành quá tải 5/4"* và phải bấm xác nhận. Không được lưu im lặng.
> 3. **Bắt buộc ghi vết riêng**: mỗi lần xếp gây quá tải ghi lại **ai xếp · lúc nào · học viên nào · phòng nào · quá tải mấy người**, tra cứu được, không lẫn vào nhật ký chung.
> 4. Đã có sẵn (v64): cảnh báo đỏ *"⚠ quá tải N người (M phòng)"* ở Điều hành, và hiện `6/4` màu đỏ ở màn Phòng.
>
> **Xếp vào kế hoạch:** mục 4 (đưa luật xuống server) — dùng chung **một** hàm `canAssignRoom()` cho cả 5 đường, trả về cảnh báo thay vì chặn. **Không làm trước mục 0–1.**

### N-03 · TC-28 + TC-29 ghép lại nguy hiểm hơn từng cái 🟠
Xoá học viên → biến mất khỏi danh sách, khỏi số "đang ở", khỏi mọi màn quản lý — **nhưng tiền của họ vẫn cộng vào Dự báo doanh thu**. Báo cáo lên sếp có khoản doanh thu **không tra ra được của ai** và **không ai đi thu được**. Càng xoá nhiều, con số càng ảo. Hai case này trong file bị tách rời nên không lộ ra sự kết hợp.

### N-04 · Chỉ số điện lùi còn làm sai DÂY CHUYỀN sang kỳ sau 🟠
Ngoài việc ra 0 kWh (TC-09), app **vẫn lưu lại `đầu=5000, cuối=4000`** vào DB. Kỳ sau lấy `reading_end` của kỳ này (**4000**) làm `reading_start` → **mọi kỳ tiếp theo đều lệch**, không chỉ mất tiền kỳ hiện tại.

---

## KHỚP VỚI "BA VẤN ĐỀ GỐC"

43 lỗi không phải 43 việc phải sửa. Chúng là triệu chứng của **3 gốc** — file test nhận định đúng, và kết quả xác nhận:

**1. Quy tắc chỉ nằm trên giao diện** → TC-21 (giới tính), TC-22a-d + N-02 (sức chứa), TC-24, TC-05 (nguyên phòng), TC-08 (điều kiện hoàn cọc), TC-37b, TC-39 (SĐT), TC-09.
Cứ gọi thẳng API — hoặc chỉ cần **đi đường khác trong chính giao diện** (sửa hồ sơ thay vì tạo mới) — là mọi luật bốc hơi.

**2. CSDL không có tuyến phòng thủ nào** → TC-03 (tiền âm), TC-24 (sức chứa âm), TC-25 (trùng CCCD/số HĐ — **không tính trùng mã HV: đó là cố ý, không phải lỗi**), TC-26 (trùng tên đăng nhập khi chạy song song), TC-34 (kỳ "xyz"), TC-44 (ngưỡng "abc"), TC-40 (trùng biển số).
Không một ràng buộc nào ở tầng dữ liệu. Sai lọt vào là nằm lại vĩnh viễn.

**3. Quyền không thu hồi được** → TC-13, TC-14, TC-15, TC-15b.
Vé ghi sẵn chức vụ, sống 30 ngày, mỗi request chỉ đọc vé không hỏi DB. Giáng chức / xoá tài khoản / đăng xuất đều vô nghĩa.

**Đề xuất thứ tự sửa:** gốc 3 (thu hồi quyền) → TC-01 (chặn mark-paid body rỗng) → gốc 2 (ràng buộc DB) → gốc 1 (đưa luật xuống server). Sửa 3 gốc thì ~35/43 lỗi tự hết.

---

## TRẠNG THÁI DỮ LIỆU SAU KHI TEST

Đã khôi phục **nguyên trạng** từ `pg_dump`:
- 214 học viên · 29 phòng · 130 phiếu `pending` (không còn phiếu nào bị đánh dấu "đã thu")
- Đơn giá đúng: `electric_unit=3000` · `room_fee=1200000` · `violation_mail_threshold=3`
- **0 fixture rác · 0 tài khoản test còn sót**
- **Staging không nhận một request nào từ đợt test này.**

*Lưu ý: TC-19 đã kích hoạt giới hạn đăng nhập theo IP — nếu vừa test xong mà không đăng nhập được vào bản local, đợi 15 phút.*
