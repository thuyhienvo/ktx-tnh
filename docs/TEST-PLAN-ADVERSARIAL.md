# BỘ TEST CASE ĐỐI KHÁNG — App Quản lý KTX

> Mục tiêu: **tìm cho ra lỗi**, không phải xác nhận code chạy đúng như code được viết.
> Mỗi case ghi rõ **KẾT QUẢ ĐÚNG** (theo nghiệp vụ) và **NGHI NGỜ** (dự đoán app sẽ sai).
> Chỗ hai cái lệch nhau = bug.

**Môi trường:** http://localhost:3000 · admin/admin123
**Công cụ:** trình duyệt + DevTools (tab Network), hoặc curl/Postman.

**Mẹo xuyên suốt:** app chấp nhận header `Authorization: Bearer <token>` chứ không chỉ cookie.
Lấy token: DevTools → Application → Cookies → `ktx_token`.
Rất nhiều bug **chỉ lòi ra khi gọi thẳng API**, vì app validate ở giao diện nhưng server không kiểm tra lại.

---

## NHÓM 1 — ĐƯỜNG TIỀN (P0)

### TC-01 · Đánh dấu "đã thu" toàn bộ hệ thống bằng 1 request
- **Tiền đề:** có hóa đơn ở ≥2 kỳ khác nhau, trạng thái `pending`.
- **Bước:** `POST /api/invoices/mark-paid` với body rỗng `{}` (bỏ trống kỳ).
- **Đúng:** báo lỗi "thiếu kỳ", không đổi gì.
- **Nghi ngờ:** đánh dấu ĐÃ THU cho **toàn bộ hóa đơn mọi kỳ, mọi học viên**. Không confirm, không undo. Staff cũng làm được.
- **Mức độ:** Chặn phát hành. Chạy case này ĐẦU TIÊN.

### TC-02 · Sửa hóa đơn đã thu tiền
- **Tiền đề:** 1 hóa đơn `status=paid`.
- **Bước:** màn Tiền phòng → sửa số tiền hóa đơn đó → Lưu.
- **Đúng:** từ chối (chức năng lập HĐ cả kỳ đã khóa HĐ `paid`, sửa tay cũng phải khóa).
- **Nghi ngờ:** sửa được → số liệu lệch Bravo.

### TC-03 · Nhập số tiền âm
- **Bước:** `POST /api/invoices` với `{student_id:1, month:"2026-07", room_charge:-99999999}`.
- **Đúng:** 400.
- **Nghi ngờ:** 201, tổng tiền âm, doanh thu năm bị kéo xuống. Ô nhập có `min=0` nhưng **chỉ là thuộc tính HTML**; server không check; DB không có ràng buộc tiền ≥ 0.
- **Biến thể:** `POST /api/students/:id/deposit` amount âm · `POST /api/rooms` monthly_fee âm.

### TC-04 · Đơn giá là chữ → tiền điện về 0 lặng lẽ
- **Bước:** `PUT /api/settings` với `{electric_unit:"abc"}` → lập hóa đơn cả kỳ.
- **Đúng:** từ chối giá trị không phải số.
- **Nghi ngờ:** lưu OK → NaN → làm tròn về 0 → **toàn bộ tiền điện = 0, không cảnh báo**.
- **Biến thể:** `{room_fee:"-1200000"}` → HĐ âm hàng loạt · `{partial_half_min:20, partial_full_min:10}` → logic tháng lẻ đảo lộn.

### TC-05 · Hai học viên cùng thuê nguyên một phòng → thu 2 lần
- **Bước:** 2 học viên, cùng phòng 305, cả hai `rental_type = "nguyên phòng"` → lập HĐ.
- **Đúng:** chặn ngay khi gán người thứ 2 vào phòng đã cho thuê nguyên.
- **Nghi ngờ:** không có ràng buộc. Mỗi người bị tính **trọn giá nguyên phòng** (hạng A = 5,5tr) → thu 11tr cho 1 phòng.

