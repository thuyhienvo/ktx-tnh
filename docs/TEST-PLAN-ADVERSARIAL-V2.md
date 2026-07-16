# BỘ TEST ĐỐI KHÁNG V2 — PHỦ TỪNG CHỨC NĂNG

> **Bộ này bổ sung, không thay thế `TEST-PLAN-ADVERSARIAL.md`.**
> Bộ v1 (48 case) gom theo **nhóm rủi ro** và đã chạy 15/07/2026 — nó phủ rất kỹ đường tiền, phân quyền,
> xếp phòng, xoá/khôi phục. Nhưng đối chiếu lại thì app có **121 endpoint / 18 module**, và **13 chức năng
> chưa từng có một case nào**: vi phạm, SMTP, xe, tài sản, cơ sở, bảo trì, đơn từ, cổng học viên,
> trang công khai, duyệt đơn, ảnh/tài liệu, nhật ký, báo cáo, quản trị tài khoản, **chuông báo**.
> **V2 phủ đúng phần còn trống đó**, mỗi chức năng một nhóm — **85 case / 15 nhóm**.
>
> Nhóm 15 (chuông báo) là phần **giao diện thuần** duy nhất của bộ này — bổ sung 16/07 theo yêu cầu.
> Phần giao diện còn lại nằm ở `TEST-PLAN-UI-UX-ADVERSARIAL.md`, bộ đó **không phủ chuông**.

**Mục tiêu:** tìm cho ra lỗi, không phải xác nhận code chạy đúng như code được viết.
Mỗi case ghi **KẾT QUẢ ĐÚNG** (theo nghiệp vụ) và **NGHI NGỜ** (dự đoán app sẽ sai, kèm `file:line`).
Chỗ hai cái lệch nhau = bug.

**Môi trường:** `http://localhost:3000` · **CHỈ LOCAL**. Không gửi một request nào lên `ktx-tnh.onrender.com`.
**Trước khi chạy:** `pg_dump` backup. Nhóm 12 (SMTP) và nhóm 14 (quản trị) **có case tự khoá quyền / gọi ra mạng ngoài** — đọc cảnh báo tại chỗ.

**Mẹo xuyên suốt (giữ nguyên từ v1):** app nhận `Authorization: Bearer <token>` chứ không chỉ cookie
(`server/auth.js:27-28`). Lấy token ở DevTools → Application → Cookies → `ktx_token`.
**Phần lớn case dưới đây chỉ lòi ra khi gọi thẳng API** — app validate ở giao diện, server không kiểm lại.

---

## NHÓM 1 — VI PHẠM & GỬI MAIL NHÀ TRƯỜNG (P0)

Chức năng này **đụng tới danh dự học viên và gửi mail ra ngoài tổ chức**, mà cả bảng `violations`
lẫn `violations.routes.js` đều nằm ngoài mọi lớp phòng thủ: file **không import `valid.js`** dòng nào
(`violations.routes.js:1-4`), và khối ràng buộc CSDL (`schema.sql:370-441`) **không có một dòng nào cho `violations`**.

### V2-01 · Mail báo trường gửi trùng vô hạn
- **Tiền đề:** HV đã có 2 vi phạm, ngưỡng gửi mail = 3. SMTP trỏ về hộp thư test.
- **Bước:** ghi vi phạm thứ 3 → thứ 4 → thứ 5. Đếm số mail nhận được.
- **Đúng:** đúng **1 mail**, gửi khi vừa chạm ngưỡng.
- **Nghi ngờ:** **3 mail**. `violations.routes.js:126` dùng `if (level >= threshold)` — là `>=` chứ không phải `===`, và **không kiểm cột `notified_school`** dù cột đó (`schema.sql:258`) sinh ra chính để làm việc này. Nhánh đọc (`:71`) có dùng, nhánh ghi thì không.
- **Kèm:** `:130` `UPDATE ... WHERE student_id=$1` quét **mọi** dòng của HV kể cả bản đã xoá mềm, ghi đè `notified_at` → mất mốc "lần đầu báo trường".
- **Mức độ:** Chặn phát hành. Nhà trường bị dội mail trùng về cùng một học viên.

### V2-02 · Hai staff ghi vi phạm cùng lúc → 2 mail + số lần trùng
- **Bước:** HV có 2 vi phạm → gửi **2 request `POST /api/violations` song song** cho HV đó.
- **Đúng:** một cái là lần 3, cái kia là lần 4. Một mail.
- **Nghi ngờ:** `:113` `SELECT COUNT(*)` rồi `:115` `INSERT` — hai câu riêng, **không transaction, không lock**. Cả hai đọc `c=2` → cả hai ghi `level=3` → cả hai thấy đủ ngưỡng → **2 mail**. Không có unique `(student_id, level)` để DB đỡ.
- **Mức độ:** Cao. Đúng cái bẫy mà `schema.sql:394-397` đã nhận diện và vá cho chỗ khác.

### V2-03 · Bấm "Gửi mail" là mail bay, bất kể ngưỡng
- **Bước:** HV mới vi phạm **1 lần** → `POST /api/violations/student/:id/notify`.
- **Đúng:** từ chối, chưa đủ ngưỡng.
- **Nghi ngờ:** mail bay. `:164-174` chỉ kiểm `if (!all.length)` — **không kiểm `threshold`, không kiểm `notified_school`**. Giao diện hứa "đủ 3 lần mới gửi" (`app.js:1959`) — lời hứa đó chỉ là chữ trên màn hình.
- **Biến thể:** gọi 50 lần liên tiếp → 50 mail mang danh Ban quản lý KTX, nội dung là trường `note` do staff tự gõ (`mailer.js:68`), **không giới hạn độ dài**. Rate limit duy nhất: 600 req/phút toàn `/api` (`index.js:28`).

### V2-04 · Ghi vi phạm cho học viên đã xoá → bản ghi vô hình, mail vẫn bay
- **Bước:** xoá HV → `POST /api/violations {student_id:<HV vừa xoá>, type_id:1}`.
- **Đúng:** 400.
- **Nghi ngờ:** 201. `:101` `SELECT ... FROM students WHERE id=$1` **thiếu `AND deleted_at IS NULL`**, trong khi `GET /` (`:91`) và `/stats` (`:68`) đều lọc. Bản ghi nằm trong DB nhưng **không hiện ở màn nào**, mà `level>=threshold` thì **mail vẫn tố một học viên không còn hồ sơ**.

### V2-05 · Backdate vi phạm → kích hoạt mail sai
- **Bước:** HV có 2 vi phạm ngày 10/07 và 12/07 → ghi thêm 1 vi phạm với `date:"2026-01-02"`.
- **Đúng:** đây là lần đầu theo thời gian → level 1, không mail.
- **Nghi ngờ:** INSERT gán `level = COUNT+1 = 3` (`:113`) → **mail báo trường ngay**. Rồi xoá một vi phạm bất kỳ → `:155` đánh lại level bằng `ROW_NUMBER() OVER (ORDER BY date, id)` → nó thành level 1. **Hai công thức đếm mâu thuẫn nhau trong cùng một file.** Mail thì đã gửi rồi.

### V2-06 · Tự chế loại vi phạm, tự chọn mức độ
- **Bước:** `POST /api/violations {student_id:1, type_name:"Bịa ra", severity:"minor"}` — **không kèm `type_id`**.
- **Đúng:** 400, loại vi phạm phải chọn từ danh mục.
- **Nghi ngờ:** 201. `:105` `typeId = b.type_id || null` — **`type_id` là tuỳ chọn**. Giao diện chỉ gửi `type_id` từ `<select>` (`app.js:1968`), server thì cho gõ tay. `GET /stats` gom nhóm theo `type_name` (`:56`) → thống kê vỡ.
- **Biến thể:** dùng `type_id` của loại **đã bị "xoá"** (`active=false`) → `:107` không kiểm `active` → vẫn ghi được. "Xoá" chỉ có tác dụng với UI.

### V2-07 · Mức độ nhập sai → âm thầm hạ xuống nhẹ nhất
- **Bước:** `POST /api/violations {..., severity:"catastrophic"}`, rồi `PUT /api/violations/:id {status:"REZOLVED"}`.
- **Đúng:** 400 cả hai.
- **Nghi ngờ:** 201/200. `SEV()` (`:9`) ép `catastrophic` → **`minor`** im lặng. `:142` ép `REZOLVED` → **`open`** im lặng. Nhập sai mức độ = **hạ mức độ**; nhập sai trạng thái = đơn tưởng đã đóng mà vẫn mở. `schema.sql:240,252,257` chỉ có comment `-- 'minor'|'major'|'severe'`, **không có CHECK nào**.

### V2-08 · PUT vi phạm xoá trắng ghi chú
- **Bước:** vi phạm có `note` và `admin_note` → `PUT /api/violations/:id {status:"resolved"}` (chỉ đổi trạng thái).
- **Đúng:** giữ nguyên 2 ghi chú.
- **Nghi ngờ:** `:141-142` `SET note=$1, admin_note=$2` với `b.note || ''` → **cả hai bị xoá sạch**. PUT toàn phần đội lốt PATCH; UI luôn gửi đủ field nên không lộ, gọi API thì mất dữ liệu.

### V2-09 · Gõ nhầm tên trường → app trả 200 và nuốt im lặng
- **Bước:** `POST /api/violations {student_id:1, type_id:1, violation_date:"2026-01-05"}` (đúng tên phải là `date`).
- **Đúng:** 400 "trường không hợp lệ".
- **Nghi ngờ:** 201, `:112` **tự lấy ngày hôm nay**. `valid.js:54-55` có sẵn `rejectUnknown()` kèm comment nêu **đích danh** sự cố này ("trước đây gửi `check_out_date` thay vì `date` thì app trả 200 rồi tự lấy ngày hôm nay") — `violations.routes.js` không import dòng nào.
- **Biến thể:** `PUT /:id {severity:"severe"}` → 200 kèm bản ghi **không đổi**. Người dùng tưởng đã sửa.

### V2-10 · Ngày rác → 500 thay vì 400; tên loại rỗng
- **Bước:** `POST /api/violations {..., date:"2026-02-30"}`; rồi `PUT /api/violations/types/1 {}`.
- **Nghi ngờ:** case 1 → **500** (`:112` nhét thẳng vào cột DATE). `date:"2200-01-01"` thì **nhận**, không chặn tương lai. Case 2 → `:30-31` đẩy `(name||'').trim()` vào `SET name=$1` không kiểm → **tên loại thành chuỗi rỗng** (`NOT NULL` vẫn thoả) → danh mục hiện dòng trắng, mail in ra `"Vi phạm"` (`mailer.js:68`). POST thì có kiểm (`:21`), PUT thì không.

### V2-11 · Không biết ai đã ghi vi phạm cho ai
- **Bước:** ghi 1 vi phạm → `POST /student/:id/notify` → mở `GET /api/admin/audit`.
- **Đúng:** truy được: staff nào, HV nào, gửi tới địa chỉ nào, thành công không.
- **Nghi ngờ:** bảng `violations` (`schema.sql:247-261`) **không có cột `created_by`** — trong khi `meter_reads.created_by` (`:320`) và `room_leaders.created_by` (`:455`) đều có. Audit chỉ ghi `req.body` + path (`index.js:58-64`); notify có body rỗng → detail là `{}`. **Không ghi đích mail, không ghi kết quả**, dù `sendViolationMail` trả về `{sent, to}` (`mailer.js:96`).
- **Mức độ:** Cao. Hành động có tác động ra ngoài tổ chức mà không truy vết được.

---

## NHÓM 2 — CÀI ĐẶT & SMTP (P0 — có case gọi ra mạng ngoài)

