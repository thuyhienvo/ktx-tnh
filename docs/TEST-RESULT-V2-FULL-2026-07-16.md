# KẾT QUẢ TEST ĐỐI KHÁNG V2 — TOÀN BỘ 15 NHÓM

**Ngày:** 16/07/2026 · **Phiên bản:** v72
**Môi trường:** `http://localhost:3000` (LOCAL). **Không một request nào chạm vào `ktx-tnh.onrender.com`.**
**An toàn:** mail test bay vào hộp thư giả trên chính máy này (127.0.0.1). V2-71 chạy trên **tài khoản admin phụ do script tự tạo rồi tự xoá** — tài khoản `admin` thật không bị đụng tới.
**Dọn dẹp:** đã kiểm lại — CSDL về đúng **206 học viên**, **134 phiếu báo**, **1 kỳ (2026-07)**, **1 tài khoản admin**.

> Chị dặn: **chỉ test và báo lỗi, fix sau.** Báo cáo này không sửa một dòng code nào của app.

---

## Tổng hợp

| | Số case |
|---|---|
| ❌ FAIL | **71** |
| ✅ PASS (app làm đúng) | **12** |
| ⚠️ Không kết luận được | 1 (V2-83a) |

**Bộ đề V2 đoán đúng gần hết**, nhưng em chạy thật thì **có 4 chỗ đề đoán SAI** — em ghi rõ ở mục "Đề bài đoán sai" cuối báo cáo, để chị khỏi mất công sửa thứ vốn không hỏng.

---

## 🔴 NHÓM CHẶN PHÁT HÀNH

### 1. V2-51 · Nam vào phòng nữ hợp lệ, không luật nào chặn

Đây là lỗi **nặng nhất trong cả vòng test**.

```
Gửi đơn với gender = "Male"  (M hoa)  → lưu vào CSDL: female
Gửi đơn KHÔNG có trường gender        → lưu vào CSDL: female
```

Cả hai đều HTTP 201, không một lời cảnh báo. Rồi lúc duyệt đơn, luật chặn giới tính so **giới tính của đơn (nữ)** với **giới tính của phòng (nữ)** → "hợp lệ" → **nam được xếp vào phòng nữ, hoàn toàn đúng luật dưới mắt server**.

Luật chặn giới tính là thành quả vòng sửa 15/07 và nó **vẫn chạy tốt** — chỉ là đường này đi vòng qua nó, vì dữ liệu đã sai từ lúc nhận đơn. Cùng file, cùng hàm đó, trường `phone` sai thì **chặn 400** — gender thì không.

### 2. V2-41b · Xác nhận đơn trả phòng → xoá sạch lịch sử ở phòng

```
Học viên vào phòng 01/07/2026.
Admin xác nhận đơn trả phòng với ngày ra = 01/01/2020.
→ HTTP 200. CSDL: vào 2026-07-01, ra 2020-01-01  (ngày ra TRƯỚC ngày vào)
→ bảng lượt-ở-phòng: còn 0 dòng — XOÁ SẠCH
```

Mất lịch sử ở phòng nghĩa là **tiền điện cả phòng đó chia lại sai cho tất cả mọi người** — đúng cái quy tắc chị vừa chốt ngày 15/07. Đáng nói: đường bảo trì xác nhận trả phòng thì **chặn đúng** ngày ra trước ngày vào. Hai đường làm cùng một việc, một đường có kiểm, một đường không.

### 3. V2-42b · Đơn ghi "đã từ chối" nhưng học viên vẫn bị trả phòng thật

```
Xác nhận đơn trả phòng  → học viên check-out, phiếu báo tính lại, ghi nhật ký
Bấm Từ chối cùng đơn đó → HTTP 200
→ đơn:      "rejected"   (đã từ chối)
→ học viên: "out"        (đã trả phòng)
```

Mâu thuẫn **vĩnh viễn**, không có đường quay lại. Kèm theo: xác nhận lần 2 với ngày khác thì ghi đè ngày cũ và **ghi thêm một dòng nhật ký ra/vào nữa** (chạy lại bao nhiêu lần cũng được); từ chối đơn **không tồn tại** cũng trả `{ok:true}`.

### 4. V2-45 · Học viên đọc được ghi chú nội bộ về chính mình

