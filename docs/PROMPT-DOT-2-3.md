# PROMPT ĐỢT 2 + 3 — sửa lỗi UI + dọn hard-code (app quản lý KTX)

> Dán vào AI trong VS Code. Vanilla JS, giữ phong cách + tiếng Việt hiện có. KHÔNG push, chỉ chạy local.
> Số dòng dưới đây là THAM KHẢO (code đã đổi sau Đợt 1) — hãy tìm theo TÊN HÀM/HÀNH VI, không tin cứng số dòng.
> Sau mỗi phần chạy test: bật server rồi `ADMIN_P=<mật khẩu admin>` + `node tests/run.js` phải PASS.
> Nguyên tắc chủ dự án: **không hard-code** — ngưỡng nghiệp vụ đưa vào `settings`, chỉnh không cần sửa code.

═══════════════════════════════════════════════════════════
## ĐỢT 2 — LỖI ĐÚNG/SAI & NHẤT QUÁN
═══════════════════════════════════════════════════════════

### 2.1 [Cao] Ô "Bảo trì" ở Dashboard đếm gộp nhầm cả feedback/vi phạm
`public/js/app.js` — trong `viewDashboard`, biến `pDmg` đang là `damage.filter(d => d.status!=='done')`,
gồm cả `category='violation'/'other'` (hộp thư hỗ trợ), nhưng nhãn là "Bảo trì" và bấm vào mở trang `repair`
(chỉ hiện `category='damage'`) → **số đếm > số dòng thực**.
→ Sửa: `pDmg = damage.filter(d => d.category === 'damage' && d.status !== 'done').length`
  (khớp với cách `updateNavBadges` đã làm đúng). Rà xem còn chỗ nào đếm damage mà quên lọc category.

### 2.2 [TB] "Check-out nhanh" lấy nhầm HV sắp vào
`public/js/app.js` — `quickPick` (và chỗ tương tự) lọc bằng `s.status === 'in'` (cột tĩnh trong DB),
trong khi toàn app dùng `isOccupying(s)`/`liveStatus(s)` (tính động theo ngày). HV "sắp vào" vẫn có
`status='in'` → lọt vào pool check-out nhanh.
→ Sửa: đổi điều kiện sang `isOccupying(s)`.

### 2.3 [Thấp] Đăng ký xe cho HV đã trả phòng
`server/routes/vehicles.routes.js` — POST đăng ký xe chỉ kiểm `deleted_at IS NULL`, không kiểm trạng thái.
→ Sửa: chặn đăng ký khi HV không còn ở (`status='out'` / không `isOccupying`) → 400 "Học viên đã trả phòng".

### 2.4 [TB] Gom công thức tính `total` (đang lặp 5 nơi → dễ lệch)
Công thức "Σ các phí + other − leader_discount − room_discount" lặp ở `billing.js`, `invoice-calc.js`,
`invoices.routes.js` (POST/PUT/generate).
→ Sửa: tạo 1 helper `invoiceTotal(fields)` trong `billing.js`, export và cho mọi nơi gọi chung.
  Giữ nguyên kết quả số (không đổi logic tiền) — chỉ gom về 1 nguồn. Chạy test đường tiền để chắc không lệch.

### 2.5 [TB] Drill-through KPI cho nhất quán
Quy ước: KPI **đơn nghĩa** → đặt `stuFilter` rồi đi thẳng danh sách; KPI **gộp nhiều nhóm** → mở modal.
- Ô "Bảo trì"/"Vi phạm" ở dashboard hiện chỉ `adminGo(page)` không đặt filter — chấp nhận nếu trang đó tự đủ ngữ cảnh, nhưng rà cho đồng bộ.
- Ở màn Điều hành (`viewExec`): số "hợp đồng" hiển thị gồm cả overdue + short-pending nhưng bấm chỉ lọc `'nocontract'` → ra tập con thiếu. Sửa cho khớp (mở `contractIssuesModal` hoặc lọc đúng tập đang đếm).