### V2-12 · ⚠️ Nút "Test SMTP" làm rò mật khẩu SMTP đã lưu ra máy chủ bất kỳ
> **Chạy case này bằng một host mình kiểm soát (vd `nc -l 25` trên chính máy mình), tuyệt đối không trỏ ra Internet.**
- **Tiền đề:** đã lưu cấu hình SMTP thật (có `smtp_pass`).
- **Bước:** `POST /api/settings/smtp/test {"smtp_host":"<host của mình>","smtp_port":25,"smtp_user":"...","smtp_pass":""}` → xem host đó nhận được gì.
- **Đúng:** từ chối. Đổi host đích thì **bắt buộc** phải nhập lại mật khẩu — không được ghép credential đã lưu với host do người gọi chỉ định.
- **Nghi ngờ:** `mailer.js:47` `smtp_pass: (override.smtp_pass && ...) ? override.smtp_pass : saved.smtp_pass` — pass **lấy từ DB**; `mailer.js:43` host **lấy từ body**. `:53` `verify()` → nodemailer **AUTH mật khẩu KTX vào host của mình**. Bắt được mật khẩu ngay trên dây.
- **Vì sao nặng:** nó **vô hiệu hoá toàn bộ công sức giấu `smtp_pass`** ở `settings.routes.js:10-17` (GET/PUT che rất kỹ, `app.js:2632` còn hứa "mật khẩu SMTP không bao giờ được trả về"). Và audit **trông hoàn toàn bình thường** — `index.js:60` che `smtp_pass` thành `***`, mà ở đây body vốn để trống; cái bị rò là giá trị trong DB.
- **Mức độ:** Chặn phát hành.

### V2-13 · Máy chủ KTX thành máy quét cổng nội bộ
- **Bước:** `POST /api/settings/smtp/test` với `smtp_host:"127.0.0.1"` rồi `"169.254.169.254"` rồi `"10.0.0.5"`, `smtp_port` đổi dần. Đọc kỹ thông điệp trả về.
- **Đúng:** chặn host nội bộ/loopback/link-local.
- **Nghi ngờ:** không allow-list gì. `mailer.js:55-57` `catch (e) { return { ok:false, reason: e.message } }` → **lỗi gốc trả nguyên văn về client** (`settings.routes.js:32`) → phân biệt được `ECONNREFUSED` (cổng đóng) / timeout (firewall) / greeting SMTP (có dịch vụ) → **vẽ được sơ đồ mạng nội bộ từ bên ngoài**.
- **Kèm V2-14:** `smtp_port:"abc"` → `587`; `smtp_port:-1` → truyền thẳng vào nodemailer. `valid.js:39` **có sẵn** `smtp_port:{min:1,max:65535}`, nhưng `checkSetting` **chỉ được gọi ở `PUT /`** (`:56`) — `/smtp/test` không import. Kiểm ở đường lưu, không kiểm ở đường dùng.
- **Kèm V2-15:** không limiter riêng → **600 lần thử/phút** (`index.js:28`), trong khi `/auth/login` có `authLimiter` 20 lần/15 phút (`:32-36`). Đủ để dùng server KTX làm công cụ **dò mật khẩu SMTP của bên thứ ba** — mỗi `verify()` là một lần AUTH thật, đến từ IP của KTX. IP bị liệt blacklist là hệ quả trực tiếp.

### V2-16 · Mail hỏng mà màn hình vẫn báo "sẵn sàng"
- **Bước:** `PUT /api/settings {school_email:"abc"}` (không phải email) → xem `GET /api/violations/mail-status` → ghi 1 vi phạm đủ ngưỡng.
- **Đúng:** 400 ngay ở bước lưu.
- **Nghi ngờ:** lưu được (`school_email` không nằm trong `SETTING_NUM`, `valid.js:29-40` → không kiểm gì). `smtpReady()` (`mailer.js:12-14`) chỉ kiểm 4 giá trị **có tồn tại**, không kiểm đúng/sai → UI báo **"sẵn sàng"**, cảnh báo ở `app.js:1900` biến mất. Nhưng mọi lần gửi đều fail (`mailer.js:97-98` nuốt lỗi thành `{sent:false}`) → `notified_school` không bao giờ set → `needMail` đếm dồn mãi. **Nhà trường không nhận được gì và không ai được cảnh báo.**
- **Kèm:** `school_email` không kiểm nghĩa là **đổi được đích nhận toàn bộ thông báo vi phạm sang địa chỉ bất kỳ** bằng 1 request PUT.

### V2-17 · `smtp_secure` nhận mọi chuỗi, âm thầm thành `false`
- **Bước:** `PUT /api/settings {smtp_secure:"True"}` (chữ T hoa), rồi `"1"`, rồi `"yes"`.
- **Nghi ngờ:** cả ba lưu OK, và `mailer.js:21` `String(s.smtp_secure) === 'true'` → **tất cả thành `false`**. Cấu hình port 465 SSL bị hạ thành kết nối không TLS, âm thầm.

### V2-18 · Gõ nhầm tên cài đặt → "đã lưu" nhưng không lưu gì
- **Bước:** `PUT /api/settings {electric_price: 4000}` (tên đúng là `electric_unit`).
- **Nghi ngờ:** 200 + object settings, **không lưu gì**. `settings.routes.js:39-71` lặp theo `allowed`, key ngoài danh sách bị bỏ qua im lặng. Lại đúng kịch bản `valid.js:54-55` bảo đã sửa.

### V2-19 · Staff sửa được danh mục vi phạm dù Cài đặt là của admin
- **Bước:** login staff → `POST /api/violations/types`, `PUT /api/violations/types/:id {severity:"minor"}`, `DELETE /api/violations/types/:id`.
- **Đúng:** 403. `schema.sql:236` ghi rõ danh mục **"sửa trong Cài đặt"**, mà `settings.routes.js:37` chốt Cài đặt = admin.
- **Nghi ngờ:** 200 hết. `violations.routes.js:7` `requireRole('admin','staff')` áp cho **toàn bộ** router, không endpoint nào siết thêm. Staff hạ `severity` của loại đang dùng hoặc ẩn loại, không cần admin.
- **Kèm:** `GET /api/settings` cho staff đọc `smtp_host`, `smtp_port`, **`smtp_user`** (tên tài khoản email thật), `smtp_from`, `school_email`. `sanitize()` (`:10-17`) là **deny-list** (chỉ trừ `smtp_pass`) chứ không phải allow-list — thêm secret mới vào settings mà quên bổ sung là lộ ngay.

---

## NHÓM 3 — XE & PHÍ GỬI XE (P0 — đường tiền)

### V2-20 · Tính lại hoá đơn là phí gửi xe của chiếc xe đã bán sống dậy
- **Tiền đề:** HV có 1 xe, đã có hoá đơn tháng 7.
- **Bước:** xoá xe → `POST /api/invoices/:id/recalc` hoá đơn tháng 7 → so `parking_charge` trước/sau.
- **Đúng:** 0đ. Xe đã xoá thì không thu.
- **Nghi ngờ:** phí quay lại. `invoice-calc.js:78` `SELECT COUNT(*) FROM vehicles WHERE student_id=$1` — **thiếu `deleted_at IS NULL`**, trong khi **hai chỗ kia đều có** (`invoices.routes.js:143` và `:232`). Nghĩa là **đường tạo tính đúng, mọi đường tính lại tính sai** — cùng một hoá đơn, số tiền phụ thuộc *thao tác cuối cùng chạm vào nó*.
- **Đáng sợ ở chỗ:** recalc bị kích hoạt bởi 9 nơi khác nhau (`invoices.routes.js:30`, `maintenance.routes.js:76`, `requests.routes.js:93,97`, `rooms.routes.js:161,173`, `students.routes.js:443,447,506`) — kể cả khi **bạn cùng phòng chuyển đi** (`:447` recalc cả roommate). Không ai cố ý làm gì cả, tiền tự sai.
- **Mức độ:** Chặn phát hành.

### V2-21 · Bỏ trống ô biển số → nhân phí gửi xe tuỳ ý
- **Bước:** `POST /api/vehicles {student_id:X}` (không có `plate`) — **10 lần** → lập hoá đơn.
- **Đúng:** 400 ngay từ lần 1, biển số là bắt buộc.
- **Nghi ngờ:** 10 xe hợp lệ. `vehicles.routes.js:29` `plate || ''` cho rỗng; unique index `uq_vehicles_plate` (`schema.sql:386-388`) có `WHERE COALESCE(plate,'') <> ''` → **biển rỗng không bị chặn trùng**. `billing.js:175-176` `parking_charge = parking_fee × 10 × f` → với `parking_fee` mặc định 100.000 → **+1.000.000đ/tháng cho một học viên**. Quyền cần: chỉ **staff**. `ck_invoices_no_negative` (`schema.sql:403-408`) chỉ chặn số âm, số dương vô lý thì không.

### V2-22 · Trùng biển số thật → 500, người nhập không biết mình trùng
- **Bước:** đăng ký `63-B4 508.58` cho HV A → đúng biển đó cho HV B. Rồi thử `63B450858` (cùng xe, khác format).
- **Nghi ngờ:** case 1 → unique index ném 23505, **không route nào bắt** → `index.js:110-111` trả **500 "Lỗi máy chủ"**. Case 2 → **lọt**, vì index chỉ `lower(btrim(plate))`, **không chuẩn hoá format** — placeholder ở UI (`app.js:1289`) còn gợi ý đúng cái format có dấu chấm. Hai bản ghi hợp lệ cho một chiếc xe.
- **Kèm:** index chạy trong `DO` block nuốt lỗi (`schema.sql:429-438`) — nếu dữ liệu hiện có đã trùng thì **index không áp được**, chỉ ghi `schema_guard` + một dòng warn lúc khởi động (`db.js:72-78`). App vẫn chạy, không ai chặn gì. **Kiểm tra `SELECT * FROM schema_guard` xem có dòng nào không.**

### V2-23 · Tính lại hoá đơn tháng 5 thu phí chiếc xe mua tháng 7
- **Bước:** HV không có xe suốt tháng 5, đăng ký xe tháng 7 → recalc hoá đơn **tháng 5**.
- **Đúng:** tháng 5 không có phí xe.
- **Nghi ngờ:** có. Bảng `vehicles` (`schema.sql:88-96`) chỉ có `created_at` + `deleted_at`, **không có `from_date`/`to_date`** — `COUNT(*)` là số xe **hôm nay**, áp cho **mọi tháng**.
- **Đây đúng là lỗi mà repo đã học và đã sửa cho chỗ khác:** `schema.sql:445-447` viết nguyên văn *"Dùng ô đánh dấu thì tính lại hoá đơn tháng cũ sẽ lấy phòng trưởng HÔM NAY, trả nhầm ưu đãi cho người khác (đúng lỗi TC-10)"* → phòng trưởng đã chuyển sang mô hình from/to_date. **Xe thì chưa.**

### V2-24 · Ô "có gửi xe" trong hồ sơ hoàn toàn vô nghĩa
- **Bước:** tick "đăng ký gửi xe" trong hồ sơ HV, **không thêm xe nào** → lập hoá đơn.
- **Đúng:** hoặc thu theo ô đó, hoặc bỏ hẳn ô đó khỏi giao diện.
- **Nghi ngờ:** thu **0đ**. `billing.js:175` `vehicleCount != null ? vehicleCount : (student.uses_parking ? 1 : 0)` — mà `invoice-calc.js:91` và `invoices.routes.js:176,237` **luôn truyền `vehicleCount`** (là số, `0 != null` là `true`) → nhánh `uses_parking` **không bao giờ chạy**. Cờ vẫn hiện trên đơn đăng ký (`public.routes.js:117`) và hồ sơ (`app.js:135`) → **hai nguồn sự thật, và cái được hiển thị không phải cái quyết định tiền**.

### V2-25 · Sửa xe làm mất biển số
- **Bước:** `PUT /api/vehicles/:id {vehicle_type:"Xe máy"}` (chỉ đổi loại).
- **Nghi ngờ:** `vehicles.routes.js:39-40` ghi đè `plate`/`sticker` về rỗng. UI luôn gửi đủ 4 field (`app.js:1301`) nên che mất lỗi.
- **Kèm:** `student_id=99999` → FK ném 23503 → **500** chứ không phải 400 có nghĩa. `student_id:"abc"` cũng 500. `:26` chỉ kiểm truthy — không kiểm HV tồn tại, chưa xoá, hay đã trả phòng.

### V2-26 · Hai màn hình nói hai số xe khác nhau về cùng một học viên
- **Bước:** HV có 2 xe → xoá 1 xe → mở **danh sách HV** rồi mở **chi tiết HV**.
- **Nghi ngờ:** danh sách hiện "Xe (1)", chi tiết hiện "Xe (2)". `students.routes.js:184` `SELECT * FROM vehicles WHERE student_id=$1` **không lọc `deleted_at`**, trong khi `:71` (list) **có**.
- **Kèm:** `vehicles.student_id ... ON DELETE CASCADE` (`schema.sql:90`) **không bao giờ chạy** — HV xoá mềm, xe vẫn `deleted_at IS NULL`, treo lơ lửng.