```
GET /api/me/damage           → lộ  admin_note: "NOI BO: khong cho gia han"
GET /api/me/checkout-request → lộ  admin_note
GET /api/me/profile          → lộ  note: "GHI CHU NOI BO: HV nay hay gay su"
                                  deposit_deduction_note: "Tru 500k do lam hong tu"
```

Ba đường này dùng `SELECT *` nên trả về nguyên si mọi cột. Ngay cạnh đó, `/me/violations` **liệt kê cột tường minh và cố ý bỏ `admin_note`** — tức là người viết **đã biết** phải giấu, chỉ là quên ba chỗ kia.

### 5. V2-77 · Chuông báo không bao giờ tự kêu

Em đo bằng trình duyệt thật:

```
Chuông: "0"
→ máy khác gửi 1 đơn đăng ký mới
→ ngồi nhìn 45 giây, không F5, không bấm gì:  vẫn "0" · "0" · "0"
→ F5 tải lại trang:                            "1"  ← nhảy lên ngay
```

Đơn nằm ở server suốt 45 giây đó. Chuông đếm từ bộ nhớ tạm nạp lúc mở trang, **không có bộ đếm giờ nào tự hỏi server**. Nó chỉ tính lại khi **chính mình vừa bấm một nút có sửa dữ liệu**. Nghĩa là: chuông chỉ phản ánh việc do chính mình vừa làm — chị phải **tự đoán là có việc rồi tự F5** mới thấy. Một cái chuông như vậy không làm được việc của chuông.

---

## 🟠 NHÓM 6 — BẢO TRÌ

| Case | Kết quả |
|---|---|
| **V2-40** | Bảo trì gõ sai 1 chữ `"donee"` → route **ép mọi giá trị lạ thành `"processing"`** thay vì báo lỗi. Việc **đã xong lùi về đang xử lý**, ngày hoàn thành **bị xoá**, và **ghi chú của admin bị xoá trắng** (body không gửi `note` → ghi đè bằng chuỗi rỗng) |
| **V2-40b** | Bảo trì đặt `"blocked"` → CSDL nhận, nhưng schema chỉ khai `new/processing/done`. Không có ràng buộc nên lọt. Trạng thái "chưa xử lý được" **không tồn tại trong thiết kế** |
| **V2-40c** | Admin sửa ghi chú cho việc đang `"blocked"` → trạng thái **rơi về `"new"`**, mất luôn lý do bảo trì chưa làm được |
| **V2-38** | Xác nhận bàn giao nhận phòng **lần 2** → HTTP 200, **ghi đè mốc thời gian lần đầu** và **xoá trắng ghi chú bàn giao**. Mất dấu lần bàn giao thật |
| **V2-39** | Bảo trì đặt ngày trả phòng **31/12/2199** → HTTP 200, ghi vào CSDL. Server **biết** đó là tương lai (giữ status "in") **nhưng vẫn ghi**, rồi gọi tính lại phiếu tháng "2199-12" → không có phiếu đó → **không tính lại gì cả**. Dữ liệu một đằng, tiền một nẻo |
| **V2-39b** | ✅ **App làm đúng**: ngày trả trước ngày nhận phòng → chặn 400 |
| **V2-43** | Nhật ký **ghi sai người làm**: bảo trì xác nhận trả phòng → ghi `source="admin"`; admin duyệt đơn → ghi `source="self"` (nghĩa là *học viên tự làm*). Tra nhật ký ra tên sai người |

---

## 🟠 NHÓM 7–8 — ĐƠN TỪ & CỔNG HỌC VIÊN

| Case | Kết quả |
|---|---|
| **V2-41** | Xác nhận đơn với ngày = `"abc"` → **500 SẬP**. Đường admin tương đương thì chặn 400 đúng |
| **V2-46** | Học viên bật máy giặt + gửi báo hỏng thành công → **audit_log không ghi một dòng nào**. Chỉ ghi khi họ **bị từ chối**. Tranh chấp "em không hề đăng ký máy giặt" → không có gì đối chiếu |
| **V2-47** | Học viên **đã trả phòng** vẫn gửi được báo hỏng, **mô tả 200KB** → HTTP 201. Ngay bên cạnh, `/me/washing` **có kiểm** học viên còn ở hay không → chặn 400 đúng. Hai đường cạnh nhau, một đường có, một đường không |
| **V2-48** | Học viên gửi đơn trả phòng ngày **31/12/2199** → nhận. Rồi gửi đơn thật → **bị chặn: "Bạn đã có đơn trả phòng đang chờ duyệt"** → **học viên tự khoá chính mình**, không tự gỡ được |
| **V2-48b** | ✅ **App làm đúng**: lý do bịa → chặn 400 |
| **V2-49** | Tài khoản `student` **không gắn học viên nào** → gửi **3/3 đơn đều lọt**. Chốt "chỉ 1 đơn chờ duyệt" dùng `WHERE student_id=$1`, mà trong SQL `NULL = NULL` là *chưa biết* chứ không phải *đúng* → không bao giờ khớp → **gửi vô hạn đơn** |