### 2.6 [Thấp] Dọn nhánh chết `urgent_visa` trong hoàn cọc
`server/billing.js` `depositRefundEligible` — nhánh `reason==='urgent_visa'` không bao giờ chạy (enum
`checkout_reason` không sinh giá trị này).
→ Sửa: hoặc thêm `urgent_visa` vào enum `CHECKOUT_REASONS` + UI (nếu nghiệp vụ cần), hoặc bỏ nhánh chết cho gọn. (Hỏi PM nếu chưa rõ chính sách.)

═══════════════════════════════════════════════════════════
## ĐỢT 3 — DỌN HARD-CODE (đưa ngưỡng vào Cài đặt)
═══════════════════════════════════════════════════════════

Cách làm CHUNG cho mỗi ngưỡng:
1. Thêm khoá + giá trị mặc định vào `server/db.js` (object `defaults` trong `seedDefaults`).
2. Cho **sửa được ở màn Cài đặt** (`viewSettings` trong app.js) — nhóm mới "Ngưỡng nhắc / nghiệp vụ".
3. Đọc giá trị từ `getSettings()` (backend) / `ST.settings` (frontend), KHÔNG viết thẳng số nữa.
4. Luôn có fallback số mặc định trong code (phòng khi setting rỗng/NaN).

### Danh sách ngưỡng cần đưa vào settings
| Khoá setting | Mặc định | Thay cho (hard-code hiện tại) |
|---|---|---|
| `overdue_remind_days` | `7` | mọi `stayDays(s) > 7` (nhắc ký HĐ, tạm trú, lập phiếu quá hạn) trong app.js — dùng chung 1 ngưỡng |
| `shortterm_max_days` | `60` | ranh giới ngắn/dài hạn trong `isShortTermGhep` (app.js ~420) |
| `deposit_notice_min_days` | `30` | `noticeDays >= 30` trong `billing.js` `depositRefundEligible` |
| `partial_half_factor` | `0.5` | hệ số phí tháng lẻ `0.5` trong `billing.js` `partialFactor` |
| `room_cap_A`..`room_cap_D` | `8,8,8,8` | `CAP_MAX` (rooms.routes.js) + `HANG_CAP` (app.js) — trần giường theo hạng |
| `checkout_max_future_days` | `365` | trần "ngày trả quá xa" trong `me.routes.js` |
| `max_cccd_mb` | `12` | giới hạn ảnh CCCD (app.js đang có 2 số 12 vs 6 lệch nhau → thống nhất 1) |

Lưu ý:
- `overdue_remind_days`: nếu sau này muốn tách riêng ngưỡng cho HĐ / tạm trú / phiếu thì thêm khoá riêng; giờ dùng chung cho gọn.
- `partial_half_min`/`partial_full_min` ĐÃ là settings sẵn — chỉ bổ sung `partial_half_factor`.
- Các trần upload phải ≤ giới hạn body parser (16MB ở index.js) — giữ ràng buộc đó.

### Gom hằng lặp (không phải settings, chỉ gom code)
- Danh sách VAI + chuỗi `IN ('admin','staff','maintenance')` lặp nhiều nơi (admin.routes.js) → gom 1 hằng `MANAGED_ROLES` dùng chung.
- Ngưỡng mật khẩu 6 (applications.routes.js) vs 8 (valid.js) không nhất quán → thống nhất 1 hằng (giữ cơ chế `must_change_password` cho tài khoản HV cấp nhanh nếu vẫn muốn cho 6).
- Danh sách `['departure','urgent_visa']` lặp ở nhiều nơi app.js → gom 1 hằng `DEPARTURE_REASONS`.
- (Nếu chưa làm ở Đợt 1) helper `todoRow` cho các modal residency/contract/deposit; helper dựng `<option>` cơ sở dùng chung.

═══════════════════════════════════════════════════════════
## KIỂM THỬ (bắt buộc trước khi coi là xong)
═══════════════════════════════════════════════════════════
- Bật server + `ADMIN_P=<mật khẩu admin> node tests/run.js` → PASS toàn bộ (hiện 280).
- Kiểm tay: đổi `overdue_remind_days` trong Cài đặt từ 7 → 5, xem các ô nhắc đổi theo (không cần sửa code).
- Kiểm ô "Bảo trì" ở dashboard = đúng số dòng trên trang bảo trì.
- Nếu thêm test cho helper `invoiceTotal` thì càng tốt.
