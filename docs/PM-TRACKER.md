# PM TRACKER — App Quản lý KTX Esuhai (TOÀN DỰ ÁN)

> Nguồn sự thật duy nhất về phạm vi, tiến độ, chất lượng & rủi ro của **toàn dự án**. Cập nhật lần cuối: 18/07/2026 (v80).
>
> **Cách vận hành (chốt 18/07):** PM = **giám sát & điều phối toàn dự án**, KHÔNG trực tiếp code (dev thực thi). Nhịp rà + cập nhật: **mỗi 2–3 ngày**. Rà kế tiếp: ~20–21/07.

## 0. Mục tiêu & phạm vi
- **Mục đích app:** quản lý toàn bộ vòng đời học viên nội trú (đăng ký → ở → trả phòng); lõi = tự động tính tiền phòng/điện + phiếu báo. Thay Excel/giấy. Định hướng: nhiều cơ sở.
- **GĐ1 — go-live trước 06/08/2026:** toàn bộ nghiệp vụ + **ĐA CƠ SỞ** (mỗi cơ sở 1 quản lý chỉ thấy cơ sở mình; HV chỉ thấy cơ sở của họ; chỉ **điều hành** thấy tổng).
- **GĐ2 (sau go-live):** tài chính KTX trong app (QR/phiếu thu/kế toán) — sếp đã đồng ý; code ở nhánh `feature/finance-qr`. Lộ trình chi tiết ở mục 8.
- **Ngoài phạm vi dev (giai đoạn staging):** hạ tầng/vận hành/pháp lý-lưu trữ → **system admin** lo khi lên prod. (Backup/PITR vẫn theo dõi như dependency phải xong trước 06/08.)

## 1. Bản đồ phân hệ & trạng thái (toàn dự án)
| Phân hệ | Trạng thái | Ghi chú PM |
|---|---|---|
| Quản lý học viên (hồ sơ, CCCD, check-in/out, chuyển phòng, cọc) | ✅ Có · lỗi lớn đã vá | chờ regression |
| Quản lý phòng & xe | ✅ Có | trùng biển số đã vá (M-5) |
| **Tiền phòng** (tự lập hóa đơn, điện chia đều, phiếu báo) | ✅ Có · **lõi vững** | được test kỹ nhất; npm test bao phủ đường tiền |
| Báo cáo & Dashboard điều hành | ✅ Có | ⚠️ cần rà lại khi có đa cơ sở (tổng vs theo cơ sở) |
| Quản lý vi phạm (cảnh báo email nhà trường) | ✅ Có | escape mail đã vá (M-4) |
| Trung tâm hỗ trợ (đăng ký, duyệt đơn, hỗ trợ) | ✅ Có | reject/delete nguyên tử đã vá (BLK-4) |
| Luồng bảo trì | ✅ Có | đường checkout bảo trì đã gộp về chung (BLK-1) |
| Cổng học viên (tự phục vụ) | ✅ Có | 🔴 **chưa cách ly theo cơ sở** |
| Trang công khai + đăng ký trực tuyến | ✅ Có | |
| Quản trị hệ thống (phân quyền, audit log, cấu hình) | ✅ Có | 🔴 **chưa có vai "điều hành" vs "quản lý cơ sở"** |
| **ĐA CƠ SỞ** (cách ly dữ liệu + phân quyền theo cơ sở) | 🟡 **Backend ~80% (bất ngờ đã tiến xa)** · Frontend 🔴 chưa | scope.js đúng, 10 route đã lọc; SÓT: logs, violations/stats + frontend chưa có bộ chọn cơ sở (xem review 18/07) |
| Tài chính QR/phiếu thu (GĐ2) | 📦 Hoãn có chủ đích | nhánh `feature/finance-qr`; chưa lên lịch |