---

## 🟠 NHÓM 9 — TRANG CÔNG KHAI

| Case | Kết quả |
|---|---|
| **V2-50** | **40 đơn giống hệt nhau, gửi cùng lúc, không đăng nhập → nhận cả 40, mất 142ms.** Không rate limit riêng, không chống trùng. Trang đăng nhập thì có chặn 20 lần/15 phút — trang nhận đơn thì không |
| **V2-50b** | Đơn có ghi chú **2 triệu ký tự** → HTTP 201, lưu đủ 2.000.000 ký tự |
| **V2-52** | ✅ **Ngày sinh: app CHẶN ĐÚNG** — `1998-13-05`, `"hom qua"`, `1850-01-01` đều 400 kèm thông báo tiếng Việt rõ ràng. **Đề bài đoán sai chỗ này.** ❌ Nhưng **ảnh CCCD thì nuốt im lặng**: gửi SVG hoặc chuỗi rác → **HTTP 201 báo thành công, ảnh không hề được lưu**. Học viên tin là đã nộp CCCD, nhân viên mở đơn thấy trống, **không dòng nhật ký nào** vì lỗi bị `catch` rỗng nuốt sạch |
| **V2-53** | `/public/stats` khoe **206 học viên**, thực tế đang ở chỉ **111** — lệch 95 vì đếm cả người đã trả phòng và phòng nhân viên/an ninh. `/public/info` ngay cạnh thì lọc đúng. `zones: 2` là **số cứng trong code** |
| **V2-53b** | Xoá mềm 1 học viên ở phòng 103 → `/available-rooms` **vẫn đếm 3 người**. **Học viên đã xoá vẫn chiếm giường** → phòng còn trống thật **bị ẩn khỏi trang đăng ký** |
| — | `/available-rooms` công khai **giới tính, tầng, sức chứa, số người từng phòng** cho người không đăng nhập → biết chính xác phòng nào có mấy nữ đang ở |

---

## 🟠 NHÓM 11 — ẢNH / FILE

| Case | Kết quả |
|---|---|
| **V2-59** | Đăng "ảnh" hero = **một câu chữ thường**, chỉ dán nhãn `data:image/png` → **lưu OK**. Tải `/api/public/image/hero` → trả về đúng câu đó, `Content-Type: image/png`. Server **chỉ đọc cái nhãn do client tự khai**, không kiểm magic bytes — trong khi PDF ngay dưới **trong cùng file** thì có kiểm. Không phải XSS (`nosniff` chặn), nhưng **lưu byte tuỳ ý dưới tên miền KTX**, phục vụ công khai, không cần đăng nhập |
| **V2-60** | **Bấm Xoá mà không xoá.** Em hỏi thẳng kho MinIO: đăng PNG → lưu `hero.png`; đăng đè JPG → lưu `hero.jpg` (tên file theo **đuôi** nên **không đè lên nhau**); bấm Xoá → `hero.jpg` mất, **`hero.png` VẪN CÒN**. Chị bấm Xoá, tin là đã xoá, thực tế ảnh nằm lại kho vĩnh viễn. Cùng repo, luồng ảnh CCCD **có** xoá file cũ khi đổi đuôi — luồng này thiếu hẳn bước đó |
| **V2-61** | PDF 17MB → **HTTP 413, thông báo tiếng Anh** `"request entity too large"`. Giao diện nói "tối đa ~15MB", code kiểm ">20MB", hệ thống thi hành **16MB** — **ba con số khác nhau**, và dòng kiểm 20MB là **code chết**, không bao giờ chạy tới |
| **V2-62** | `DELETE /api/media/khong-he-ton-tai` → **200 `{ok:true}`**. Báo "đã xoá" cho thứ chưa từng có. Tên `"../../etc/passwd"` cũng 200. Cả hai đường **đăng** thì đều có kiểm danh sách tên cho phép — đường **xoá** thì không |

---

## 🟠 NHÓM 12 — NHẬT KÝ

