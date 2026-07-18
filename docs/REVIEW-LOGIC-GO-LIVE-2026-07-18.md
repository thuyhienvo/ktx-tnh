# RÀ SOÁT LOGIC TRƯỚC GO-LIVE — 18/07/2026 (v80)

**Mục tiêu:** app quản lý ký túc xá vận hành được **trước 6/8**. Mảng tài chính (QR/phiếu thu) là **giai đoạn 2** — đã gỡ khỏi app, không thuộc phạm vi.

Rà bằng 6 agent song song trên code v80 hiện tại (không dựa báo cáo cũ 16/07). **Nhiều lỗi V2 cũ đã được vá ở #64–#71.** Dưới đây là các lỗi **CÒN MỞ**, xếp theo mức độ. Nhiều mục được ≥2 agent độc lập xác nhận (ghi rõ).

---

## 🔴 CHẶN PHÁT HÀNH

### BLK-1 · 3 đường trả phòng làm việc KHÔNG THỐNG NHẤT (xác nhận bởi 3 agent)
| Việc khi trả phòng | `students /checkout` (students.routes.js:433) | `requests …/confirm` (requests.routes.js:72) | `maintenance …/checkout` (maintenance.routes.js:64) |
|---|:--:|:--:|:--:|
| Đóng `room_stays` (chốt lượt ở) | ✓ | ✓ | ✗ |
| Đóng nhiệm kỳ phòng trưởng | ✓ | ✗ | ✗ |
| Dọn hoá đơn kỳ sau | ✓ | ✗ | ✗ |
| Chặn ngày > hôm nay | ✗ | ✗ | ✓ |

**Hậu quả:** trả phòng qua đường "bảo trì" **không đóng lượt ở** → người đã đi vẫn nằm trong roster chia điện MỌI THÁNG SAU → **chia điện sai cả phòng**. Qua đường "duyệt đơn" hoặc "bảo trì", nếu HV là **phòng trưởng** → nhiệm kỳ không đóng → **miễn nước+dịch vụ vĩnh viễn** + phòng cũ không cử được phòng trưởng mới; và **hoá đơn tháng sau vẫn phát, vẫn đòi tiền người đã đi**.
**Sửa gốc:** gộp 3 đường về **một hàm `doCheckout()` chung** (đóng stay + đóng leader + dọn phiếu sau + validate ngày thống nhất).

### BLK-2 · Đổi giới tính phòng khi còn người khác giới — `rooms.routes.js:102`
`PUT /rooms/:id {gender}` update thẳng, không kiểm người đang ở. Tạo ra **phòng "nữ" chứa nam đang ở**, rồi server cho xếp thêm nữ vào ở chung. Phá bất biến "nam không ở phòng nữ".
**Sửa:** nếu đổi gender, đếm HV `status='in'` khác giới trong phòng; >0 → 400.

### BLK-3 · Trả phòng/chuyển phòng LÙI NGÀY sau khi đã chuyển phòng → xoá lượt `room_stays` (xác nhận bởi 2 agent)
`requests.routes.js:90` & `students.routes.js:445` chỉ chặn `date < check_in_date`, KHÔNG chặn `date < from_date của lượt đang mở`. Với HV đã chuyển phòng (lượt mở bắt đầu ngày chuyển), chọn ngày trả nằm giữa ngày nhận và ngày chuyển → `closeStay` gặp `toDate < from_date` → **DELETE lượt phòng mới** (`room-stays.js:27-30`). Biến thể còn sót của V2-41b. → chia điện phòng mới sai.
**Sửa:** guard `date >= from_date của lượt ở đang mở` (không chỉ check_in_date), áp cho cả transfer.

### BLK-4 · `reject` / `delete` đơn KHÔNG nguyên tử — `applications.routes.js:149-173`
`reject`/`delete` đọc status bằng SELECT thường (không `FOR UPDATE`), UPDATE không có `AND status=...`/không kiểm `rowCount`. Chạy song song với `approve` (đang giữ lock, tạo student) → student đã vào ở nhưng đơn thành `rejected` / bị xoá mềm → **mâu thuẫn vĩnh viễn**. (reject cũng thiếu `deleted_at IS NULL`.)
**Sửa:** `UPDATE ... WHERE id=$1 AND status='pending' AND deleted_at IS NULL RETURNING id` + kiểm `rowCount===0` → 409.

### BLK-5 · TZ=UTC → lệch ngày VN toàn app (NGHIÊM TRỌNG, prod)
Không có `TZ` ở Dockerfile/render.yaml/code, không `SET TIME ZONE` cho phiên Postgres. Mọi "hôm nay" `new Date().toISOString().slice(0,10)` và `CURRENT_DATE` cho **NGÀY HÔM QUA trong khung 00:00–07:00 giờ VN** (7 tiếng/ngày). Lệch: ngày nhận/trả phòng, cọc, vi phạm, ngày điểm danh, phí gửi xe (`vehicles CURRENT_DATE`), cửa sổ HV tự trả phòng...
**Sửa 2 tầng:** (1) `TZ=Asia/Ho_Chi_Minh` trong `render.yaml` (tầng Node); (2) đặt timezone phiên DB (`pool.on('connect')` `SET TIME ZONE` trong `db.js` — sửa `CURRENT_DATE`/`now()::date`). Thiếu bước 2 thì `CURRENT_DATE` vẫn lệch.