### TC-06 · Trả phòng rồi vẫn bị thu tiền tháng sau
- **Bước:** lập HĐ tháng 8 cho HV A → cho A check-out 15/07 → mở lại HĐ tháng 8.
- **Đúng:** HĐ tháng 8 bị xóa hoặc về 0.
- **Nghi ngờ:** HĐ tháng 8 **còn nguyên, vẫn thu tiền**. Check-out chỉ tính lại đúng tháng check-out.

### TC-07 · Khấu trừ cọc vượt số cọc / khấu trừ âm
- **Bước:** HV có cọc 1.200.000 → khấu trừ hư hao `deduction: 10000000` → rồi thử `deduction: -500000`.
- **Đúng:** chặn cả hai.
- **Nghi ngờ:** cả hai đều qua. Khấu trừ âm = **trả cho HV nhiều hơn số họ đã cọc**.

### TC-08 · Hoàn cọc cho người không đủ điều kiện
- **Tiền đề:** HV báo trả phòng trước 5 ngày (quy định 30 ngày), lý do "cá nhân".
- **Bước:** check-out → app hiện "không đủ điều kiện hoàn cọc" → bỏ qua, bấm tất toán cọc = "đã hoàn".
- **Đúng:** chặn, hoặc bắt nhập lý do ghi đè + ghi vết.
- **Nghi ngờ:** hoàn thoải mái. Kết luận hoàn cọc **chỉ là gợi ý hiển thị**; khâu tất toán không kiểm tra lại.

### TC-09 · Chỉ số điện lùi → nuốt lỗi
- **Bước:** phòng 305, chỉ số đầu 5000, chỉ số cuối 4000 (gõ nhầm thứ tự).
- **Đúng:** báo lỗi "chỉ số cuối phải lớn hơn chỉ số đầu".
- **Nghi ngờ:** **âm thầm ra 0 kWh**, tiền điện = 0, không ai biết cho tới khi đối chiếu điện lực.
- **TC-09b:** chỉ số cuối = 999999999 → tiền điện hàng tỷ, không ngưỡng cảnh báo.

### TC-10 · Chuyển phòng giữa tháng → tiền điện phòng cũ chia sai
- **Tiền đề:** phòng A có 3 người, phòng B có 2 người, cả 2 đã nhập chỉ số điện.
- **Bước:** 15/07 chuyển HV X từ A sang B → lập HĐ tháng 7.
- **Đúng:** X trả nửa tháng điện phòng A + nửa tháng phòng B; 2 người ở lại A không tăng tiền.
- **Nghi ngờ:** chuyển phòng chỉ đổi mã phòng, **không tách HĐ**. X bị tính trọn tháng theo phòng mới, và **2 người ở lại A gánh phần điện của X**.

### TC-11 · Ở 1 ngày vẫn ăn trọn 1 suất chia điện
- **Bước:** phòng 2 người ở cả tháng + HV C check-in 01/07 và check-out luôn 01/07 → lập HĐ tháng 7.
- **Đúng:** điện chia theo mức độ ở thực tế.
- **Nghi ngờ:** C tính là 1 suất đầy đủ → điện chia 3 thay vì 2 (2 người ở thật được giảm sai), và **C bị thu tiền điện dù ở 1 ngày** (điện không nhân hệ số tháng lẻ như nước/dịch vụ).

### TC-12 · Tiền điện thất thoát do làm tròn
- **Bước:** phòng 3 người, đặt chỉ số sao cho tiền điện phòng = 100.000đ → lập HĐ → cộng tay tiền điện 3 người.
- **Đúng:** tổng = 100.000đ.
- **Nghi ngờ:** 33.333 × 3 = **99.999đ, hụt 1đ**. Nhân số phòng × 12 tháng → sổ sách lệch mãi.

---

## NHÓM 2 — PHÂN QUYỀN & ĐĂNG NHẬP (P0)