**V2-63 · Nhật ký không ghi đăng nhập — mắt xích quan trọng nhất bị đứt.**

```sql
SELECT COUNT(*) FROM audit_log WHERE path LIKE '%login%';
→ 0
```

Không phải "ít", mà là **0 dòng từ trước tới nay**. Không biết ai đăng nhập lúc nào, không biết có ai đang dò mật khẩu.

**V2-64 · Bốn lỗ thủng khác** — em đo từng cái:

| Không được ghi | Đo được | Vì sao đau |
|---|---|---|
| **401** (dò token, vé đã thu hồi) | 5 lần dò → **0 dòng** | Chặn xảy ra *trước* khi biết là ai. (403 thì **có** ghi) |
| **GET** (đọc dữ liệu cá nhân) | đọc `data-health` → **0 dòng** | Với dữ liệu cá nhân, việc **ĐỌC** mới là thứ cần ghi — Nghị định 13 |
| Thao tác **thành công** của học viên | V2-46 → **0 dòng** | Tranh chấp không có bằng chứng |
| Người **chưa đăng nhập** (`/apply` nộp CCCD) | — | Spam ẩn danh vô hình |

**V2-66 · Nhật ký có mà tra không ra.**

```
GET /api/admin/audit?limit=500&offset=200&user=admin&from=2026-01-01&to=2026-01-31  → 500 dòng
GET /api/admin/audit?limit=500                                                       → 500 dòng
```

**Y hệt nhau.** Mọi bộ lọc bị bỏ qua sạch — chỉ nhận `limit`, trần 500. Không lọc theo người, không theo ngày, không lật trang. Bảng đang có **1.152 dòng chỉ sau 4 ngày** và **không có cơ chế dọn/lưu trữ** → vài tuần nữa, 500 dòng mới nhất chỉ còn vài ngày. Dữ liệu nằm trong CSDL nhưng **ứng dụng không lấy ra được** → giá trị điều tra bằng 0.

**Ghi nhận (điểm tốt, đã kiểm):** toàn repo **không có endpoint nào sửa/xoá `audit_log`** — chỉ ghi thêm và đọc. Ở tầng ứng dụng, nhật ký là **chỉ-ghi-thêm**. Nhưng tầng CSDL không có gì chống sửa: ai vào được CSDL là sửa sạch, không dấu.

---

## 🟠 NHÓM 13 — BÁO CÁO

| Case | Kết quả |
|---|---|
| **V2-69** | `month="xin-chao"` và `month="2026-99"` → **500 SẬP** (không lưu). Nhưng **`month="9999-12"` → HTTP 200, tạo THẬT 111 phiếu báo**, rồi **"9999" nhảy vào ô chọn năm của báo cáo**. Không có chặn trên/dưới cho năm. (Em đã dọn sạch 111 phiếu này.) `month=""` thì ✅ chặn 400 đúng |
| **V2-69b** | Xoá mềm học viên giữ toàn bộ phiếu năm 2025 → **năm 2025 VẪN nằm trong ô chọn**, bấm vào thì **báo cáo trắng, không một lời giải thích**. Danh sách năm không lọc học viên đã xoá, báo cáo thì có → hai câu trả lời khác nhau cho cùng một năm |
| **V2-70** | Em dựng 1 phiếu năm 2025 rồi đo: `?year=2026` → 1 mục · `?year=2025` → 1 mục · **`?year=%25` → 3 mục**. **Dấu `%` làm ký tự đại diện → gộp mọi năm, vô hiệu hoá bộ lọc năm.** Không phải lỗ injection, nhưng số liệu báo cáo sai |

---

## 🟡 NHÓM 14 — QUẢN TRỊ TÀI KHOẢN

**V2-71 · Bỏ trống một trường → admin tự mất quyền vĩnh viễn.** Em thử trên **tài khoản admin phụ tự tạo**, không đụng admin thật:

```
Gửi KÈM role="staff"      → 400 "Không thể tự hạ quyền chính mình"  ✅ chốt chặn CÓ chạy
Gửi KHÔNG có trường role  → 200 · vai trò: "admin" → "staff"        ❌
   vé đang cầm            → 401 (bị thu hồi ngay lập tức)
   đăng nhập lại          → vào được, nhưng trang quản trị → 403     ❌ mất quyền vĩnh viễn
```