## 2. Chất lượng theo chiều (cross-cutting)
| Chiều | Trạng thái | Ghi chú |
|---|---|---|
| Đúng nghiệp vụ | 🟢 Tốt | 7 blocker + 6 lỗi TB đã vá (#76/#77); `npm test` **256 PASS** |
| Bảo mật (mức app) | 🟠 Khá | còn CSP tắt + nghi stored-XSS frontend (N-10) |
| UI/UX | 🟠 Đang làm | mới chạy 10/40 case đối kháng, còn 30 |
| Dữ liệu / thời gian | 🟢 Ổn | TZ về giờ VN + chốt tiền âm đã sửa |
| Kiểm thử | 🟠 | unit/e2e 256 PASS; **UAT đa cơ sở chưa có** |
| Hiệu năng | 🟢 đủ 1 cơ sở | cần xem phân trang/lọc khi nhiều cơ sở |

## 3. Punch list go-live 06/08 (việc phải xong)
| # | Hạng mục | Ưu tiên | Trạng thái | Chủ |
|---|---|---|---|---|
| C | Đa cơ sở — nền (`users.facility_id` + `scope.js` + gán cơ sở tài khoản) | P0 | 🟢 Cơ bản xong | dev |
| D | Đa cơ sở — lọc truy vấn backend theo cơ sở | P0 | ✅ Đã vá `logs` + `violations/stats` (nghiệm thu 18/07) | dev |
| E | Đa cơ sở — frontend (bộ chọn cơ sở điều hành) + cách ly cổng HV | P0 | ✅ Có bộ chọn cơ sở (chỉ hiện cho điều hành) + badge + form đăng ký chọn cơ sở | dev |
| J | Vá race duyệt/từ chối đơn trả phòng + guard bảo trì trả phòng lặp | P0 | ✅ Xong — claim nguyên tử `WHERE status='pending'` + guard `checkout_confirmed_at` (nghiệm thu 18/07) | dev |
| K | Chính sách đa cơ sở (chị chốt 18/07): quản lý cơ sở = **staff gắn facility_id** (admin luôn = điều hành); cơ sở **chỉ xoá mềm**, chặn xoá khi còn tài khoản/phòng | P0 | ✅ Đã chốt → áp vào code | dev |
| F | Hardening: bật CSP, escape XSS (N-10), kiểm enum biên | P1 | 🟠 Còn tồn | dev |
| G | UI/UX 30 case còn lại | P2 | 🟠 Còn tồn | dev |
| H | Backup/PITR + test restore (BLK-6) | P0 | ⚙️ Chờ system admin/công ty | chị Hiền điều phối |
| I | UAT đa cơ sở + regression đường tiền | P0 | ⬜ Chưa tới | dev + PM nghiệm thu |

## 4. Kế hoạch theo tuần (tới 06/08)
- **Tuần 1 (18–25/07):** C + D cho 4 module lõi (students, rooms, invoices, applications) + gắn facility khi duyệt đơn. *Mốc:* quản lý cơ sở A không thấy dữ liệu cơ sở B.
- **Tuần 2 (26/07–01/08):** D các module còn lại (vehicles, violations, maintenance, reports) + E + F. *Mốc:* HV chỉ thấy cơ sở mình; điều hành thấy tổng; CSP bật.
- **Đệm (02–05/08):** I — UAT đa cơ sở (tạo cơ sở thứ 2, test đối kháng cách ly) + regression đường tiền; xác nhận H; đóng băng code.
- **06/08:** Go-live GĐ1.

## 5. Sổ rủi ro (toàn dự án)
| Mã | Rủi ro | Mức | Giảm thiểu |
|---|---|---|---|
| R1 | Đa cơ sở chưa khởi động, đụng mọi truy vấn, ~18 ngày | 🔴 Cao | Khởi động đầu tuần 1; dev cam kết ước lượng; không thêm việc ngoài phạm vi |
| R2 | Regression đường tiền sau refactor checkout (#76) | 🟠 TB | Test đường tiền trong UAT; giữ npm test xanh mỗi commit |
| R3 | Backup phụ thuộc công ty/IT + nâng gói Supabase | 🟠 TB | Chị Hiền escalate NGAY |
| R4 | CSP tắt + nghi stored-XSS frontend | 🟠 TB | Hạng mục F tuần 2 |
| R5 | autoDeploy: `git push` = lên staging thẳng, không cổng chặn | 🟢 Thấp | Chỉ push khi npm test PASS + được đồng ý |
| R6 | Lệch giữa "báo cáo BA" và thực trạng (BA-DOCUMENT nói "100%/đạt chuẩn" trong khi còn tồn) | 🟠 TB | PM giữ tracker này là nguồn thật; yêu cầu BA ghi trung thực phần còn tồn |
| R7 | GĐ2 tài chính chưa có phạm vi/mốc rõ | 🟢 Thấp | Lên khung GĐ2 sau khi GĐ1 ổn |

## 6. Câu hỏi cần dev/BA trả lời
1. (dev) Đa cơ sở (C+D+E) ước lượng bao nhiêu ngày công? Có kịp 06/08 không?
2. (dev) Có cần cắt bớt/hoãn hạng mục nào ở GĐ1 để đủ thời gian cho đa cơ sở không?
3. (dev + chị) Ai nghiệm thu UAT đa cơ sở, ngày nào?
4. (BA) Cập nhật `BA-DOCUMENT.md` phần trạng thái cho trung thực (còn tồn đọng), khớp tracker này.

## 6b. Điều chỉnh nghiệp vụ chờ áp (chị Hiền chốt 18/07 — làm ở VS Code)
| # | Nội dung | Trạng thái |
|---|---|---|
| BR-1 | Ô KPI "HV chưa lập phiếu tháng này" phải drill-through ra đúng danh sách HV (đang rơi về màn tổng) | ⬜ Chờ áp |
| BR-2 | Gộp modal "Hợp đồng chưa hoàn thiện" còn 2 nhóm: "HĐ dài hạn chưa ký" (gộp 36+34, cùng loại) + "HĐ ngắn hạn chưa ký (phiếu bàn giao)" | ⬜ Chờ áp |
| BR-3 | Nhắc TÁCH RIÊNG "Nhận phòng >7 ngày chưa lập phiếu" (mốc 7 ngày từ ngày nhận phòng). KHÔNG quản đã thu/chưa thu — app chỉ quản TẠO phiếu | ⬜ Chờ áp |
| BR-4 | Báo động "Đã ký HĐ dài hạn nhưng chưa có cọc" (bất biến: ký HĐ dài hạn → bắt buộc có cọc) | ⬜ Chờ áp |

Ghi chú nghiệp vụ đã xác nhận: phí HV vào 15/7 (tháng 31 ngày) = **17 ngày ở, thu phí cố định 100%** (>15 ngày). Mốc nhắc ký HĐ + lập phiếu = **7 ngày kể từ ngày nhận phòng**.

## 8. Lộ trình phát triển (chị Hiền trình bày 18/07)
**GĐ1 — như hiện tại** (go-live 06/08): quản lý vòng đời HV + tính tiền phòng/điện + phiếu báo + đa cơ sở. App chỉ quản TẠO phiếu, không quản đã thu.

**GĐ2 — sau go-live**, gồm 3 nhóm:
- **A. Thu tiền (QR + ngân hàng):** tạo lệnh thu + xuất QR cho HV thanh toán · đối soát lệnh thu với ngân hàng **tự động** · cảnh báo lệnh thu **quá hạn chưa thanh toán**.
- **B. Kế toán Bravo:** xây mã sản phẩm khớp Bravo (đã có setting `bravo_*`) · hàng tháng gửi báo cáo doanh thu về **sổ cái Bravo** — ⚠️ *phương án nhận chưa chốt*.
- **C. Tích hợp Bitrix:** API lấy thông tin HV chính xác · API lấy HV **sắp chuyển lên chi nhánh HCM** để chuẩn bị phòng trước.

**Quyết định/phụ thuộc GĐ2 còn mở (PM theo dõi):** (1) phương án nhận báo cáo Bravo; (2) ngân hàng nào + có API đối soát tự động không; (3) quyền + ánh xạ trường dữ liệu Bitrix; (4) cổng/chuẩn QR (VietQR?).

## 7. Nhật ký cập nhật
- **18/07/2026 (tối, muộn):** Nghiệm thu Đợt 1 — **ĐẠT toàn bộ**. Đọc code: 8/8 mục đúng (race trả phòng nguyên tử, guard bảo trì, lọc cơ sở logs + violations/stats, admin luôn điều hành ở POST/PUT, cơ sở chặn xoá khi còn tài khoản + FK RESTRICT migrate đúng trong khối DO, frontend bộ chọn cơ sở, /me trả facility_id) + người làm viết thêm 2 file test. **Chạy full test (PM tự bật server + set `ADMIN_P`): `node tests/run.js` → 280/280 PASS** (76 unit + e2e gồm Đợt-1 & đa-cơ-sở acceptance a–f). ⇒ **Đợt 1 HOÀN TẤT.**
- **18/07/2026 (tối):** Ghi lộ trình GĐ1→GĐ2 (mục 8) + chốt 2 chính sách đa cơ sở (mục K). Chị chọn: quản lý cơ sở = staff gắn facility_id; cơ sở chỉ xoá mềm.
- **18/07/2026 (tối):** Review toàn bộ code bằng 5 luồng → `docs/REVIEW-TONG-THE-2026-07-18.md`. Phát hiện lớn: **đa cơ sở backend đã ~80%** (không phải "chưa bắt đầu"); vá 1 lỗi boot do PM tự gây (index deleted_at); còn race checkout_requests + rò cơ sở (logs, violations/stats) + frontend đa cơ sở chưa làm + nợ hard-code. Cập nhật mục 1/3.
- **18/07/2026 (chiều):** Chốt 4 điều chỉnh nghiệp vụ BR-1..4 (xem mục 6b) + xác nhận quy tắc phí tháng lẻ cho ca vào 15/7. Đưa vào prompt cho VS Code.
- **18/07/2026:** Lập tracker toàn dự án. Rà v80: nghiệp vụ đã vá (#76/#77, 256 PASS); mọi phân hệ chức năng đã có; **rủi ro số 1 = đa cơ sở chưa bắt đầu** (bằng chứng: `users` chưa có `facility_id` — schema.sql:98; vai trò chỉ admin/staff/maintenance — admin.routes.js:89; lọc cơ sở là dropdown thủ công — students.routes.js:125). Thiết lập tác vụ tự rà mỗi 2 ngày.