### TC-13 · Mật khẩu mặc định vẫn dùng API được
- **Bước:** login `admin/admin123` → app bắt đổi mật khẩu → **ĐỪNG đổi** → gọi thẳng `GET /api/admin/users`.
- **Đúng:** 403 cho tới khi đổi mật khẩu.
- **Nghi ngờ:** **200 OK, ra toàn bộ danh sách tài khoản**. Màn "bắt buộc đổi mật khẩu" chỉ là lớp giao diện; server đã cấp token đầy đủ quyền ngay từ lúc login.

### TC-14 · Giáng chức admin nhưng quyền vẫn còn 30 ngày
- **Bước:** admin B login, lưu token → admin A hạ B xuống staff → B dùng token cũ gọi `PUT /api/settings`.
- **Đúng:** 403.
- **Nghi ngờ:** **vẫn 200**. Quyền đọc từ token, không đọc DB; token sống 30 ngày, không thu hồi được.

### TC-15 · Tài khoản đã vô hiệu hóa vẫn gọi API
- **Bước:** staff C login, lưu token → admin xóa tài khoản C → C dùng token cũ gọi `GET /api/students`.
- **Đúng:** 401.
- **Nghi ngờ:** **200**. Login có check tài khoản bị xóa, mỗi request sau đó thì không.
- **TC-15b:** đăng xuất rồi dùng lại token vừa lưu → vẫn chạy (logout chỉ xóa cookie ở máy client).

### TC-16 · Nhân viên giả danh học viên
- **Bước:** login staff → mở hồ sơ HV bất kỳ → cấp/đổi mật khẩu tài khoản HV đó → login bằng tài khoản vừa đặt.
- **Đúng:** ít nhất phải ghi vết rõ "staff X đổi mật khẩu của HV Y"; cân nhắc chỉ cho admin.
- **Nghi ngờ:** làm được, xem toàn bộ HĐ + vi phạm của HV đó.

### TC-17 · Bảo trì sửa được dữ liệu ảnh hưởng tới tiền
- **Bước:** login `maintenance` → dùng bàn giao trả phòng để ghi ngày rời đi.
- **Đúng:** bảo trì chỉ xác nhận tình trạng cơ sở vật chất.
- **Nghi ngờ:** thao tác này **ghi ngày check-out và kích hoạt tính lại hóa đơn**. Bảo trì sửa được đường tiền. Kèm theo: đọc được tên + SĐT mọi HV.

### TC-18 · Học viên thao tác không để lại vết
- **Bước:** login HV → gửi đơn xin trả phòng, bật đăng ký máy giặt → login admin → mở Lịch sử.
- **Đúng:** có ghi nhận.
- **Nghi ngờ:** **trống trơn**. Nhật ký bỏ qua mọi thao tác của HV → tranh chấp "em không hề đăng ký máy giặt" thì không có bằng chứng.

### TC-19 · Một người gõ sai mật khẩu khóa cả công ty
- **Bước:** từ 1 máy gõ sai mật khẩu 20 lần → **máy khác cùng mạng văn phòng** thử login đúng.
- **Đúng:** khóa theo tài khoản, không theo mạng.
- **Nghi ngờ:** giới hạn theo IP → cả văn phòng chung 1 IP → **toàn bộ nhân viên bị chặn 15 phút**. Lỗi vận hành thật, sẽ xảy ra.

### TC-20 · Số liệu công khai đếm cả bản ghi đã xóa
- **Bước:** ghi số ở trang giới thiệu công khai (không login) → xóa 1 HV → tải lại trang.
- **Nghi ngờ:** con số **không giảm** — trang công khai đếm cả HV đã xóa, lệch với trang quản trị.

---

## NHÓM 3 — QUY TẮC PHÒNG Ở (P1)

### TC-21 · Nam ở phòng nữ
- **Bước:** `POST /api/students` với `{gender:"male", room_id:<phòng nữ>}`.
- **Đúng:** 400.
- **Nghi ngờ:** **201 Created**. Giao diện lọc phòng theo giới tính khi chọn, nhưng **server không kiểm tra giới tính phòng ở bất kỳ đâu** — không ở tạo mới, sửa, check-in, chuyển phòng, duyệt đơn.
- **Biến thể không cần API:** tạo HV nam → chọn phòng nam → lưu → **sửa lại giới tính thành nữ** → lưu.