Chốt chặn chỉ chạy **khi trường `role` có giá trị** — bỏ trống thì nó không chạy, rồi hàm chuẩn hoá vai trò trả về `"staff"` cho mọi giá trị lạ. Nếu đây là admin cuối cùng thì **không còn ai cấp lại quyền, phải vào thẳng CSDL mới cứu được**.

> **Nhưng mức nghiêm trọng thấp hơn đề bài nói:** em kiểm giao diện — form sửa tài khoản **luôn gửi kèm `role`** từ ô chọn (ô đó luôn có giá trị). **Chị bấm trên màn hình thì không bao giờ chạm được lỗi này.** Chỉ gọi thẳng API mới dính.

**V2-76 · Tên đăng nhập đã dùng thì mất luôn, không dùng lại được.** Tạo `nguyenvana` → xoá (xoá mềm, dòng vẫn nằm đó) → tạo lại cùng tên → **400 "đã tồn tại"**. Nhân viên nghỉ rồi quay lại, hoặc gõ nhầm tên lúc tạo → phải bịa tên khác mãi mãi.

**V2-73 · ✅ App chặn được phần lớn — khác hẳn đề bài dự đoán.** Admin đặt mật khẩu tài khoản học viên → hệ thống **tự bật cờ "buộc đổi mật khẩu"** → admin đăng nhập vào được nhưng **403 ở mọi thao tác**: *"Bạn phải đổi mật khẩu trước khi sử dụng hệ thống."* Muốn mạo danh thì **phải đổi mật khẩu** → học viên đăng nhập không được nữa → **học viên biết ngay**. Và nhật ký **có ghi** `[admin] POST /api/admin/users/<id>/password`. Mạo danh được, nhưng **không im lặng được** — có hai dấu vết.

**V2-74 · ✅ Đề bài đoán SAI.** `/api/admin/data-health` trả về **1,2 KB toàn số đếm tổng hợp** — **không một cái tên, không một số CCCD**. Chỉ còn đúng một ý là thật: **lệnh GET này không để lại vết trong nhật ký**.

**V2-75 · ✅ Chịu được ở quy mô hiện tại.** 20 lệnh `data-health` song song → **147ms, 0 lỗi**. Mỗi lệnh quét toàn bảng và không có `LIMIT` ở tầng SQL, nên dữ liệu lớn dần thì đây là đường làm nghẽn — nhưng **hôm nay chưa phải vấn đề**.

### 🆕 Lỗi mới em tìm được, không có trong đề bài

`ROLE = r => (['admin', 'staff', 'maintenance'].includes(r) ? r : 'staff')`

**Mọi vai trò lạ đều âm thầm rơi thành `staff`** — không báo lỗi. Gõ nhầm `"admn"` → ra **nhân viên**. Xin `"student"` → ra **nhân viên**, và câu lệnh thêm tài khoản **không hề có cột `student_id`** → **không tạo được tài khoản học viên qua API quản trị**.

> **Em kiểm tiếp và thấy app có hai lớp chặn thật:** giao diện chỉ cho chọn 3 vai (nhân viên/bảo trì/quản trị), và danh sách tài khoản **lọc bỏ hẳn học viên** (`role IN ('admin','staff','maintenance')`). Nên đường "mở tài khoản học viên ra sửa → vô tình biến thành nhân viên toàn quyền" **không tới được từ màn hình**. Lỗi này **chỉ đi được qua API**.

---

## 🟡 NHÓM 15 — CHUÔNG BÁO

Ngoài **V2-77** (đã nêu ở phần chặn phát hành):

| Case | Kết quả |
|---|---|
| **V2-81** | **Học viên: không có chuông. Bảo trì: không có chuông.** Em đăng nhập từng vai bằng phiên riêng để kiểm. Mà bảo trì mới là người cần biết *có việc mới được giao*, học viên mới là người cần biết *đơn đã duyệt hay bị từ chối*. Cả hai phải tự F5 mà đoán |
| **V2-84** | **Không có "đã đọc".** Chuông chỉ tắt khi việc được **làm xong**, không phải khi được **đọc** → đỏ triền miên → nhìn mãi thành quen rồi bỏ qua việc thật |
| **V2-83c** | **Bấm Esc → panel vẫn mở.** Không có một handler bàn phím nào. Mở panel bằng bàn phím rồi thì không thoát ra được |
| **V2-83b** | **Chạm ra vùng trống → panel vẫn mở.** App chỉ nghe `mousedown`. Trên iPhone, chạm vào vùng không tương tác thường **không sinh `mousedown`** → không đóng được panel bằng cách chạm ra ngoài. App là PWA, **điện thoại mới là môi trường chính** |
| — | Nút chuông thiếu cả `aria-expanded` lẫn `aria-haspopup` |
| **V2-83a** | ⚠️ **Không kết luận được — và có lẽ không phải lỗi.** App dùng khung cố định + vùng cuộn bên trong, `document` không cuộn (cao 900px / màn 900px), nên thanh trên chứa chuông **không bao giờ trôi**. Em thử cả cỡ điện thoại 390×600, vẫn không cuộn được `document` để tái hiện |