### V2-27 · Xe là tiền nhưng staff toàn quyền; tài sản là gợi ý nhưng siết admin
- **Bước:** login staff → thử ghi vào `/api/vehicles` rồi `/api/assets`.
- **Nghi ngờ:** xe **được** (`vehicles.routes.js:6` `requireRole('admin','staff')` cho cả router), tài sản **bị chặn** (`assets.routes.js:15,27,41` = admin). Ngược đời: thứ **trực tiếp ra tiền** (`billing.js:175-176`) lại được bảo vệ yếu hơn thứ chỉ là *gợi ý đơn giá* (xem V2-30).

---

## NHÓM 4 — TÀI SẢN & KHẤU TRỪ CỌC (P0 — đường tiền)

### V2-28 · Số lượng tài sản âm, phí âm
- **Bước:** `POST /api/assets {name:"Ghế", quantity:-5, fee:-200000}`.
- **Đúng:** 400.
- **Nghi ngờ:** 201. `assets.routes.js:21,33` `+quantity || 1` → `-5 || 1` = **`-5`** lưu được; `+fee || 0` tương tự. `schema.sql:211-221` **không có CHECK nào**, và `schema_guard` (`:373-426`) **không khai `ck_assets`** — trong khi rooms/students/invoices/electric đều có. Tài sản bị bỏ sót khỏi tuyến phòng thủ cuối.

### V2-29 · Nhập 0 ra 1, nhập "abc" ra 1
- **Bước:** `POST /api/assets {name:"Ghế", quantity:0}` rồi `{name:"Bàn", quantity:"abc"}`.
- **Đúng:** case 1 lưu 0; case 2 báo lỗi.
- **Nghi ngờ:** **cả hai lưu 1**. `0 || 1` → `1`; `NaN || 1` → `1`, trả 201 không cảnh báo. UI có `min="0"` và gửi `+el('as_qty').value || 0` (`app.js:2898,2906`) — người dùng nhập 0, **server im lặng ghi 1**.

### V2-30 · Danh mục tài sản chỉ là trang trí — khấu trừ cọc tính ở máy khách
- **Tiền đề:** HV có cọc 1.200.000. Danh mục: "Chìa khoá phòng — 100.000".
- **Bước:** `POST /api/students/:id/deposit-settle {action:"refund", deduction: 1199999, deduction_note:"Chìa khoá x1"}`.
- **Đúng:** server tự tra `assets.fee`, tự nhân, tự tổng → khấu trừ đúng 100.000.
- **Nghi ngờ:** **lọt**. Toàn bộ phép nhân `qty × fee` chạy ở client (`app.js:1406-1431` `dedCalc`/`doRefund`) rồi gửi lên **một con số**. Server (`students.routes.js:539-548`) chỉ kiểm `deduction` là số, `>=0`, `<= cọc` — **không hề đọc bảng `assets`**. Danh mục tài sản và bảng phí bồi hoàn **không phải ràng buộc, chỉ là giao diện**.
- **Kèm:** `students.deposit_deduction_note` là TEXT tự do (`schema.sql:74-75`), **không tham chiếu `asset_id`**, không bảng chi tiết. "Chìa khoá x2 = 100.000" chỉ là một chuỗi → không đối chiếu được, không thống kê được KTX thu bồi hoàn bao nhiêu theo loại tài sản.
- **Mức độ:** Chặn phát hành.

### V2-31 · Mười tài sản cùng tên, mười mức phí
- **Bước:** tạo 10 lần `POST /api/assets {name:"Remote máy lạnh", fee:<khác nhau>}` → mở màn hoàn cọc.
- **Nghi ngờ:** `schema.sql:211-221` **không unique gì** → màn hoàn cọc (`app.js:1382-1383`) hiện 10 dòng cùng tên, chọn dòng nào cũng "hợp lệ". Người tất toán chọn nhầm mức phí là chuyện sớm muộn.
- **Kèm:** `assets.sort` được dùng để `ORDER BY` (`:10`) nhưng **không API nào set được** (`:20,32`) — chỉ seed `db.js:147` gán. Mọi tài sản tạo qua app đều `sort=0`.

### V2-32 · Sửa và xoá bản ghi đã xoá
- **Bước:** xoá 1 tài sản → `PUT /api/assets/:id {fee:5000000}` → `DELETE /api/assets/:id` lần nữa → `DELETE /api/assets/99999`.
- **Nghi ngờ:** cả bốn đều 200. `:32` **không lọc `deleted_at`** → sửa được bản đã xoá; `:41-44` không kiểm tồn tại → id ma vẫn `{ok:true}`, xoá lại lần 2 ghi đè `deleted_at=now()`. **Không có endpoint restore** cho assets/vehicles/facilities, dù `rooms.routes.js:123` và `students.routes.js:350` đều có → xoá nhầm chỉ sửa được bằng SQL tay.

### V2-33 · Đổi giá bồi hoàn không để lại vết giá cũ
- **Bước:** `PUT /api/assets/:id {fee:5000000}` (từ 50.000) → mở `GET /api/admin/audit`.
- **Nghi ngờ:** audit chỉ có **giá mới** (`index.js:58-64` chỉ ghi `req.body`), không biết trước đó là bao nhiêu → không dựng lại được lịch sử giá. Khấu trừ cũ đã snapshot thành số nên không hồi tố (**điểm này làm đúng**), nhưng mọi lần hoàn cọc *sau đó* dùng giá mới mà không ai đối chiếu được.
- **Kèm:** `DELETE` có body rỗng → audit ghi `detail = "{}"`, chỉ còn id trong path → **không biết đã xoá tài sản tên gì / xe biển số nào**. Cộng với V2-32 (không có restore) → xoá xong là mất dấu.

---

## NHÓM 5 — CƠ SỞ VẬT CHẤT (P2)

### V2-34 · Xoá cơ sở, phòng đã xoá mềm còn trỏ về → khôi phục ra "cơ sở ma"
- **Bước:** cơ sở X có 1 phòng → xoá phòng đó → xoá cơ sở X (giờ đã được phép) → `POST /api/rooms/:id/restore` phòng cũ → mở danh sách phòng.
- **Đúng:** chặn khôi phục, hoặc khôi phục kèm cơ sở.
- **Nghi ngờ:** `facilities.routes.js:41` chỉ đếm `rooms ... deleted_at IS NULL` — **là chỗ làm tốt nhất nhóm này** (có chặn "đang có phòng"), nhưng bỏ sót phòng đã xoá mềm. Phòng khôi phục ra hiện **tên cơ sở đã bị xoá**, vì `rooms.routes.js:43` LEFT JOIN facilities **không lọc `f.deleted_at`**.
- **Kèm:** `rooms.routes.js:57,64,89,92-94` nhận `facility_id` tuỳ ý, không kiểm tồn tại/đã xoá → gán **phòng mới** vào cơ sở đã xoá.

### V2-35 · N cơ sở cùng tên "Cơ sở 1"
- **Bước:** `POST /api/facilities {name:"Cơ sở 1"}` × 5.
- **Nghi ngờ:** lọt. `schema.sql:4-9` không unique `name`. Dropdown chọn cơ sở hiện 5 dòng giống hệt. `address` không giới hạn độ dài, không `rejectUnknown`. `PUT` (`:32`) cũng không lọc `deleted_at` → sửa được cơ sở đã xoá.

---

## NHÓM 6 — BẢO TRÌ & BÀN GIAO (P0 — bảo trì đụng đường tiền)

`requireRole` toàn repo cho thấy role `maintenance` **chỉ** với tới `/api/maintenance` — phạm vi hẹp.
Nhưng **bên trong đó có một endpoint đụng thẳng vào tiền của bất kỳ ai.**

### V2-36 · Nhân viên bảo trì tự đặt ngày trả phòng cho học viên bất kỳ, hoá đơn tự giảm
- **Bước:** login `maintenance` → `POST /api/maintenance/handovers/:id/checkout {actual_date:"2026-07-02"}` với `:id` là **một học viên đang ở bình thường, không có đơn trả phòng nào**.
- **Đúng:** 400. Bảo trì xác nhận **bằng chứng vật lý** (đã kiểm tài sản, đã thu chìa khoá) — ngày và tiền do admin/staff chốt qua đơn.
- **Nghi ngờ:** 200. `maintenance.routes.js:56-79` **không kiểm `:id` có liên quan gì tới bảo trì**: không kiểm có đơn trả phòng, không kiểm nằm trong danh sách bàn giao. `:69-71` ghi thẳng `check_out_date=$1, status=$3` vào `students`, `:76` gọi `recalcInvoice` → `days_stayed` giảm → `total` giảm. **Cho bất kỳ học viên nào, không cần admin duyệt.**
- **Mức độ:** Chặn phát hành.

### V2-37 · Cùng endpoint đó bỏ sót 3 việc mà đường check-out chuẩn đều làm
- **Bước:** cho HV (là **phòng trưởng**, phòng còn 2 người khác) trả phòng **qua cổng bảo trì** → sang tháng sau lập hoá đơn cả phòng.
- **Đúng:** giống hệt kết quả khi check-out qua `POST /api/students/:id/checkout`.

| Việc | `students.routes.js` | `maintenance.routes.js` |
|---|---|---|
| `roomStays.checkOut` (đóng lượt ở) | `:427` | **KHÔNG CÓ** |
| `roomLeaders.closeStudent` | `:430` | **KHÔNG CÓ** |
| Xoá hoá đơn các kỳ SAU | `:452-454` | **KHÔNG CÓ** |
| Recalc **cả phòng** | `:445-448` | chỉ 1 người (`:76`) |

- **Nghi ngờ:** `room_stays` còn `to_date IS NULL` → `invoice-calc.js:31-36,55-57` chia điện theo `room_stays` → **người đã đi vẫn gánh điện các tháng sau, và làm loãng phần chia của bạn cùng phòng**. Đây đúng cái lỗi mà `room-stays.js:2-4` nói đã sửa — **đường bảo trì đi vòng qua nó**. Không `closeStudent` → theo comment `students.routes.js:428-429`: miễn nước + dịch vụ **vĩnh viễn**, phòng cũ không cử được phòng trưởng mới.
- **Ghi chú:** `POST /api/requests/checkout/:id/confirm` (`requests.routes.js:61-102`) có `roomStays.checkOut` (`:81`) và recalc roommate (`:95-98`), nhưng **thiếu `roomLeaders.closeStudent`** (file không import `roomLeaders`) và **thiếu dọn hoá đơn kỳ sau**. Kiểm cả hai đường.

### V2-38 · Xác nhận bàn giao 2 lần → ghi đè mốc thời gian
- **Bước:** `POST /api/maintenance/handovers/:id/checkin` → gọi lại lần nữa. Rồi `checkout` với `actual_date` khác.
- **Đúng:** "đã xác nhận rồi".
- **Nghi ngờ:** `:44-53` và `:56-79` set `checkin_confirmed_at=now()` / `checkout_confirmed_at=now()` **không kiểm cột đó đã NOT NULL chưa** → mất dấu lần xác nhận đầu, và mỗi lần lại **recalc hoá đơn theo ngày mới**.

### V2-39 · Ngày trả phòng năm 2199
- **Bước:** `POST /api/maintenance/handovers/:id/checkout {actual_date:"2199-12-31"}`.
- **Đúng:** chặn ngày tương lai.
- **Nghi ngờ:** lọt. `:67` `status = actual <= today ? 'out' : 'in'` — **biết là tương lai nhưng vẫn ghi**. `isValidYmd` chỉ chặn tới năm 2200 (`valid.js:8`). `recalcInvoice(id,'2199-12')` không tìm thấy hoá đơn → **no-op** → `check_out_date` đã đổi mà hoá đơn tháng này **không được tính lại** → dữ liệu và tiền lệch nhau.
- **Điểm làm đúng cần ghi nhận:** `:65-66` **có** chặn ngày rời < ngày vào, và `:59` có `isValidYmd`. Đường requests thì không (V2-41).