### TC-22 · Vượt sức chứa qua đường vòng
App **chỉ check sức chứa đúng 1 chỗ**: lúc tạo HV mới. Bốn đường sau đều không check:
- **22a:** tạo HV không phòng → **sửa hồ sơ** gán vào phòng đã đầy 4/4 → nghi ngờ: 200, thành 5/4.
- **22b:** dùng **chuyển phòng** dồn 10 HV vào 1 phòng capacity 4.
- **22c:** **check-in** HV đã check-out vào phòng đã đầy.
- **22d:** **duyệt đơn đăng ký** công khai vào phòng đã đầy.
- **Đúng:** cả 4 báo "phòng đã đầy".

### TC-23 · Hai người cùng nhận chỗ cuối cùng (race)
- **Tiền đề:** phòng còn đúng 1 chỗ (3/4).
- **Bước:** gửi **2 request `POST /api/students` song song** cho 2 HV khác nhau vào phòng đó.
- **Đúng:** 1 thành công, 1 báo phòng đầy.
- **Nghi ngờ:** **cả hai thành công → 5/4**. App đếm chỗ trống rồi mới ghi; 2 request cùng đọc "còn 1 chỗ".
- **Lưu ý:** app **không quản lý từng giường** (không có thực thể giường) → "2 người 1 giường" biểu hiện thành "vượt sức chứa".

### TC-24 · Sức chứa vô lý
- **Bước:** `POST /api/rooms` với `capacity:-5`, rồi `capacity:99` cho phòng hạng D (thực tế 3 giường).
- **Nghi ngờ:** cả hai lưu được. Quy tắc "hạng D = 3 giường" chỉ có trên giao diện.

### TC-25 · Trùng phòng / mã HV / CCCD / số hợp đồng
Cùng bản chất — **DB không có ràng buộc chống trùng**:
- **25a:** 2 phòng cùng tên "305" cùng cơ sở → nghi ngờ: được.
- **25b:** 2 HV cùng mã "HV001" → nghi ngờ: được (mã HV còn dùng làm username mặc định).
- **25c:** 2 HV cùng số CCCD → nghi ngờ: được. Một người 2 hồ sơ, 2 hợp đồng.
- **25d:** 2 nhân viên cùng bấm "Gợi ý số hợp đồng" → nghi ngờ: **ra cùng một số** (vd cả hai `05/2026/HDKTX-E2`). Số HĐ sinh bằng đếm+1, không có ràng buộc chống trùng.

### TC-26 · Tên đăng nhập phân biệt hoa thường
- **Bước:** tạo tài khoản `Nam` → rồi tạo `nam`.
- **Nghi ngờ:** app chặn (check trùng bỏ dấu hoa thường). Nhưng **gửi 2 request song song** thì cả hai lọt (ràng buộc DB phân biệt hoa thường). Hậu quả nặng: login tìm không phân biệt hoa thường → **ra 2 tài khoản → lấy đại cái đầu → đăng nhập nhầm người**.

### TC-27 · Tầng bị suy sai từ tên phòng
App đoán tầng bằng **chữ số đầu tiên trong tên phòng**. Tạo và xem tầng hiển thị:
- `"305"` → 3 ✅ · `"A203"` → 2 ✅
- `"Nhà 2 - 305"` → **ra tầng 2, SAI** (phải là 3)
- `"1305"` → **ra tầng 1, SAI** (phải là 13)
- **Hệ quả:** tầng sai → pháp nhân E2/S2 hiển thị sai → **số hợp đồng cấp sai**.

---

## NHÓM 4 — XÓA & TRẠNG THÁI (P1)

### TC-28 · Xóa học viên đang còn nợ
- **Bước:** HV có HĐ `pending` 2tr chưa thu → xóa HV → mở Dự báo doanh thu.
- **Đúng:** chặn, hoặc cảnh báo "HV còn công nợ 2.000.000đ".
- **Nghi ngờ:** xóa được không hỏi han. **Khoản nợ biến mất khỏi mọi báo cáo** — công nợ bị xóa sổ bằng 1 click.