---

## Đề bài V2 đoán SAI — chị đừng sửa 4 chỗ này

| Case | Đề bài nói | Chạy thật |
|---|---|---|
| **V2-52 (ngày sinh)** | "nuốt im lặng, lưu `birth_date=NULL`, vẫn báo 201" | **Chặn 400 đúng**, thông báo tiếng Việt rõ. Chỉ phần **ảnh CCCD** là nuốt thật |
| **V2-73** | "admin đặt mật khẩu rồi đăng nhập dưới danh nghĩa học viên" | **Cờ "buộc đổi mật khẩu" chặn**. Mạo danh được nhưng để lại 2 dấu vết, không im lặng |
| **V2-74** | "`data-health` là đường đọc số CCCD hàng loạt" | Trả về **1,2KB số đếm**, không tên, không CCCD. Chỉ ý "không ghi vết" là đúng |
| **V2-69** | "`month='xin-chao'` lưu được → dropdown hiện năm `xin-`" | `"xin-chao"` **làm sập 500, không lưu**. Lỗi thật nằm chỗ khác: **`"9999-12"` lưu được thật** → năm 9999 vào ô chọn |

---

## Những chỗ em tự sửa phép đo trước khi báo

Ghi lại cho minh bạch — mấy chỗ này em suýt báo sai:

1. **V2-40 lần đầu trả 404** — em tạo dữ liệu test với `category='repair'` và chưa chuyển bảo trì, trong khi route chỉ nhận `category='damage'` đã chuyển bảo trì. **404 là app đúng, em sai.** Tạo lại dữ liệu đúng thì mới lòi ra lỗi thật.
2. **V2-63 lần đầu ra PASS** — em đếm tổng số dòng nhật ký trước/sau, bị lệnh khác chen vào làm +1. Hỏi thẳng CSDL `WHERE path LIKE '%login%'` → **0 dòng**. Là FAIL.
3. **V2-53b lần đầu vô nghĩa** — em chọn nhầm phòng đã đầy nên nó vốn không nằm trong danh sách phòng trống. Chọn lại phòng đang hiện thì mới đo được.
4. **V2-60 lần đầu ra 403** — em tải file cũ qua HTTP công khai, nhưng kho MinIO không mở ẩn danh. Phải hỏi thẳng kho mới biết `hero.png` **vẫn còn**.
5. **V2-70 lần đầu không phân biệt được** — CSDL chỉ có dữ liệu 2026 nên `?year=2026` và `?year=%` ra kết quả giống nhau. Dựng thêm 1 phiếu năm 2025 mới lòi ra 1 mục vs 3 mục.
6. **V2-83 lần đầu báo "Esc đóng được"** — sai, vì `.notif-panel` dùng `position:fixed` nên `offsetParent` **luôn null**; phép đo "panel có mở không" của em sai từ gốc. Đo bằng sự tồn tại của `#notifPanel` thì ra: **Esc không đóng**.

---

## Đề nghị thứ tự sửa

1. **V2-51** (nam vào phòng nữ) — nặng nhất, và sửa dễ nhất: chặn 400 khi `gender` không phải `male`/`female`, y như `phone` đang làm
2. **V2-41b / V2-42b** (mất lịch sử ở phòng · đơn từ chối mà vẫn check-out) — đụng thẳng vào tiền điện chị vừa chốt
3. **V2-45** (học viên đọc ghi chú nội bộ) — liệt kê cột tường minh, copy đúng cách `/me/violations` đang làm
4. **V2-77 / V2-81** (chuông) — thêm bộ đếm giờ tự hỏi server; cho bảo trì và học viên cái chuông
5. **V2-63 / V2-66** (nhật ký) — ghi đăng nhập; thêm lọc theo người/ngày + lật trang
6. Còn lại theo bảng trên