### V2-40 · Gõ nhầm trạng thái → task đã xong bị lùi về đang xử lý
- **Bước:** task đang `done` → `POST /api/maintenance/tasks/:id/status {status:"donee"}` (typo).
- **Đúng:** 400.
- **Nghi ngờ:** 200, và task **về `processing`, `resolved_at` bị set NULL** (`:113`). `:107` `['processing','blocked','done'].includes(...) ? ... : 'processing'` — **chuỗi rác âm thầm thành `processing`**. Không có bảng chuyển trạng thái: `done` → `processing` → `done` tự do.
- **Kèm 2 lỗi cùng chỗ:**
  - `:111` `admin_note=$2` với `note` mặc định `''` → bảo trì đổi trạng thái không kèm note → **xoá trắng ghi chú của admin**. Cột dùng chung, hai vai ghi đè lẫn nhau.
  - `'blocked'` **không hợp lệ với admin**: `schema.sql:200` khai `'new'|'processing'|'done'`, `requests.routes.js:26` chỉ nhận 3 giá trị đó và **fallback `'new'`** → bảo trì đặt `blocked`, admin mở đơn sửa bất cứ thứ gì → **status rơi về `new`**, mất luôn lý do chưa xử lý được.

---

## NHÓM 7 — ĐƠN TỪ: TRẢ PHÒNG & BÁO HỎNG (P0)

### V2-41 · Xác nhận đơn trả phòng với ngày rác → xoá sạch lịch sử ở phòng
- **Bước:** `POST /api/requests/checkout/:id/confirm {date:"abc"}` → rồi thử `{date:"2020-01-01"}` (trước ngày nhận phòng).
- **Đúng:** 400 cả hai — `students.routes.js:405-406` (đường admin tương đương) **chặn đúng**.
- **Nghi ngờ:** case 1 → **500** (`:79`). Case 2 → **nhận, ghi thẳng**. `requests.routes.js:65` `const date = req.body.date || cr.desired_date || ...` — **`req.body.date` không qua `isValidYmd` gì cả**, dù `valid.js` có sẵn và cả `students.routes.js:405` lẫn `maintenance.routes.js:59` đều dùng.
- **Hậu quả nặng nhất:** `days_stayed` âm, và `room-stays.js:27-29` **xoá luôn dòng lượt ở** khi `toDate < from_date` → **mất sạch lịch sử ở phòng của người đó** → tiền điện cả phòng chia lại sai.

### V2-42 · Xác nhận đơn 2 lần / xác nhận rồi từ chối
- **42a:** confirm đơn → confirm lại với `date` khác.
  - **Nghi ngờ:** chạy lại toàn bộ. `requests.routes.js:63-64` chỉ kiểm tồn tại, **không hề so `cr.status`** → ghi đè `check_out_date`, `closeStay` lần nữa, **ghi thêm dòng `logs`** (`:88`), `recordRead` thêm chỉ số điện (`:83`), recalc lại. Vô hạn.
- **42b:** confirm xong (HV đã `status='out'`) → **reject** chính đơn đó.
  - **Nghi ngờ:** thành công. `:112-117` `UPDATE ... SET status='rejected'` **không WHERE theo status, không kiểm `rowCount`** → đơn ghi "đã từ chối" nhưng **học viên vẫn bị check-out thật, hoá đơn vẫn đã bị tính lại**. Mâu thuẫn vĩnh viễn. Đơn không tồn tại cũng trả `{ok:true}`.
- **Đúng:** cả hai báo "đơn đã xử lý rồi".

### V2-43 · Nhật ký nói dối về người thực hiện
- **Bước:** bảo trì xác nhận trả phòng → mở Lịch sử ra/vào. Rồi staff duyệt đơn → mở lại.
- **Nghi ngờ:** `maintenance.routes.js:74` ghi `source:'admin'` cho thao tác của role **maintenance**; `requests.routes.js:88` ghi `source:'self'` cho thao tác **admin/staff** duyệt đơn. **Cả hai đều ghi sai vai.** Và cả hai lần INSERT logs đều bọc `try{}catch(e){}` **rỗng** (`maintenance.routes.js:74-75`) → log thất bại thì im lặng bỏ qua, thao tác vẫn thành công.

---

## NHÓM 8 — CỔNG HỌC VIÊN `/api/me` (P1)

**Điểm mạnh xác nhận được — không cần test lại:** không có IDOR. Mọi truy vấn `/api/me/*` lọc bằng
`req.user.student_id`, và giá trị đó `requireAuth` **đọc lại từ DB mỗi request** (`auth.js:67-80`),
không lấy từ payload token, không lấy từ body/query. **HV A không đọc/sửa được gì của HV B.**

### V2-44 · Bật/tắt máy giặt cuối tháng → né trọn tiền
- **Bước:** HV bật máy giặt đầu tháng, dùng cả tháng → **ngày cuối tháng** `POST /api/me/washing {on:false}` → admin lập hoá đơn → hôm sau HV bật lại.
- **Đúng:** tính theo số ngày đăng ký thực tế.
- **Nghi ngờ:** hoá đơn **0đ** tiền máy giặt. `billing.js:174` `student.uses_washing ? ... : 0` đọc **giá trị HIỆN TẠI tại thời điểm chốt**; `me.routes.js:85` chỉ `UPDATE students SET uses_washing=$1` — cờ boolean, **không lịch sử, không giới hạn số lần, không audit** (xem V2-46). Lặp vô hạn, không ai phát hiện.
- **Đây lại là bài học đã rút cho phòng trưởng mà chưa áp:** `room-leaders.js:4-7` dựng from/to_date kèm comment mô tả **chính xác cái bẫy này**.
- **Kèm:** `:84` `req.body.on !== false` → gửi `on:"false"` (chuỗi), `on:0`, `on:null`, hay **body rỗng** đều thành **`true`**. Chỉ đúng boolean `false` mới tắt được.

### V2-45 · Học viên đọc được ghi chú nội bộ về chính mình
- **Bước:** staff ghi `admin_note` = "HV này hay gây sự, không cho gia hạn" vào một đơn báo hỏng → login HV đó → `GET /api/me/damage`. Rồi `GET /api/me/checkout-request`. Rồi `GET /api/me/profile`.
- **Đúng:** không trả `admin_note`.
- **Nghi ngờ:** trả nguyên văn. `me.routes.js:116` và `:137` dùng `SELECT *`, hai bảng đều có `admin_note` (`schema.sql:201,234`). **Tác giả biết luật này** — `GET /me/violations` (`:108`) liệt kê cột tường minh và **cố ý bỏ** `admin_note`/`notified_school` — chỉ là bỏ sót 2 chỗ.
- **Kèm:** `GET /me/profile` (`:15,26`) `SELECT s.*` → trả cả `note` (ghi chú nội bộ BQL, `schema.sql:41`), `deposit_deduction_note` (`:75`), `checkin/checkout_confirm_note` (`:82,85`), **`room_fee_discount_pct`** → HV thấy lý do bị khấu trừ cọc **trước khi BQL kịp thông báo**, và biết mình có/không được giảm giá phòng so với người khác.

### V2-46 · Học viên thao tác không để lại vết nào
> Đây là **TC-18 của bộ v1**, chưa sửa. Đưa lại vì giờ có thêm dẫn chứng và thêm hệ quả (V2-44).
- **Bước:** login HV → `POST /api/me/washing`, `/me/damage`, `/me/checkout-request` → login admin → `GET /api/admin/audit`.
- **Nghi ngờ:** trống trơn. `index.js:55` `if (!denied && (res.statusCode >= 400 || req.user.role === 'student')) return;` — thao tác **THÀNH CÔNG** của student **không ghi gì**; chỉ ghi khi họ **bị từ chối**. Nghiệp vụ ngược: cái cần ghi là việc họ *đã làm được*.
- **Hậu quả:** tranh chấp "em không hề đăng ký máy giặt" / "em gửi đơn trả phòng từ tháng trước rồi" → **không có gì để đối chiếu**: `damage_reports`/`checkout_requests` chỉ có `created_at`, còn `uses_washing` bị UPDATE đè không lưu lịch sử.

### V2-47 · Học viên đã trả phòng vẫn spam báo hỏng
- **Bước:** HV `status='out'` → `POST /api/me/damage` × 100, mỗi cái `description` 1MB.
- **Đúng:** chặn HV đã đi; giới hạn độ dài; chống trùng.
- **Nghi ngờ:** lọt hết. `me.routes.js:120-132` chỉ kiểm `title` không rỗng (`:124`) — **không kiểm HV còn ở**, khác hẳn `/washing` ngay trên (`:80-83` **có** kiểm). 600 req/phút (`index.js:28`) × body 2MB (`:25`) → ~1.2GB/phút vào `damage_reports`. Không audit (V2-46).

### V2-48 · Học viên tự khoá mình bằng đơn trả phòng năm 2199
- **Bước:** `POST /api/me/checkout-request {desired_date:"2199-12-31", reason:"personal"}` → thử gửi đơn thật.
- **Nghi ngờ:** đơn 2199 nằm `pending` vĩnh viễn, và vì mỗi HV chỉ được **1 đơn pending** (`:152-153`) → **HV không gửi được đơn thật** cho tới khi staff can thiệp. `valid.js:8` cho tới năm 2200, không có cận trên hợp lý.
- **Ghi nhận:** endpoint này **validate tốt nhất nhóm** — có `isValidYmd` (`:144`), chặn ngày quá khứ (`:145`), chặn HV chưa nhận phòng (`:147-151`), chặn trùng đơn pending, whitelist `reason` (`:156`). Chỉ thiếu cận trên và `reason` sai thì **âm thầm thành `'other'`**.
- **Ghi chú cho người đọc code:** comment schema đã chết — `schema.sql:228` và `:49` ghi `'normal'|'urgent_visa'`, code whitelist `['departure','personal','facility','dropout','reserve','other']` (`:156`). Dễ dẫn người sau đọc sai.

### V2-49 · Tài khoản student mồ côi
- **Bước:** tạo user `role='student'` nhưng `student_id = NULL` → login → `POST /api/me/checkout-request` nhiều lần.
- **Nghi ngờ:** `auth.js:76` chỉ kiểm `student_id` khi nó truthy → tài khoản qua được `requireAuth`. Chốt chặn trùng đơn `WHERE student_id=$1` (`:152`) **không bao giờ khớp** vì `NULL = NULL` là UNKNOWN trong SQL → **vô hạn đơn trả phòng mồ côi**. `/me/damage` (`:127`) tương tự.

---

## NHÓM 9 — TRANG CÔNG KHAI & ĐƠN ĐĂNG KÝ (P1 — không cần đăng nhập)

**Sáu endpoint mở cho cả Internet** (`public.routes.js:6`): `image/:key`, `doc/noi-quy`, `info`, `stats`, `available-rooms`, `apply`.

**Điểm mạnh xác nhận được — không cần test lại:** `GET /api/public/image/:key` **không lộ ảnh CCCD**.
`key` phải nằm trong whitelist 7 phần tử (`:9,16`); đường dẫn object đọc từ cột `media.path` do admin đặt,
**không ghép từ input** → không path traversal; ảnh lấy từ `INTRO_BUCKET` còn CCCD ở `CCCD_BUCKET` (`:19` vs `:128`)
— **hai bucket khác nhau**. SVG bị chặn (`storage.js:26,32`) + `nosniff` (`:21`). Ảnh CCCD chỉ ra qua
`GET /api/students/:id/cccd/:side`, có kiểm chính chủ (`students.routes.js:48`), từ chối hồ sơ đã xoá (`:50`),
`Cache-Control: private` (`:55`). **Mảng này chắc.**

### V2-50 · `/apply`: 600 đơn/phút × 16MB, không CAPTCHA
- **Bước:** script gửi 100 đơn liên tiếp, mỗi đơn kèm 2 ảnh 6MB, cùng tên + SĐT.
- **Đúng:** rate limit riêng + chống trùng.
- **Nghi ngờ:** ⚠️ **ĐÍNH CHÍNH (16/07, đọc lại code thật):** `/apply` **CÓ** limiter riêng — `applyLimiter` **10 đơn/phút/IP** (`index.js:45-46,50`). Nhận định "600 đơn/phút" ở trên là **sai**, giữ lại để đối chiếu. Nghĩa là **spam ồ ạt bị chặn ở tầng IP**. Nhưng phần còn lại vẫn đúng: **không chống trùng nội dung** (cùng tên+SĐT gửi 10 lần/phút vẫn ra 10 đơn `pending`, kéo dài nhiều phút thì thành trăm đơn), mỗi đơn hợp lệ tạo tới **2 object trong bucket CCCD**, `/api/public` dùng parser **16MB** (`:24`) nên mỗi request tới 12MB, và `pref`/`note`/`code`/`class_name`/`plate` (`:116-117`) là TEXT **không giới hạn độ dài**. Rào IP đỡ được kẻ tấn công 1 nguồn, **không** đỡ được botnet nhiều IP hay đơn trùng lai rai.
- **Kèm:** thao tác của người chưa đăng nhập **không vào audit** (`index.js:52` `if (!req.user) return;`).
- **Ghi nhận:** **không có mass assignment** — `:113-118` INSERT liệt kê cột tường minh, gửi kèm `status`/`room_id`/`student_id` đều bị bỏ qua, `status` lấy DEFAULT `'pending'` (`schema.sql:178`). **An toàn.**