### TC-29 · Doanh thu vẫn tính hóa đơn của học viên đã xóa
- **Bước:** ghi doanh thu năm → xóa 1 HV đã có HĐ `paid` → xem lại doanh thu năm.
- **Nghi ngờ:** **doanh thu không đổi** — báo cáo doanh thu không lọc HV đã xóa. Kết hợp TC-28: **nợ thì biến mất, doanh thu thì còn** → hai con số mâu thuẫn.

### TC-30 · Không xóa được phòng vì người đã xóa
- **Bước:** phòng 305 có 1 HV → xóa HV đó → xóa phòng 305.
- **Đúng:** phòng trống → xóa được.
- **Nghi ngờ:** **báo "phòng còn người ở"** — điều kiện chặn xóa phòng không loại trừ HV đã xóa. Phòng kẹt vĩnh viễn.

### TC-31 · Khôi phục học viên vào phòng đã đầy
- **Bước:** xóa 5 HV khỏi phòng capacity 4 → xếp 4 người mới vào → vào thùng rác, khôi phục cả 5 người cũ.
- **Nghi ngờ:** khôi phục hết → **9 người trong phòng 4 chỗ**. Chức năng khôi phục không check chỗ trống.

### TC-32 · Duyệt đơn hai lần / từ chối đơn đã duyệt
- **32a:** duyệt đơn đăng ký (đã tạo ra HV) → bấm **Từ chối** chính đơn đó → nghi ngờ: từ chối được, mà HV vẫn tồn tại. Đơn ghi "đã từ chối" nhưng người đã ở trong KTX.
- **32b:** xác nhận đơn trả phòng → **xác nhận lần nữa** → nghi ngờ: check-out 2 lần, **ghi 2 dòng nhật ký ra/vào và tính lại HĐ thêm lần nữa**.
- **Đúng:** cả hai báo "đơn đã xử lý rồi".

### TC-33 · Trạng thái mâu thuẫn giữa 2 nơi
- **Bước:** tạo HV với ngày vào **tương lai** (01/09/2026) → xem Tổng quan và Danh sách phòng.
- **Nghi ngờ:** app có **2 cách hiểu "đang ở"** — một cột trạng thái trong DB, một cách tính động theo ngày. Người chưa đến ở có thể bị đếm là đang ở (chiếm chỗ, chặn xóa phòng) ở màn này nhưng không ở màn kia. Đối chiếu kỹ số liệu 2 màn.

---

## NHÓM 5 — DỮ LIỆU RÁC & VALIDATE (P1–P2)

### TC-34 · Kỳ hóa đơn không hợp lệ
- **Bước:** `POST /api/invoices` với `month:"2026-13"`, rồi `"xyz"`, rồi `""`.
- **Đúng:** 400.
- **Nghi ngờ:** lưu được hết. Dây chuyền: ràng buộc "1 HV 1 HĐ mỗi kỳ" mất tác dụng; báo cáo doanh thu cắt 4 ký tự đầu lấy năm → ra năm "xyz…".

### TC-35 · Màn chỉ số điện sập với tham số rác
- **Bước:** mở `/api/electric?month=abc`.
- **Nghi ngờ:** **lỗi 500**. App tách chuỗi kỳ để tính tháng trước mà không kiểm tra định dạng.

### TC-36 · Nhập nửa chừng khi lưu chỉ số điện hàng loạt
- **Bước:** nhập chỉ số cho 20 phòng, phòng thứ 10 có dữ liệu gây lỗi → Lưu.
- **Đúng:** hoặc lưu hết, hoặc không lưu gì.
- **Nghi ngờ:** **9 phòng đầu đã lưu, 11 phòng sau không** — không lưu trọn gói. Nhập lại từ đầu sẽ ghi đè lộn xộn.

