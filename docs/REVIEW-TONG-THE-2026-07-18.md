# REVIEW TOÀN BỘ CODE + HƯỚNG GIẢI QUYẾT — 18/07/2026

> Rà bằng 5 luồng song song trên code hiện tại (lõi tính tiền · auth/đa cơ sở · module còn lại · frontend · schema/config).
> Lăng kính: logic đúng/sai · code cứng khó chỉnh · sẵn sàng đa cơ sở · nhất quán. Đã loại các lỗi đã vá (#64–#77).

## Kết luận 1 dòng
Code **về cơ bản khỏe** — lõi tính tiền + auth vững, đa cơ sở đã áp được ~80% ở backend. Rủi ro còn lại KHÔNG phải sai số tiền, mà là: **vài chỗ race chưa nguyên tử · vài chỗ rò dữ liệu chéo cơ sở · frontend đa cơ sở chưa làm · và nợ hard-code trái nguyên tắc "dễ chỉnh"**.

---

## 🔴 ĐỢT 1 — CHẶN PHÁT HÀNH (làm ngay)

| # | Vấn đề | Vị trí | Hướng xử lý |
|---|---|---|---|
| 1 | ✅ **ĐÃ VÁ** — index `deleted_at` đứng trước cột → DB trắng không boot | schema.sql:91,123 | Đã bỏ mệnh đề `WHERE deleted_at` (18/07) |
| 2 | **Duyệt/từ chối đơn trả phòng KHÔNG nguyên tử** → check-out chạy 2 lần, dời ngày 2 lần | requests.routes.js:108-188 | `UPDATE ... WHERE id=$1 AND status='pending' RETURNING id` + kiểm rowCount→409; bọc transaction (theo mẫu BLK-4 của applications) |
| 3 | **Bảo trì xác nhận trả phòng lặp lại được** (thiếu guard "đã trả") | maintenance.routes.js:82-113 | Chặn khi `checkout_confirmed_at IS NOT NULL` như guard checkin |
| 4 | **Rò dữ liệu chéo cơ sở — nhật ký ra/vào** không lọc cơ sở | logs.routes.js:9-38 | Thêm `applyFacilityFilter(req,'s.facility_id',...)` |
| 5 | **Rò dữ liệu chéo cơ sở — thống kê vi phạm** (byStudent kèm tên/phòng) | violations.routes.js:107-133 | Áp `facilityScope` vào các truy vấn `/stats` |
| 6 | **Đa cơ sở ở FRONTEND chưa làm** — không có bộ chọn cơ sở cho điều hành; KPI/bảng gộp mọi cơ sở | app.js:500-505, .top | Thêm dropdown cơ sở chỉ cho `role==='admin'` (ẩn với staff), lưu `ST.facilityFilter`, áp vào rooms/students/KPI |
| 7 | Rà 9 route đã import scope (students, rooms, invoices, electric, vehicles, violations, requests, maintenance, reports) xem đã gọi filter ở MỌI handler đọc + `assertFacility` ở mọi ghi `:id` chưa | — | Kiểm từng handler |

### 2 quyết định CHÍNH SÁCH chị cần chốt (chặn thiết kế đa cơ sở)
- **A. Admin có bị bó theo cơ sở không?** Hiện code cho gán facility_id cho cả role=admin, NHƯNG admin vẫn sửa được tài khoản mọi cơ sở và tự cấp admin điều hành → "admin cơ sở" leo thang lên toàn hệ. → **Khuyến nghị: admin LUÔN = điều hành (không bó cơ sở); muốn giới hạn cơ sở thì dùng role=staff.**
- **B. Xoá cơ sở thì sao?** FK `users.facility_id ON DELETE SET NULL` → xoá cứng cơ sở làm quản lý cơ sở đó tự thành điều hành (thấy tất cả). → **Khuyến nghị: đổi `ON DELETE RESTRICT` + chỉ cho xoá mềm cơ sở.**

---

## 🟠 ĐỢT 2 — LỖI ĐÚNG/SAI & NHẤT QUÁN (nên vá trước go-live)

| Vấn đề | Vị trí | Hướng xử lý |
|---|---|---|
| Ô "Bảo trì" ở Dashboard đếm gộp cả feedback/vi phạm → số > số dòng thực trên trang | app.js:825 | Thêm `.filter(category==='damage')` như `updateNavBadges` đã làm |
| "Check-out nhanh" dùng `status==='in'` (cột tĩnh) thay vì `isOccupying()` → HV sắp vào lọt vào pool | app.js:2259,1390 | Dùng `isOccupying(s)` |
| Đăng ký xe cho HV đã `out` → phát sinh phí xe cho người đã đi | vehicles.routes.js:49-79 | Kiểm `status`/đang ở trước khi cho đăng ký |
| Công thức `total` lặp 5 nơi → dễ lệch khi thêm khoản | billing.js, invoice-calc.js, invoices.routes.js:233/294/388 | Gom 1 helper `invoiceTotal()` dùng chung |
| Drill-through KPI mỗi nơi một kiểu (có ô lọc thẳng, có ô về màn tổng) | app.js: Bảo trì 854, Vi phạm 859, exec 743 | Quy ước: KPI đơn nghĩa→lọc thẳng; KPI gộp→modal |
| Nhánh `urgent_visa` chết trong hoàn cọc (enum không sinh ra) | billing.js:238-244 | Thêm `urgent_visa` vào enum + UI, hoặc bỏ nhánh chết |

---

## 🟡 ĐỢT 3 — DỌN HARD-CODE (nguyên tắc "code dễ chỉnh" chị chốt)

**Đưa các ngưỡng nghiệp vụ vào `settings` (chỉnh không cần sửa code):**
| Ngưỡng đang cứng | Vị trí | Setting đề xuất |
|---|---|---|
| "7 ngày" quá hạn ký HĐ / tạm trú (lặp 5+ nơi) | app.js:429,700,755,814,1045 | `contract_overdue_days`, `resi_overdue_days` (mặc định 7) |
| "60 ngày" ranh giới ngắn/dài hạn (cần HĐ hay phiếu bàn giao) | app.js:420-421 | `shortterm_max_days` (mặc định 60) |
| "30 ngày" báo trước mới được hoàn cọc | billing.js:243 | `deposit_notice_min_days` (mặc định 30) |
| Hệ số 0.5 phí tháng lẻ | billing.js:45 | `partial_half_factor` (mặc định 0.5) |
| Trần giường theo hạng `CAP_MAX{A..D:8}` / `HANG_CAP{A:5..}` | rooms.routes.js:14, app.js:352 | `room_cap_A..D` |
| Giới hạn ảnh CCCD 2 số khác nhau (12MB vs 6MB) | app.js:191 vs 1124 | 1 hằng `MAX_CCCD_MB` |
| Trần "ngày trả quá xa" (1 năm) | me.routes.js:179 | `checkout_max_future_days` |
| Danh sách VAI + chuỗi `IN ('admin','staff','maintenance')` lặp chục chỗ | admin.routes.js:89,97,145... | Gom 1 module hằng vai |
| Ngưỡng mật khẩu 6 vs 8 không nhất quán | valid.js:80 vs applications.routes.js:130 | Thống nhất 1 hằng |

---

## 🟢 ĐỢT 4 — NỢ KỸ THUẬT (sau go-live / GĐ2)

- **Tách `app.js`** (3662 dòng/292KB, tải đồng bộ chặn render) thành nhiều file theo `view*`: core / students / rooms-services / invoices-electric / requests / exec-dashboard / settings-admin / public. Nhân tiện gom helper trùng (row, facility option, enum, daysInMonth, prevMonth).
- **Bổ sung FK + CHECK enum** (bọc trong khối `DO`/schema_guard vì dữ liệu cũ có thể vi phạm): FK `logs/invoices/damage_reports.room_id`, `applications.facility_id`; CHECK enum cho `status/role/*_status/severity`; `ck_vehicles_dates`; index cho cột lọc (`invoices.status`, `applications.status`...).
- **Đa cơ sở "thật" — cấu hình theo cơ sở:** hiện `settings`/`assets`/`violation_types` là GLOBAL, cơ sở 2 khác giá/khác danh mục thì chưa cấu hình riêng được. Thêm `facility_id` nullable (NULL=mặc định toàn hệ) hoặc bảng `facility_settings` phủ đè. → cần khi thực sự có cơ sở khác bảng giá.
- `db.js:68` chạy schema như 1 giao dịch → 1 statement lỗi là sập boot; cân nhắc chạy tách statement để lỗi phi-critical không giết boot.

---

## Nhận định sức khỏe từng mảng
- **Tính tiền:** 🟢 vững, đơn giá/hệ số đã ở settings, chia điện chính xác. Chỉ nợ hard-code ngưỡng 30 ngày + gom `total`.
- **Auth/bảo mật:** 🟢 vững (thu hồi vé, đọc role/facility mỗi request, chống dò mật khẩu). Cần chốt 2 chính sách admin/FK.
- **Đa cơ sở (backend):** 🟡 ~80% — `scope.js` đúng, `applications` là hình mẫu; sót `logs`, `violations/stats`; cần rà đủ handler.
- **Đa cơ sở (frontend):** 🔴 chưa làm — thiếu bộ chọn cơ sở.
- **Module nghiệp vụ:** 🟡 tốt, còn race checkout_requests + guard bảo trì.
- **Schema:** 🟢 trưởng thành, còn FK/CHECK enum là nợ mức thấp.
- **Frontend:** 🟡 nhiều xử lý tinh tế, nhưng file quá lớn + hard-code ngưỡng + drill-through chưa nhất quán.