### V2-51 · Giới tính sai → mặc định NỮ → nam vào phòng nữ hợp lệ
- **Bước:** `POST /api/public/apply` với `gender:"Male"` (chữ M hoa), rồi bỏ hẳn trường `gender` → duyệt đơn, xếp vào **phòng nữ**.
- **Đúng:** 400 ở bước gửi đơn — đúng như `phone` đang làm (`:107`).
- **Nghi ngờ:** `:115` `b.gender === 'male' ? 'male' : 'female'` → cả hai thành **`female`**. Lúc duyệt, `checkRoomAssignment` nhận `app.gender='female'` (`applications.routes.js:59`) → **luật chặn giới tính (`room-rules.js:21-23`) vẫn "pass"** vì nó chỉ so gender của đơn với gender của phòng, **không biết đơn đã sai từ đầu**. Nam vào phòng nữ, hoàn toàn hợp lệ dưới góc nhìn của server.
- **Mức độ:** Cao. Luật giới tính đã được vá kỹ ở v1, nhưng đường này đi vòng qua nó.

### V2-52 · Ngày sinh sai và ảnh CCCD hỏng → nuốt im lặng, vẫn báo thành công
- **Bước:** gửi đơn với `birth_date:"1998-13-05"`, và `cccd_front` là `data:image/svg+xml,...` (bị chặn) hoặc file 10MB.
- **Đúng:** 400 để người dùng nhập lại.
- **Nghi ngờ:** **201 `{ok:true}`**, đơn lưu `birth_date=NULL` (`:110`), **không có ảnh CCCD** (`:128` `catch (e) {}` — **catch rỗng**). Học viên tin là đã nộp CCCD, staff mở đơn thấy trống, **không log nào ghi lại vì lỗi bị nuốt hoàn toàn**. Comment `:108` thừa nhận đây là chủ ý ("sai → bỏ qua (null) thay vì lỗi 500") — nhưng tránh 500 không bắt buộc phải im lặng nuốt dữ liệu.
- **Biến thể:** S3 sập / hết quota → cùng kết quả, không ai biết.

### V2-53 · Hai endpoint công khai cạnh nhau nói hai con số phòng khác nhau
- **Bước:** mở `/api/public/info` và `/api/public/stats` cùng lúc, so số phòng. Rồi xoá mềm 1 HV → mở `/api/public/available-rooms` và `/info`, so số giường trống.
- **Nghi ngờ:**
  - `/stats` (`:82-84`) đếm cả HV **đã trả phòng** (không lọc `check_out_date`) và cả phòng an ninh/nhân viên (không lọc `room_type='shared'`) — trong khi `/info` ngay trên **có** lọc (`:50`). `zones: 2` **hard-code**.
  - `/available-rooms` (`:93-94`) subquery đếm `occupancy` **thiếu `s.deleted_at IS NULL`**, trong khi `bedFree` của `/info` (`:54`) **có** → **HV đã xoá vẫn chiếm chỗ → phòng còn trống thật bị ẩn khỏi trang công khai**, và `/info` báo còn giường trong khi `/available-rooms` báo hết.
  - `/info` (`:47`) liệt kê cơ sở **không lọc `deleted_at`** (`schema.sql:292` có cột) → **cơ sở đã đóng vẫn hiện địa chỉ công khai** và trong dropdown đăng ký. Các truy vấn phòng ngay bên dưới (`:50,51,56`) đều lọc đúng.
- **Kèm:** `/available-rooms` công khai `gender`, `hang`, `floor`, `capacity`, `occupancy` **từng phòng** → người ngoài biết chính xác phòng nào có mấy nữ đang ở.

---

## NHÓM 10 — DUYỆT ĐƠN ĐĂNG KÝ (P0 — cửa hậu đi vòng qua mọi luật)

**Điểm mạnh xác nhận được:** `POST /:id/approve` **có** gọi `checkRoomAssignment` (`applications.routes.js:59`)
+ `blockOrConfirm` (`:60`) → sai giới tính 400, quá tải 409 buộc xác nhận rồi ghi vết `[QUÁ TẢI]`
(`room-rules.js:21,43`, `applications.routes.js:103`). Đây là **thành quả thật của vòng sửa 15/07**.
Lỗ còn lại: `room-rules.js:21` chỉ kiểm khi `room.gender` truthy → phòng để trống cột `gender` thì nam nữ ở lẫn tự do.

### V2-54 · Hai staff bấm Duyệt cùng lúc → 2 hồ sơ, thu tiền 2 lần
- **Bước:** gửi **2 request `POST /api/applications/:id/approve` song song** cho cùng một đơn. (Hoặc chỉ cần double-click.)
- **Đúng:** 1 thành công, 1 báo "đơn đã duyệt".
- **Nghi ngờ:** **cả hai thành công**. Chốt chặn ở `:36` (`if (app.status === 'approved')`) đọc bằng `query()` **ngoài transaction, không `FOR UPDATE`** — transaction chỉ mở ở `:74`. Comment `:33` nói rõ đây là chủ ý ("KHÔNG mở transaction khi còn khả năng trả lỗi sớm") — nhưng chốt chặn không chịu nổi đồng thời. Kết quả: **2 học viên, 2 lượt ở phòng, 2 dòng log, có thể 2 tài khoản** cho 1 người. `UPDATE ... SET status='approved'` (`:99`) chạy 2 lần đè nhau, chỉ giữ `student_id` cuối → **hồ sơ thừa mồ côi, không đơn nào trỏ tới, và bị tính tiền lần 2**.
- **Mức độ:** Chặn phát hành. Đúng y kịch bản mà comment `:45` cảnh báo.

### V2-55 · Chống trùng chỉ chạy khi đơn có mã HV — mà mã HV để trống được
- **Bước:** gửi 2 đơn cho cùng một người, **để trống mã HV** → duyệt cả hai.
- **Đúng:** đơn thứ 2 báo trùng.
- **Nghi ngờ:** cả hai tạo hồ sơ. `:47` `if (String(app.code || '').trim()) { ...kiểm trùng... }` — mã HV rỗng thì **bỏ qua toàn bộ kiểm trùng**, mà `/apply` để mã HV **tuỳ chọn, không validate** (`public.routes.js:116` `b.code || ''`). → **hai hồ sơ, thu tiền 2 lần**.
- **Kèm:** comment `:45` viết "Trùng mã HV / CCCD" nhưng **CCCD chưa bao giờ được kiểm** — bảng `applications` (`schema.sql:167-191`) **không có cột `id_card`**, không truy vấn nào so CCCD/SĐT. Chống trùng dựa vào đúng một trường mà người gửi đơn được quyền để trống.

### V2-56 · Duyệt đơn là cửa hậu đi vòng qua mọi validate của hồ sơ học viên
- **Bước:** `POST /api/applications/:id/approve {check_in_date:"1990-01-01", deposit_amount:-50000000}`. Rồi thử `deposit_amount:"abc"`, `check_in_date:"abc"`.
- **Đúng:** 400 hết — `students.routes.js:9` import `valid.js` và dùng `D()`/`isValidYmd`; `valid.js:34` có sẵn `deposit_fee:{min:0,max:100000000}`.
- **Nghi ngờ:** **`applications.routes.js` không import `valid.js` dòng nào.**
  - `:39` `b.check_in_date || ...` nhận thẳng → `"1990-01-01"` → HV "vào ở" từ 36 năm trước, và giá trị này chảy vào `roomStays.openStay` (`:88`), `logs.date` (`:89-90`), `deposit_date` (`:83`) → **hoá đơn truy thu hàng chục tháng**. `"abc"` → 500.
  - `:42` `depositAmt = b.deposit_amount != null ? +b.deposit_amount : ...` — **không kiểm dấu, không kiểm NaN**. `-50000000` → **cọc âm với `deposit_status='held'`**. `"abc"` → `NaN` → **Postgres NUMERIC chấp nhận `NaN`** → mọi phép tính cọc/hoàn cọc về sau ra `NaN` im lặng.
  - `:82` `contract_date` cũng không kiểm.
- **Mức độ:** Chặn phát hành.

### V2-57 · Duyệt được đơn đã xoá; từ chối rồi duyệt lại; xoá đơn đã duyệt
- **57a:** staff xoá đơn rác → `POST /api/applications/:id/approve` với id đó.
  - **Nghi ngờ:** thành công. `:34` `SELECT * FROM applications WHERE id=$1` **không lọc `deleted_at`**, dù `GET /` (`:15`) có và cột tồn tại (`schema.sql:295`). Đơn đã bỏ vẫn tạo ra học viên thật. `PUT /:id/note` (`:24`) cùng lỗi.
- **57b:** từ chối đơn → duyệt lại đơn đó.
  - **Nghi ngờ:** được. `:36` chỉ chặn `'approved'`. `reviewed_at` bị ghi đè (`:99`) → **mất dấu vết lần từ chối**.
  - *Đối chiếu:* Approve → Reject **chặn đúng** (`:113-114`) kèm thông báo nghiệp vụ rõ; Reject 2 lần idempotent (`:115`). Tác giả đã nghĩ tới chiều này, chỉ bỏ sót chiều kia.
- **57c:** `DELETE /api/applications/:id` với đơn **đã duyệt**, HV đang ở. Rồi `DELETE` id không tồn tại.
  - **Nghi ngờ:** cả hai `{ok:true}`. `:123` không kiểm `rowCount`, không kiểm `status` → đơn gốc (chứa CCCD, nguyện vọng, ngày nộp) **biến mất khỏi mọi màn hình** trong khi `students.id` vẫn trỏ tới. **Mâu thuẫn thẳng với `:113-114`**, nơi tác giả *cố ý cấm* từ chối đơn đã duyệt vì "hồ sơ nói một đằng thực tế một nẻo" — cửa DELETE để ngỏ, hậu quả còn nặng hơn.

### V2-58 · Tài khoản tạo lúc duyệt: mật khẩu 4 ký tự, không bắt đổi
- **Bước:** duyệt đơn có tạo tài khoản, đặt mật khẩu `1234` → login bằng tài khoản đó.
- **Đúng:** bắt đổi mật khẩu ngay lần đầu.
- **Nghi ngờ:** vào thẳng. `:67` chỉ `if (pass.length < 4)`; `INSERT INTO users` (`:95`) **không set `must_change_password`** → mặc định `false` (`schema.sql:108`). `auth.js:82` **có** cơ chế ép đổi nhưng đường này không kích hoạt. Mật khẩu thường là SĐT (`:64`), tồn tại vĩnh viễn, token sống 30 ngày (`auth.js:18`), `authLimiter` cho 20 lần thử/15 phút → **mật khẩu 4 chữ số bị dò trong vài ngày**.

---

## NHÓM 11 — ẢNH & TÀI LIỆU (P2)

**Điểm mạnh xác nhận được:** SVG bị chặn bằng whitelist (`storage.js:26,32`) — **lỗi cũ vẫn còn vá**.
PDF **kiểm magic bytes thật** `%PDF-` (`:56`). `nosniff` đặt đúng ở `public.routes.js:21` và `students.routes.js:54`.
Whitelist key ở POST (`media.routes.js:27,48`) → **không path traversal**.

### V2-59 · Ảnh không kiểm nội dung thật — trang công khai thành nơi chứa file lạ
- **Bước:** `POST /api/media/hero` với `data:image/png;base64,<byte bất kỳ, không phải PNG>` → tải `/api/public/image/hero`.
- **Đúng:** 400 — kiểm magic bytes như PDF đã làm (JPEG `FF D8 FF`, PNG `89 50 4E 47`…).
- **Nghi ngờ:** lưu OK. `storage.js:28-34` `parseDataUrl` **chỉ đọc cái nhãn `data:image/...` do client tự khai** rồi tra bảng `EXT` (`:26`) — **không đọc magic bytes**, trong khi PDF ngay dưới (`:51-58`) thì có. **Bất đối xứng trong cùng một file.**
- **Không phải XSS:** nhồi HTML vào nhãn `image/png` → `public.routes.js:20-21` đặt `Content-Type: image/png` + `nosniff` → trình duyệt không render. **Nhưng** CSP đang **tắt hoàn toàn** (`index.js:16` `contentSecurityPolicy:false`) → `nosniff` là lớp chặn **duy nhất**. Đủ, nhưng không còn lớp thứ hai.
- **Hậu quả thật:** **lưu byte tuỳ ý dưới tên miền của ký túc xá**, phục vụ công khai không cần đăng nhập, `Cache-Control: public`.