### TC-37 · Ngày check-out trước ngày check-in
- **37a:** tạo HV, ngày vào 01/08, ngày ra 01/07 → mong đợi: chặn (case này app CÓ kiểm tra).
- **37b:** **nhưng** thử qua **màn check-out**: ngày rời đi **trước ngày nhận phòng** → nghi ngờ: **không kiểm tra gì**, lọt. Số ngày ở âm → tiền phòng âm.
- **37c:** thử qua **cổng bảo trì** (bàn giao trả phòng) với ngày lùi tương tự.

### TC-38 · Ngày sinh bị nuốt lặng lẽ
- **Bước:** form đăng ký công khai, ngày sinh `2050-01-01` (tương lai) hoặc `31/02/2000`.
- **Đúng:** báo lỗi cho người nhập.
- **Nghi ngờ:** đơn gửi thành công nhưng **ngày sinh bị bỏ trống âm thầm** — người dùng tưởng đã khai, admin thấy trống, không ai biết đã mất dữ liệu.

### TC-39 · Số điện thoại
- **Bước:** thử `abc` · `123` (ngắn) · `0901234567890123456` (dài) · `090 123 4567` (có dấu cách) · `+84901234567`.
- **Ghi lại chính xác cái nào lọt.** App check 8–15 chữ số ở **đơn đăng ký công khai** — kiểm tra xem **form học viên trong trang quản trị có check không** (nghi ngờ: không).

### TC-40 · Trùng biển số xe
- **Bước:** đăng ký biển `59X1-12345` cho HV A → đăng ký **đúng biển đó** cho HV B.
- **Nghi ngờ:** được. Phí gửi xe tính theo số xe → **thu tiền 2 người cho 1 chiếc xe**, hoặc 1 người dùng thẻ xe của người kia.

### TC-41 · Hai nguồn sự thật cho phí gửi xe
- **Bước:** bật ô "có gửi xe" trong hồ sơ HV nhưng **không** thêm xe nào → lập HĐ. Rồi làm ngược: tắt ô đó nhưng thêm 2 xe.
- **Nghi ngờ:** kết quả không nhất quán — app tính phí theo danh sách xe nhưng vẫn giữ ô "có gửi xe" làm nguồn dự phòng. **Xác định trường hợp nào bị thu thiếu.**

---

## NHÓM 6 — VI PHẠM & THÔNG BÁO (P2)

### TC-42 · Gửi mail nhà trường 2 lần
- **Tiền đề:** HV đã có 2 vi phạm (ngưỡng gửi mail = 3).
- **Bước:** 2 nhân viên cùng ghi vi phạm thứ 3 **cùng lúc**.
- **Nghi ngờ:** cả hai đều được đánh mức 3 → **gửi 2 email cho nhà trường** về cùng 1 HV. Cấp độ vi phạm đếm+1, không chống trùng.

### TC-43 · Xóa vi phạm giữa chừng
- **Bước:** HV có 3 vi phạm (đã gửi mail trường) → xóa vi phạm số 2 → xem lại cấp độ + trạng thái đã báo trường.
- **Kiểm tra:** app đánh số lại cấp độ — nhưng **cờ "đã báo nhà trường" có được gỡ không?** Nếu không: HV còn 2 vi phạm mà hồ sơ vẫn ghi đã báo trường.

### TC-44 · Hạ ngưỡng gửi mail
- **Bước:** đổi ngưỡng gửi mail từ 3 xuống 1 → ghi 1 vi phạm mới cho HV đã có 5 vi phạm cũ.
- **Kiểm tra:** có gửi mail dồn dập cho vi phạm cũ không? Đặt ngưỡng = 0 hoặc âm thì sao (nghi ngờ: **không validate** — đơn giá và ngưỡng đều lưu dạng chữ, không kiểm tra).

---

## NHÓM 7 — XUẤT FILE & GIAO DIỆN (P2)

### TC-45 · Công thức Excel chạy khi mở CSV (CSV injection)
- **Bước:** đặt tên HV = `=1+1` hoặc ghi chú = `=HYPERLINK("http://evil.com","Click")` → xuất CSV Tiền phòng → mở bằng Excel.
- **Đúng:** hiện đúng chuỗi văn bản.
- **Nghi ngờ:** **Excel chạy như công thức**. Lỗ hổng thật — người nhận file có thể bị tấn công. App có escape dấu ngoặc kép nhưng không chặn `=`, `+`, `-`, `@` ở đầu ô.