### BLK-6 · Chưa có backup CSDL (NGHIÊM TRỌNG, prod — cần công ty)
Không có PITR / cron `pg_dump` / dấu vết backup Supabase. Một lệnh xoá nhầm là mất không hoàn tác.
**Sửa:** bật **Supabase PITR** (Dashboard, có thể cần nâng gói) + cron `pg_dump` hằng ngày đẩy ra chỗ khác + **test restore 1 lần trước 6/8**.

### BLK-7 · `ck_invoices_no_negative` KHÔNG áp ở boot-1 của DB trắng (xác nhận bởi 2 agent) — `schema.sql:412` vs `:475,:481`
Ràng buộc chống tiền/total âm tham chiếu cột `leader_discount`/`room_discount` được `ADD COLUMN` **SAU** khối `DO $ktx$` → DB mới boot lần đầu ràng buộc ném lỗi → **không có chốt chặn total âm suốt vòng đời boot đầu** (đúng ngày go-live / sau khôi phục backup). `badMoney` chỉ chặn từng phí <0, KHÔNG kiểm `total`. → có thể lưu `total = −50.000`.
**Sửa:** dời 2 `ADD COLUMN` lên trước khối `DO`; **và** thêm kiểm `total >= 0` trong `badMoney` (không phụ thuộc DB).

---

## 🟠 TRUNG BÌNH
- **M-1 · Máy trạng thái cọc** (`students.routes.js:572-637`): `deposit-settle` không kiểm `deposit_status` → hoàn cọc 2 lần / giữ cọc HV **đang ở** / tất toán khi chưa đóng cọc. Sửa: yêu cầu `held` + HV đã `out`; đã tất toán → 409.
- **M-2 · Check-out 2 lần** (`students.routes.js:433`): không guard "đã out" → `check_out_date` đổi nhưng `room_stays` giữ mốc cũ → tiền phòng vs tiền điện lệch số ngày. Sửa: chặn re-checkout.
- **M-3 · rate-limit chung IP NAT** (`index.js:51`): `authLimiter` 20 sai/15ph theo IP → cả KTX chung 1 IP → vài người gõ nhầm **khoá cả nhà đăng nhập**. `login-guard` per-account mới là rào thật. Sửa: key theo `ip+username` hoặc nâng max.
- **M-4 · Chèn HTML vào email nhà trường** (`mailer.js:94-114`): `name`/`note` không escape trước khi dựng HTML → vector phishing trong thư "từ KTX". Sửa: escape `&<>"`.
- **M-5 · Trùng biển số xe khi khai đồng thời** (`vehicles.routes.js:41` vs `schema.sql:395`): chuẩn hoá app khác unique index DB → 2 bản ghi 1 xe → **nhân đôi phí gửi xe**. Sửa: đưa cùng công thức chuẩn hoá vào unique index.
- **M-6 · Duyệt song song 2 đơn cùng SĐT (mã HV trống)** (`applications.routes.js`): dedup chạy ngoài transaction, không backstop DB (unique theo phone chưa có) → 2 student, thu tiền 2 lần. Sửa: partial unique index theo digits SĐT / advisory lock.
- **M-7 · Roster điện (room_stays) ≠ tập lập phiếu (students)** (`invoices.routes.js:122` vs `:141`): khi 2 nguồn desync (do BLK-1) → điện chia cho người không được lập phiếu → **thất thoát/lệch tổng phòng**. Sửa: cùng nguồn, hoặc assertion đối soát Σ sau generate. (Hệ quả của BLK-1.)

## ⚪ NHỎ (siết biên, làm cùng đợt)
- N-1 `reject` thiếu `deleted_at IS NULL`. N-2 approve không validate `contract_no`/`rental_type` enum/`room_id` kiểu số (room_id "abc" → 500). N-3 `check_in_date` nhận ngày phi lý (tương lai/trước ngày sinh). N-4 `/apply` vẫn nhận `rental_type='phong'`. N-5 `/apply` không kiểm `facility_id` tồn tại. N-6 `setLeader` không transaction (2 người cùng lúc → 500 thay vì 409). N-7 `POST /students` không `isValidGender` (gender rác vào DB). N-8 đăng ký xe cho HV đã `out`. N-9 `uses_parking` là cờ chết (staff bật/tắt vô tác dụng). N-10 `damage title/description` lưu thô → **kiểm frontend có escape không (nguy cơ stored-XSS)**. N-11 `badMoney` không có trần → `other_charge` khổng lồ → 500. N-12 ghim `jwt algorithms:['HS256']`. N-13 limiter riêng cho `/notify` mail. N-14 chốt ngưỡng `partialFactor` dùng `>=` hay `>` (biên tháng lẻ). N-15 phiếu nhập tay kwh↔charge lệch (chấp nhận theo thiết kế). N-16 CSP đang tắt (`index.js`) — mọi XSS thành chí mạng.

---

## Kế hoạch fix (đợt go-live)
1. **Nhóm 🔴 code** — BLK-7 (schema + badMoney), BLK-2 (gender phòng), BLK-4 (atomic reject/delete), BLK-3 (guard ngày lượt ở), BLK-1 (gộp `doCheckout()`), BLK-5 (TZ: render.yaml + db.js).
2. **Nhóm 🔴 cần công ty** — BLK-6 backup (bật Supabase PITR + cron pg_dump; test restore).
3. **Nhóm 🟠** — làm sau khi 🔴 xong.
4. Mỗi fix kèm test đối kháng; `npm test` phải PASS; chỉ deploy staging khi được đồng ý.