### V2-60 · Đổi ảnh sang định dạng khác → file cũ nằm lại vĩnh viễn
- **Bước:** upload `hero` bằng PNG → upload đè bằng JPG → `DELETE /api/media/hero` → thử tải thẳng object cũ từ S3/MinIO.
- **Nghi ngờ:** `hero.png` **vẫn còn**. `media.routes.js:54` `objectKey = \`${key}.${p.ext}\`` — tên object phụ thuộc **đuôi** → object mới là `hero.jpg`, DB trỏ sang `hero.jpg` (`:57-59`), `hero.png` **không bao giờ bị xoá**; `DELETE` (`:70`) chỉ xoá đúng `row.path` hiện tại.
- **So sánh trong chính repo:** `students.routes.js:38` **làm đúng** — `if (isCccdKey(oldKey) && oldKey !== key) await storage.deleteObject(...)`. Luồng media thiếu hẳn bước này.
- **Hậu quả:** bucket intro phục vụ công khai → **ảnh đã "xoá" vẫn tải về được trực tiếp**. Người dùng bấm Xoá, tin là đã xoá, thực tế chưa.

### V2-61 · Ba con số giới hạn dung lượng PDF mâu thuẫn nhau
- **Bước:** upload PDF nội quy 17MB. Rồi 19MB.
- **Nghi ngờ:** `media.routes.js:30` kiểm `> 20MB` nhưng **thông báo lỗi ghi "tối đa ~15MB"**, còn giới hạn thật là **16MB** từ parser (`index.js:23-24`). File 17MB **không bao giờ chạm được dòng `:30`** — parser ném 413 trước, người dùng nhận thông báo **tiếng Anh** "request entity too large" (lọt qua `index.js:111` vì 413 nằm trong dải 4xx). Kiểm tra ở `:30` là **code chết** trong khoảng 16–20MB. **Giao diện nói 15, code nói 20, hệ thống thi hành 16.**
- *Đối chiếu:* ảnh thì nhất quán — `:51` chặn 8MB base64 ≈ 6MB thật, khớp comment, dưới trần parser.

### V2-62 · `DELETE /api/media/:key` xoá gì cũng "ok"
- **Bước:** `DELETE /api/media/khong-ton-tai`.
- **Nghi ngờ:** `{ok:true}`. `:66-74` **không kiểm whitelist** (trong khi cả 2 đường POST đều kiểm), không kiểm `rowCount`. Không leo thang được (đã là admin), nhưng **API báo "đã xoá" cho thứ chưa từng có**, và mất lớp phòng vệ nếu sau này bảng `media` dùng chung cho mục đích khác.

---

## NHÓM 12 — NHẬT KÝ & AUDIT (P0 — nhật ký hỏng thì mọi case khác mất bằng chứng)

### V2-63 · Audit không ghi đăng nhập — mắt xích quan trọng nhất bị đứt
- **Bước:** admin `POST /api/admin/users/:id/password` đặt mật khẩu cho tài khoản B → login vào B → làm vài thao tác → mở `GET /api/admin/audit`.
- **Đúng:** thấy được cả hai vế: ai đặt mật khẩu, và ai đã đăng nhập vào B sau đó.
- **Nghi ngờ:** thấy vế 1, **không thấy vế 2**. `index.js:49` `!/^\/auth\//.test(req.path)` → **toàn bộ `/api/auth/*` không ghi một dòng nào**: đăng nhập thành công, đăng nhập thất bại, đăng xuất, tự đổi mật khẩu.
- **Ghép với V2-70 (đặt mật khẩu cho tài khoản HV) → đường mạo danh hoàn chỉnh, không để lại dấu vết.**
- **Mức độ:** Chặn phát hành.

### V2-64 · Bốn lỗ hổng ghi khác của audit — kiểm từng cái
| Cái gì không được ghi | Dẫn chứng | Vì sao đau |
|---|---|---|
| Thao tác **thành công** của học viên | `index.js:55` | V2-46 — tranh chấp không có bằng chứng |
| Người **chưa đăng nhập** (`/apply` nộp CCCD) | `index.js:52` `if (!req.user) return;` | V2-50 — spam ẩn danh vô hình |
| Mọi lần **401** | requireAuth trả 401 **trước** khi gán `req.user` (`auth.js:61,64,71,73`) | **dò token, dùng vé đã thu hồi, phiên hết hạn: vô hình**. (403 thì có ghi, vì `auth.js:80` chạy trước `requireRole`) |
| Mọi lỗi **5xx** | `index.js:55` loại `statusCode >= 400` khi không denied | Một lệnh ghi làm hỏng dữ liệu rồi văng 500 giữa chừng → **không có dòng nào**. Chính kịch bản đáng ngờ nhất lại là kịch bản không lưu vết |
| Mọi **GET** | `index.js:49` chỉ bắt POST/PUT/DELETE/PATCH | Xem ảnh CCCD, đọc `data-health` (lộ số CCCD), đọc chính audit — **không vết**. Với PII thì việc *đọc* mới là thứ cần ghi |

### V2-65 · Audit ghi kiểu "được thì ghi", nuốt lỗi trong im lặng
- **Bước:** tạm dừng Postgres → gọi một API ghi → bật lại → mở audit.
- **Nghi ngờ:** `index.js:66-69` ghi trong `res.on('finish')` bằng `db.pool.query(...).catch(() => {})` — **lỗi ghi audit bị nuốt hoàn toàn**, thao tác nghiệp vụ vẫn thành công. DB đầy / mất kết nối tạm / bảng bị khoá → **audit thủng lỗ mà không ai biết là đã thủng**. Chị quản lý mở nhật ký thấy trống và tưởng "không ai làm gì".
- **Ghi nhận (điểm tốt):** toàn repo **không có endpoint nào UPDATE/DELETE `audit_log`** — chỉ INSERT (`index.js:67`, `room-rules.js:61`) và SELECT (`admin.routes.js:64`). Ở tầng ứng dụng nhật ký là append-only. Nhưng tầng CSDL **không có trigger/ràng buộc chống sửa, không có chuỗi băm** — ai có quyền DB là sửa sạch, không dấu.

### V2-66 · Nhật ký có mà tra không ra
- **Bước:** giả sử sự cố xảy ra **3 tháng trước**. Dùng giao diện, tìm mọi thao tác của user X trong tuần đó.
- **Đúng:** lọc được theo user / ngày / path, có phân trang.
- **Nghi ngờ:** không có đường. `GET /api/admin/audit` (`:62-66`) chỉ có `limit` (trần 500), **không `offset`, không lọc gì**; `audit_log` **không có cơ chế dọn/lưu trữ** → sau vài tuần, 500 dòng mới nhất chỉ là vài ngày. Dữ liệu còn trong bảng nhưng **ứng dụng không lấy ra được**. `GET /api/logs` (`:9-26`) chỉ lọc `type=in|out`, trần 2000, **không lọc theo học viên, không theo khoảng ngày, không offset**. **Nhật ký không truy hồi được thì giá trị điều tra bằng 0.**

### V2-67 · `?limit=-1` làm sập cả hai màn nhật ký
- **Bước:** `GET /api/logs?limit=-5` và `GET /api/admin/audit?limit=-1`.
- **Đúng:** 400 hoặc kẹp về mặc định.
- **Nghi ngờ:** **500** cả hai. `logs.routes.js:15` `Math.min(+limit || 500, 2000)` → `-5` truthy → `Math.min(-5,2000) = -5` → `LIMIT -5` → Postgres `LIMIT must not be negative`. `admin.routes.js:63` cùng kiểu. Thiếu `Math.max(1, ...)`.
- **Lưu ý cho người đọc code:** `LIMIT ${lim}` ở `logs.routes.js:23` **trông** như SQL injection nhưng **không phải** — `lim` luôn qua `+`/`Math.min` nên chắc chắn là số. Đây là lỗi độ bền, không phải injection. **Đừng báo nhầm.**

### V2-68 · `/api/logs` phục vụ tên học viên đã bị xoá
- **Bước:** xoá 1 HV → login **staff** → `GET /api/logs`.
- **Nghi ngờ:** vẫn thấy tên. `logs.routes.js:16-20` JOIN students **không lọc `s.deleted_at IS NULL`** và trả `s.name`. **Mâu thuẫn với chính hệ thống:** `students.routes.js:50` *cố ý* từ chối phục vụ ảnh CCCD của HV đã xoá kèm comment "bảo vệ PII"; `reports.routes.js:16` cũng loại HV đã xoá. Hoặc hai chỗ kia sai, hoặc chỗ này sai — **hiện app đang nói hai điều mâu thuẫn về cùng một câu hỏi**.

---

## NHÓM 13 — BÁO CÁO DOANH THU (P1)

### V2-69 · Năm hiện trong danh sách nhưng báo cáo trắng; và năm tên là `"xin-"`
- **Bước:** `POST /api/invoices/generate {month:"xin-chao", ...}` → `GET /api/reports/years`. Rồi: xoá hết HV của một năm cũ → mở lại `/years` → chọn năm đó.
- **Đúng:** case 1 → 400 ở bước tạo. Case 2 → năm đó không hiện.
- **Nghi ngờ:**
  - `invoices.routes.js:64` `if (!month) return 400` — **chỉ kiểm rỗng**, không gọi `isValidMonth`, dù hàm đó tồn tại (`valid.js:19-23`) và **có được dùng ở `:268`** — cùng file, một đường kiểm, một đường không. → `month='xin-chao'` lưu được (`schema.sql:142` `month TEXT NOT NULL`, **không CHECK**) → `reports.routes.js:38` `substr(month,1,4)` cắt mù → dropdown hiện **`"xin-"`**, và `ORDER BY y DESC` sắp theo chuỗi nên **rác trồi lên đầu**. Nếu `month` không phải chuỗi thì `invoices.routes.js:71` `month.split('-')` ném TypeError → **500**.
  - `/years` (`:38`) chỉ lọc `deleted_at` trên `invoices`, **không JOIN students, không lọc HV đã xoá** — trong khi `/revenue` (`:16`) lọc **cả hai** kèm comment `:14-15` giải thích đúng lý do. → năm mà toàn bộ HĐ thuộc HV đã xoá **vẫn hiện trong dropdown** → chọn vào → `/revenue` trả mảng rỗng → **báo cáo trắng, không lời giải thích**.

### V2-70 · `?year=%` vô hiệu hoá bộ lọc năm
- **Bước:** `GET /api/reports/revenue?year=%25`.
- **Nghi ngờ:** trả **toàn bộ lịch sử** nhưng màn hình vẫn ghi nhãn "năm %". `reports.routes.js:17` `params.push(year + '-%')` — `year` đi thẳng vào `LIKE` **không thoát ký tự đại diện** → `LIKE '%-%'` khớp mọi tháng. Chỉ admin gọi được nên tác động thấp, nhưng **con số báo cáo sai so với nhãn hiển thị**.
- **Ghi nhận:** `year` rác kiểu khác **không gây 500** — `?year[a]=1` → `'[object Object]-%'` → mảng rỗng. Không phải lỗ injection.

---

## NHÓM 14 — QUẢN TRỊ TÀI KHOẢN (P0)

> ⚠️ **V2-71 sẽ khoá quyền admin của chính tài khoản test và KHÔNG TỰ PHỤC HỒI ĐƯỢC.**
> Tạo một admin phụ trước, và chuẩn bị sẵn lệnh SQL `UPDATE users SET role='admin' WHERE username='admin';`.
> **Chạy case này CUỐI CÙNG của cả bộ.**

**Điểm mạnh xác nhận được — không cần test lại:** `auth.js:67-80` **đọc lại role từ DB mỗi request**, không tin
role trong token; `token_epoch` (`:72`) thu hồi vé; `revokeTokens` được gọi đủ ở cả 3 chỗ đổi quyền
(`admin.routes.js:108,119,133`); `auth.js:82` chặn `must_change_password` ở **server**.
**Đây là TC-13/TC-14/TC-15 của bộ v1 — đã sửa thật.**