### TC-46 · Chèn mã HTML vào tên (XSS)
- **Bước:** đặt tên HV = `<img src=x onerror=alert(1)>` và `<b>đậm</b>` → xem ở: danh sách HV, tổng quan, phiếu báo tiền phòng, báo cáo điều hành, cổng học viên.
- **Đúng:** hiện nguyên văn ở **mọi** màn hình.
- **Lý do soi kỹ:** app **tắt hoàn toàn CSP** và dựng giao diện bằng ghép chuỗi HTML. Chỉ cần 1 chỗ quên lọc là chạy mã. Thử càng nhiều màn càng tốt, kể cả tên phòng, ghi chú, lý do trả phòng.

### TC-47 · Upload ảnh CCCD
- **47a:** file `.svg` chứa script → mong đợi: **chặn** (lỗi đã vá — kiểm tra còn vá không).
- **47b:** file 20MB → mong đợi: chặn (giới hạn 8MB).
- **47c:** đổi tên `virus.exe` → `anh.jpg` rồi upload → app có nhận không?
- **47d:** login HV A → gọi đường dẫn ảnh CCCD của **HV B** → mong đợi: 403.

### TC-48 · Lập hóa đơn cho toàn bộ ký túc xá
- **Bước:** với dữ liệu thật (~240 HV) bấm "Lập hóa đơn cả kỳ". **Đo thời gian chạy.**
- **Nghi ngờ:** xử lý từng HV tuần tự trong 1 giao dịch, mà DB có **giới hạn 15 giây mỗi câu lệnh** → có thể **timeout giữa chừng**. Nếu quá 10 giây → bom hẹn giờ khi dữ liệu tăng.
- **Kèm:** bấm nút này **2 lần liên tiếp thật nhanh** → có tạo HĐ trùng hoặc kẹt không?

---

## Thứ tự ưu tiên

**Nếu chỉ có nửa ngày, chạy đúng 10 case này:**
TC-01 · TC-13 · TC-21 · TC-22a · TC-28 · TC-04 · TC-06 · TC-14 · TC-09 · TC-30

## Ba vấn đề gốc (không phải lỗi lẻ)

Phần lớn 48 case trên là **triệu chứng của 3 nguyên nhân chung**. Sửa 3 gốc này thì hàng chục case tự hết:

1. **Quy tắc chỉ nằm trên giao diện.** "Phòng nữ chỉ cho nữ ở", "phòng 4 giường chỉ chứa 4 người" — app chỉ ẩn/hiện lựa chọn cho đúng, server ai gửi gì cũng nhận. Chỉ cần thao tác hơi khác đường thông thường (sửa hồ sơ thay vì tạo mới, chuyển phòng thay vì check-in) là quy tắc mất tác dụng.
2. **Cơ sở dữ liệu không có tuyến phòng thủ nào.** Không ràng buộc tiền ≥ 0, không chống trùng mã HV / CCCD / số HĐ, không ràng buộc giá trị trạng thái. Dữ liệu sai lọt vào là nằm lại vĩnh viễn.
3. **Quyền hạn không thu hồi được.** Login cấp "vé" ghi sẵn chức vụ, dùng được 30 ngày. Giáng chức hay xóa tài khoản thì vé cũ vẫn chạy — mỗi request chỉ đọc vé, không hỏi lại DB.

## Lưu ý về tài liệu cũ

`docs/TEST-REPORT.md` tuyên bố **338 test case đạt 100%** và "đường tiền không sai số tính toán". Nhưng **repo không có một test tự động nào**, và các lỗ hổng TC-01/TC-13/TC-14/TC-21/TC-22 ở trên **không hề được nhắc tới** trong báo cáo đó. Coi tài liệu ấy là tham khảo, không phải bằng chứng độ phủ.