### V2-71 · Bỏ trống một trường → admin cuối cùng tự mất quyền vĩnh viễn
- **Bước:** `PUT /api/admin/users/<id chính mình>` với body `{"full_name":"X"}` — **không có trường `role`**.
- **Đúng:** PUT là cập nhật một phần — không gửi `role` thì **giữ nguyên role cũ**.
- **Nghi ngờ:** thành `staff`. `:70` `ROLE = r => (['admin','staff','maintenance'].includes(r) ? r : 'staff')` — `undefined` → **`'staff'`**. Chốt chặn tự hạ quyền (`:101-102`) chỉ chạy khi `req.body.role` **có giá trị**: `if (id === req.user.id && req.body.role && ...)` → body không có `role` → **falsy → bỏ qua chốt** → `:104-105` `SET role=ROLE(undefined)`. Ngay sau đó `revokeTokens(id)` (`:108`) đá luôn phiên.
- **Không có đường phục hồi:** `db.js:83` chỉ tạo lại admin khi **username chưa tồn tại** — tài khoản vẫn còn (chỉ đổi role) → **khởi động lại không cứu**. Chốt "phải còn ít nhất 1 quản trị viên" **chỉ có ở `DELETE`** (`:128-130`), **không có ở `PUT`**.
- **Hậu quả:** một request → admin cuối cùng mất quyền vĩnh viễn → không ai tạo được tài khoản, không đặt lại được mật khẩu, không xem được nhật ký. **Chỉ cứu được bằng cách vào thẳng CSDL.** Giao diện luôn gửi `role` (`app.js:2691`) nên lỗi bị che — nhưng API mới là ranh giới bảo mật.
- **Mức độ:** Chặn phát hành.
- **Kèm V2-72:** cùng endpoint, `PUT {role:'admin'}` (không gửi `full_name`) → `:105` `(req.body.full_name || '').trim()` → **xoá trắng họ tên**. Nâng quyền cho ai đó = mất tên người đó. Audit về sau chỉ còn username, **không tra ra người thật**.

### V2-73 · Admin đặt mật khẩu tài khoản HỌC VIÊN rồi đăng nhập dưới danh nghĩa họ
- **Bước:** `POST /api/admin/users/<id tài khoản role='student'>/password {password:"..."}` → login → thao tác vài cái → mở audit.
- **Đúng:** 403 — comment `:69` tuyên bố đây là "Quản lý tài khoản **nhân viên**".
- **Nghi ngờ:** 200. `:118` `UPDATE users SET password_hash=$1 ... WHERE id=$2` — **không có `AND role IN ('admin','staff','maintenance')`**, trong khi `PUT` (`:104`) và `DELETE` (`:132`) **đều có**. Mọi thao tác sau đó ghi audit **dưới tên học viên**, và bước đăng nhập **không được ghi** (V2-63) → **đường mạo danh không để lại dấu vết**.
- **Mức độ:** Chặn phát hành. Ghép V2-73 + V2-63 là tổ hợp nặng nhất của nhóm này.
- **Kèm, cùng endpoint:**
  - Không lọc `deleted_at` → đặt được mật khẩu cho **tài khoản đã vô hiệu hoá**; không login được (`auth.js:69` lọc) nhưng API vẫn `{ok:true}` — **báo thành công cho một việc không có thật**.
  - Id không tồn tại → UPDATE khớp 0 dòng → vẫn `{ok:true}` (`:120`), không kiểm `rowCount`.
  - `POST /api/admin/users/abc/password` → **500**. `:118` truyền thẳng `req.params.id` (chuỗi) trong khi `:119` dùng `+req.params.id`. `PUT`/`DELETE` không dính vì đã ép (`:100,:126`).

### V2-74 · `data-health` là đường đọc số CCCD hàng loạt, không để lại vết
- **Bước:** `GET /api/admin/data-health` → đọc kỹ JSON trả về → mở audit.
- **Nghi ngờ:** kiểm tra `cccd_trung` (`:35`) `SELECT id_card AS khoa` → **số CCCD nguyên vẹn trong JSON**. Ba kiểm tra còn lại lộ họ tên + id + tên phòng (`:19,:28`), số hợp đồng (`:43`). Admin vốn xem được hồ sơ — **nhưng đây là GET nên không hề vào audit** (V2-64), tạo ra đường đọc CCCD hàng loạt **không dấu vết**, trong khi ảnh CCCD được canh rất kỹ (`students.routes.js:44-50`).
- **Kèm:** `guards` phơi **thông điệp lỗi CSDL thô** ra client — ngược với chủ trương `index.js:111` là không lộ chi tiết nội bộ.

### V2-75 · Bốn endpoint quét toàn bảng, không giới hạn ở tầng SQL
- **Bước:** với dữ liệu thật (~240 HV), gọi `GET /api/admin/data-health` **20 lần liên tiếp**. Đo thời gian, xem pool kết nối.
- **Nghi ngờ:** `:49-59` chạy **4 truy vấn gộp (GROUP BY + string_agg) quét toàn bảng `students`**, không `LIMIT` trong SQL (`:19-22,28-29,35-37,43-45`). `LIMIT` duy nhất là `rows.slice(0,30)` ở **JavaScript** (`:55`) — **sau khi DB đã làm hết việc và truyền hết dữ liệu về**. Nặng nhất nhóm.
- **Cùng loại:** `/reports/revenue` (`:18-30`, GROUP BY toàn bảng invoices JOIN students, không LIMIT, không truyền `year` thì gộp **toàn bộ lịch sử**); `/reports/years` (`:38`, DISTINCT quét toàn bảng); `/admin/users` (`:74-76`, rủi ro thấp).
- **Hậu quả:** rate limit 600/phút áp **chung cho cả `/api`** (`index.js:28`), không siết riêng endpoint nặng → **hàng trăm lượt quét toàn bảng mỗi phút** → trên gói Render nhỏ đủ nghẽn pool và kéo sập app.

### V2-76 · Xoá tài khoản rồi thì username không bao giờ dùng lại được
- **Bước:** tạo user `nguyenvana` → xoá → tạo lại `nguyenvana`.
- **Đúng:** tạo được.
- **Nghi ngờ:** "đã tồn tại", mà **danh sách tài khoản không thấy nó đâu**. `schema.sql:100` `username TEXT UNIQUE NOT NULL` — UNIQUE **không có `WHERE deleted_at IS NULL`**; `DELETE` chỉ xoá mềm (`:132`); kiểm trùng lúc tạo (`:87`) cũng **không lọc `deleted_at`**, trong khi `GET /users` (`:76`) **có**. **Admin nhìn màn hình trống mà hệ thống nói đã tồn tại** — không hiểu chuyện gì, không có đường tự sửa.
- **Kèm:** kiểm ở app **không phân biệt hoa thường** (`:87` `lower()`), ràng buộc DB (`schema.sql:100`) **có phân biệt** → `Admin` và `admin` bị app chặn nhưng DB cho phép. (`uq_users_username_ci` ở `schema.sql:395-396` đỡ được đường `applications`.)
- **Kèm nhẹ:** `:129` `SELECT role FROM users WHERE id=$1` không lọc `deleted_at`, trong khi phép đếm admin **ngay dòng trên** (`:128`) thì có → xoá một admin **đã xoá từ trước** vẫn bị chốt "còn ít nhất 1 quản trị viên" chặn nhầm. Vô hại, nhưng là dấu hiệu **cùng một khái niệm được định nghĩa khác nhau ở hai dòng liền kề**.

---

## NHÓM 15 — CHUÔNG BÁO / TRUNG TÂM THÔNG BÁO (P1)

Chuông (`app.js:465`, `499-532`) là **client thuần** — không có endpoint nào, không có bảng nào,
không có trạng thái "đã đọc". `notifItems()` (`:500-513`) đếm 5 loại việc **từ `ST`** (bộ nhớ đệm trình duyệt),
`ST` chỉ được nạp bởi `refreshCache()` (`:480-488`). **Chỉ admin/staff có chuông** (`app.js:7-9`).

Vì nó không phải "thông báo" mà là **"đếm lại cái đang có trong bộ nhớ đệm"**, hai câu hỏi quyết định
cả nhóm này là: *bộ nhớ đệm đó được làm mới khi nào?* và *khi nạp hụt thì chuông nói gì?*

### V2-77 · Chuông không bao giờ tự kêu — chỉ phản ánh việc do chính mình vừa làm
- **Bước:** admin mở app, để yên màn Tổng quan. **Từ máy khác** gửi 1 đơn đăng ký qua `/dang-ky` và 1 đơn xin trả phòng từ cổng HV. Ngồi nhìn chuông **10 phút**. Rồi bấm một nút bất kỳ có sửa dữ liệu (vd Lưu một phòng) → nhìn lại chuông.
- **Đúng:** với một thứ tên là "chuông báo", việc mới phải hiện ra trong vòng vài chục giây mà không cần thao tác gì.
- **Nghi ngờ:** **chuông đứng im vĩnh viễn**. `updateNotif()` (`:514`) chỉ được gọi từ `updateNavBadges()` (`:497`), mà hàm đó chỉ được gọi từ `refreshCache()` (`:487`) và `viewRequests()` (`:1827`). `refreshCache()` chỉ chạy **lúc đăng nhập** (`:477`) và **sau mỗi thao tác ghi của chính người đang ngồi đó** (~40 chỗ `await refreshCache()`). **Không có `setInterval`, không polling, không SSE, không WebSocket** trong toàn bộ `app.js`. Chỉ khi làm việc khác (hoặc F5) thì con số mới nhảy.
- **Hậu quả:** quản lý ngồi trước màn hình cả buổi, HV gửi đơn trả phòng gấp → **không ai biết**. Chuông tạo cảm giác an tâm sai: nó im không có nghĩa là không có việc, chỉ có nghĩa là **chưa ai bấm gì**.
- **Mức độ:** Cao. Đây là lỗi *bản chất* của chức năng, không phải lỗi lẻ — nếu chốt là "chuông chỉ đếm lại lúc tải trang" thì phải đổi tên/đổi kỳ vọng, đừng để nó trông như thông báo thời gian thực.

### V2-78 · Tải hụt dữ liệu → chuông báo "Không có việc cần xử lý"
- **Bước:** tắt Postgres (hoặc chặn `/api/damage`, hoặc dùng V2-67: `GET /api/logs?limit=-1` cho 500) → đăng nhập → mở chuông.
- **Đúng:** "Không tải được danh sách việc — thử lại", và chuông phải ở trạng thái **không biết**, khác hẳn trạng thái **biết là rỗng**.
- **Nghi ngờ:** chuông hiện **✓ "Không có việc cần xử lý"** — màu xanh, yên tâm tuyệt đối. `refreshCache()` (`:481-486`) bọc `.catch(() => [])` cho **7 trong 11** lời gọi API (`applications`, `damageAll`, `checkoutReqs`, `logs`, `assets`, `violationTypes`, `violationStats`) → lỗi gì cũng thành **mảng rỗng** → `notifItems()` đếm ra 0 → dot ẩn (`:516`).
- **Đây là vấn đề gốc #3 của bộ này** (nuốt lỗi trong im lặng, rồi báo thành công) — nhưng ở đây hậu quả trực tiếp là **con số nghiệp vụ sai theo hướng nguy hiểm nhất**: 12 đơn chờ duyệt hiển thị thành "không có việc".
- **Mức độ:** Cao.

### V2-79 · Menu nói có việc, chuông nói không
- **Bước:** HV gửi 1 góp ý / phản ánh (`category` = `violation` hoặc `other`) → admin F5 → so **badge đỏ ở menu "Góp ý"** với **tổng trên chuông** và nội dung panel.
- **Đúng:** panel ghi rõ "Thông báo — **cần xử lý**" (`:523`) → nó phải là tất cả việc cần xử lý.
- **Nghi ngờ:** menu có badge, **chuông không đếm**. `updateNavBadges()` (`:489-497`) đặt **5 badge**, `notifItems()` (`:500-513`) tạo **5 mục** — nhưng **không phải cùng 5**: chuông có thêm `refund` (cọc chờ hoàn, không có badge menu) và **thiếu hẳn `navFeed`** (góp ý). → **tổng chuông ≠ tổng badge menu**, và góp ý là loại việc **duy nhất không bao giờ xuất hiện trên chuông**.
- **Hậu quả:** ai tin chuông là "danh sách việc cần làm" thì **góp ý của học viên bị bỏ quên vĩnh viễn**.

### V2-80 · Số "cần báo nhà trường" trên chuông thừa hưởng lỗi V2-01
- **Tiền đề:** đã chạy V2-01 hoặc V2-04.
- **Bước:** so `needMail` trên chuông với số HV thật sự cần báo trường.
- **Nghi ngờ:** lệch. Chuông lấy thẳng `ST.vstats.needMail` (`:504`) từ `GET /api/violations/stats` — mà `:130` `UPDATE ... SET notified_school=true WHERE student_id=$1` **quét mọi dòng của HV kể cả bản đã xoá mềm** → cờ `notified` sai → `needMail` (`:71` `x.cnt >= threshold && !x.notified`) sai theo. Chuông trung thực với server; **server mới là chỗ sai**. Ghi nhận để khi sửa V2-01 thì kiểm lại cả chuông.

### V2-81 · Học viên và bảo trì không có chuông — mà họ mới là người cần được báo
- **Bước:** login HV → tìm chuông. Login `maintenance` → tìm chuông.
- **Đúng:** ít nhất HV phải được báo: có hoá đơn mới, bị ghi vi phạm, đơn trả phòng được duyệt/từ chối, sắp tới hạn đóng tiền.
- **Nghi ngờ:** **không có gì**. `app.js:7-9` chỉ `renderAdmin()` (admin+staff) mới có `notifBell`; `renderStudent()` (`:2971`) và `renderMaintenance()` (`:3198`) không có. HV chỉ biết mình bị ghi vi phạm nếu **tự vào xem**. Cộng với V2-46 (thao tác HV không vào audit) và V2-45 (HV đọc được `admin_note`) → **luồng thông tin tới học viên hiện gần như bằng 0**, trong khi thông tin *về* họ thì rò ra chỗ không nên.
- **Ghi chú:** đây là **thiếu chức năng**, không phải bug — nêu ra để sếp quyết, đừng xếp FAIL.

### V2-82 · Bộ máy của chuông hỏng → modal kẹt → bấm Lưu lần nữa → bản ghi trùng
- **Bước:** mở form tạo đơn đăng ký → **ngắt mạng** (hoặc để phiên hết hạn) → bấm Lưu → quan sát: modal có đóng không, có toast không → **bấm Lưu lần nữa** → nối mạng lại, đếm số bản ghi.
- **Đúng:** báo lỗi rõ, và nút Lưu phải khoá lại sau lần bấm đầu.
- **Nghi ngờ:** **2 bản ghi**. `:1505` `await refreshCache(); closeModal(); toast('Đã tạo đơn đăng ký (chờ duyệt)');` — `refreshCache()` **không bọc `guard()`**, và 4 lời gọi đầu của nó (`API.rooms/students/facilities/settings`, `:481-482`) **không có `.catch`** → nó **ném lỗi** → `closeModal()` và `toast()` **không bao giờ chạy** → **modal vẫn mở, không toast, trông y như chưa lưu**. Việc ghi ở server thì **đã xong rồi**. Người dùng bấm lại là chuyện đương nhiên.
- **Chỗ này lặp ~40 lần trong `app.js`** (`:1168`, `:1367`, `:1432`, `:1519`, `:2059`, `:2404`…). Ghép với V2-54 (duyệt đơn không chống đồng thời) → **đây chính là cái làm người dùng double-click**.
- **Mức độ:** Cao. Đây là case đáng giá nhất nhóm — em tìm ra nó **vì đi đọc bộ máy của chuông**, chứ bản thân nó không phải lỗi chuông.

### V2-83 · Panel chuông trôi khỏi nút, và thử xem có đóng được trên điện thoại không
- **83a:** mở panel → **cuộn trang** → **đổi cỡ cửa sổ**.
  - **Nghi ngờ:** panel đứng yên một chỗ, lệch khỏi chuông. `.notif-panel{position:fixed}` (`styles.css:444`) được đặt toạ độ **một lần** lúc mở theo `getBoundingClientRect()` (`:525-527`), **không có listener `scroll`/`resize`**, không dùng anchor.
- **83b:** trên **điện thoại thật** (app là PWA, đây là môi trường chính): mở panel → **chạm ra vùng trống ngoài panel**.
  - **Nghi ngờ:** panel **không đóng**. `_notifOutside` nghe `mousedown` (`:528,532`) — trên iOS Safari, chạm vào vùng **không tương tác** thường **không phát sinh `mousedown`**. Cần thử thật, đây là dự đoán.
- **83c:** mở panel → bấm **Esc**.
  - **Nghi ngờ:** không đóng, không có handler `keydown` nào. Chuông cũng thiếu `aria-expanded`/`aria-haspopup`.

### V2-84 · Chuông không có "đã đọc" — lúc nào cũng đỏ
- **Bước:** mở chuông, đọc hết 5 mục, đóng lại. Nhìn dot.
- **Nghi ngờ:** **vẫn đỏ nguyên số cũ**. Không có khái niệm đã xem: `updateNotif()` (`:514-517`) chỉ đếm lại việc **chưa xử lý xong**. Nghĩa là dot chỉ tắt khi **xử lý xong việc**, không phải khi **đã biết việc**.
- **Đúng?** — **cần sếp chốt**, đây có thể là cố ý (dot = tồn đọng, không phải tin chưa đọc). Nếu là cố ý thì **đúng và nên giữ**; chỉ cần biết để không ai "sửa" nhầm sau này. Nhưng nó đá với V2-77: một thứ không tự cập nhật **và** không đánh dấu đã đọc được thì không phải chuông báo, nó là **bộ đếm tồn đọng** — nên gọi đúng tên.
- **Kèm:** tổng (`:515`) là **số việc**, không phải số người — một HV vừa cần báo trường vừa chờ hoàn cọc thì được đếm 2 lần ở 2 mục. Hợp lý, nhưng xác nhận lại với sếp cách hiểu con số.

### V2-85 · Hai người cùng làm → chuông người kia đỏ hoài, bấm vào thì việc đã xong
- **Bước:** 2 máy cùng login (A: admin, B: staff), cùng thấy "3 đơn chờ duyệt". A duyệt hết 3 đơn. B **không F5**, bấm chuông → bấm vào mục "3 đơn đăng ký chờ duyệt".
- **Đúng:** B thấy danh sách rỗng kèm lời giải thích, hoặc chuông B đã tự về 0 (xem V2-77).
- **Nghi ngờ:** chuông B vẫn ghi **3**; bấm vào chạy `adminGo('reg')` → `viewRequests()` (`:1821-1827`) **gọi API thật** → danh sách **rỗng**, và ngay lúc đó `updateNavBadges()` (`:1827`) mới sửa lại con số. → **chuông nói dối cho tới đúng khoảnh khắc người dùng bấm vào nó**. Đây là hệ quả trực tiếp của V2-77, nhưng kiểm riêng vì nó là kịch bản **chắc chắn xảy ra hằng ngày** khi có 2 nhân viên.

### Ghi nhận — KHÔNG phải lỗ hổng, đừng báo nhầm
Panel dựng bằng ghép chuỗi HTML (`:523`) và app **tắt hoàn toàn CSP** (`index.js:16`) — nhìn rất giống chỗ
XSS. **Nhưng không phải:** `i.tx` (`:506-510`) chỉ ghép **số đếm** với chuỗi hằng, `i.act` là tên hàm cố định,
`i.ic` là icon nội bộ. **Không có một mẩu dữ liệu người dùng nào chạm vào panel.** Khác hẳn TC-46 (tên HV
hiện ở danh sách/phiếu báo). Đã kiểm, sạch.

---

## Thứ tự ưu tiên

**Nếu chỉ có nửa ngày, chạy đúng 10 case này:**
V2-71 · V2-73 · V2-36 · V2-20 · V2-12 · V2-54 · V2-56 · V2-30 · V2-01 · V2-44

**Nếu có một ngày, thêm:** V2-02 · V2-21 · V2-37 · V2-41 · V2-51 · V2-55 · V2-63 · V2-04 · V2-23 · V2-45
· **V2-82** (modal kẹt → bấm lại → bản ghi trùng: 10 giây là ra, và nó giải thích vì sao V2-54 xảy ra ngoài đời)
· **V2-77 / V2-78** (chuông: không tự cập nhật, và tải hụt thì báo "không có việc")

**Case phải chạy cuối cùng:** V2-71 (tự khoá quyền admin), V2-13/V2-15 (gọi ra mạng ngoài — chỉ dùng host của mình).

---

## Bốn vấn đề gốc (không phải lỗi lẻ)

Bộ v1 chốt 3 nguyên nhân gốc: *quy tắc chỉ nằm trên giao diện*, *CSDL không có tuyến phòng thủ*,
*quyền hạn không thu hồi được*. Vòng sửa 15/07 đã **giải quyết được cái thứ 3** (xác nhận ở V2-71: role đọc
lại từ DB mỗi request, `token_epoch` thu hồi vé, `revokeTokens` gọi đủ 3 chỗ). Hai cái đầu **vẫn còn**,
và V2 tìm ra **hai cái mới**:

1. **Quên áp dụng công cụ của chính mình.** Đây là phát hiện xuyên suốt V2. Repo **đã có sẵn** `valid.js`
   (`isValidYmd`, `rejectUnknown`, `checkSetting`), `room-rules.js`, mô hình from/to_date của `room-leaders.js`
   — **kèm comment nêu đích danh sự cố mà chúng sinh ra để phòng**. Nhưng:
   `violations.routes.js` không import `valid.js` dòng nào · `applications.routes.js` cũng không ·
   `checkSetting` chỉ gọi ở `PUT /settings`, bỏ trống `/smtp/test` · `isValidMonth` dùng ở `invoices.routes.js:268`
   nhưng không ở `:64` · `uses_washing` và `vehicles` không dùng mô hình from/to_date dù `schema.sql:445-447`
   đã ghi rõ bài học · `me.routes.js:116,137` không theo khuôn `SELECT` cột tường minh mà chính `:108` làm đúng.
   **Phòng thủ đã được xây, chỉ là nửa số cửa không dùng nó.**

2. **Hai đường vào cùng một nghiệp vụ, hai kết quả khác nhau.** Check-out có **3 đường**
   (students / requests / maintenance) làm **3 việc khác nhau** (V2-37). Phí gửi xe: đường tạo hoá đơn lọc
   `deleted_at`, đường tính lại thì không (V2-20). `/info` và `/stats` cho hai con số phòng (V2-53).
   `/years` và `/revenue` lọc khác nhau (V2-69). Kiểm trùng username: app không phân biệt hoa thường,
   DB thì có (V2-76). **Số liệu phụ thuộc vào đường đi, không phụ thuộc dữ liệu.**

3. **Nuốt lỗi trong im lặng, rồi báo thành công.** `severity` sai → `minor` · `status` sai → `open` ·
   `quantity:"abc"` → `1` · `smtp_secure:"True"` → `false` · ngày sinh sai → `NULL` · upload CCCD hỏng →
   `catch(e){}` rỗng · gõ nhầm tên field → 200 không đổi gì · ghi audit lỗi → `.catch(()=>{})`.
   **Mọi trường hợp đều trả 2xx.** Người dùng tin là đã làm xong; dữ liệu thì không có ở đó.

4. **Nhật ký thủng đúng chỗ cần nhất.** Không ghi đăng nhập · không ghi thao tác thành công của học viên ·
   không ghi 401 · không ghi 5xx · không ghi GET · không ghi giá trị cũ · nuốt lỗi khi ghi hụt ·
   phần cũ không tra cứu lại được. **Nhật ký hiện tại không dùng để điều tra sự cố được** — nghĩa là
   mọi case còn lại trong bộ này, nếu xảy ra thật ngoài đời, sẽ không có bằng chứng.

## Đối chiếu với bộ v1

Ba case của v1 **được xác nhận đã sửa thật** (đọc code, không phải đọc báo cáo): TC-13/TC-14/TC-15
(thu hồi quyền — `auth.js:67-80`), TC-21/TC-22 (giới tính + quá tải — `room-rules.js` có được gọi ở đường
duyệt đơn), TC-47a (chặn SVG — `storage.js:26,32`).
**TC-18 (học viên thao tác không để lại vết) chưa sửa** — xem V2-46, và giờ nó có hệ quả tiền thật (V2-44).
