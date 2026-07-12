# Báo cáo kiểm thử trước go-live — Quản lý Ký túc xá (Nội trú Esuhai)

- **Ngày kiểm thử:** 12–13/07/2026
- **Phiên bản kiến trúc:** một-cho-tất-cả — PostgreSQL + S3 object storage cho mọi môi trường (local dev = Postgres container + MinIO; staging/prod = Supabase Postgres + Supabase Storage).
- **Môi trường test:** local (`http://localhost:3000`), stack thật Postgres 16 + MinIO qua Docker, dữ liệu production đã migrate (240 học viên, 849 hóa đơn, 30 phòng, 81 xe, 7 ảnh giới thiệu).
- **Phương pháp:** 6 kỹ sư QA chạy song song theo 6 phân hệ (dữ liệu cô lập theo tiền tố, đồng thời là bài test chịu tải), cộng kiểm thử fail-fast/bảo mật và kiểm thử giao diện thủ công. Xác thực bằng cookie httpOnly. Mọi khẳng định kiểm chứng cả HTTP lẫn trạng thái DB/S3 thật.

## 1. Kết luận điều hành

**ĐẠT — sẵn sàng go-live** sau khi vá các lỗi phát hiện.

- **338 test case**, tỷ lệ đạt cuối cùng **100%** (sau khi vá + regression).
- Phát hiện **1 lỗi nghiêm trọng (mất dữ liệu)** — rò rỉ transaction ở endpoint duyệt đơn — đã vá và kiểm chứng lại. Đây là lỗi có thể gây mất ghi dữ liệu âm thầm trên production; việc test đã bắt được trước khi lên thật.
- Toàn bộ đường tiền (hóa đơn, điện, doanh thu): **không sai số tính toán**.
- Bảo mật: không rò rỉ mật khẩu/secret; xác thực cookie + RBAC đúng; ảnh CCCD riêng tư, có kiểm soát truy cập.

| Phân hệ | Số test | Đạt | Ghi chú |
|---|---:|---:|---|
| Auth / Phân quyền / Bảo mật | 47 | 47 | 3 khuyến nghị hardening (low/info) |
| Phòng / Xe / Tài sản / Cơ sở | 48 | 48 | 1 lỗi PUT-500 (đã vá) |
| Học viên + Ảnh CCCD (S3) | 40 + adversarial | 40 | 3 lỗi (đã vá 4/5, 1 chấp nhận) |
| Cài đặt / SMTP / Media / Admin / Public | 43 | 43 | 0 lỗi |
| Hóa đơn / Điện / Báo cáo (đường tiền) | 51 | 51 | 0 lỗi tính tiền |
| Vi phạm / Hỗ trợ / Đơn đăng ký | 86 | 82 → 86 | **1 lỗi nghiêm trọng (đã vá)** |
| Fail-fast cấu hình | 5 | 5 | app từ chối boot khi thiếu env |
| Giao diện (screenshot) | 6 màn | 6 | render đúng, ảnh proxy từ S3 |
| Regression sau vá | 18 | 18 | xác nhận mọi fix |

## 2. Lỗi phát hiện & xử lý

| # | Mức độ | Lỗi | Trạng thái | Cách vá |
|---|---|---|---|---|
| B1 | **NGHIÊM TRỌNG** (mất dữ liệu) | `POST /applications/:id/approve` và `POST /students` mở transaction (`BEGIN`) rồi `return` sớm khi validate mà không `ROLLBACK`. `client.release()` trả kết nối còn transaction dở về pool → request kế tiếp mượn đúng kết nối đó chạy trong transaction cũ: đọc dữ liệu cũ, **ghi bị mất âm thầm** (API trả 200 nhưng không lưu). Xác suất cao khi nhiều người dùng đồng thời. | **Đã vá + regression** | Chuyển toàn bộ validate ra **trước** `BEGIN`; dùng helper `withTransaction()` (bảo đảm ROLLBACK + release). Kiểm chứng: 12/12 ghi sau đường lỗi vẫn lưu đủ. |
| B2 | Trung bình (XSS) | `data:image/svg+xml` được nhận, lưu và proxy trả về `image/svg+xml`; SVG chứa `<script>` chạy trong phiên admin/khi xem ảnh. | **Đã vá** | `storage.parseDataUrl` chỉ nhận raster (jpg/png/webp/gif), từ chối SVG (trả 400). Thêm header `X-Content-Type-Options: nosniff` ở proxy ảnh. |
| B3 | Trung bình (PII) | Proxy CCCD vẫn phục vụ ảnh của học viên **đã xóa mềm** (thiếu lọc `deleted_at`). | **Đã vá** | Thêm `AND deleted_at IS NULL` vào truy vấn proxy CCCD → trả 404. |
| B4 | Thấp | `PUT /rooms\|/facilities\|/assets` với `name` rỗng → **500** (thiếu null-check mà POST có). | **Đã vá** | Thêm kiểm tra tên → trả **400** thông báo rõ. |
| B5 | Thấp | Error handler trung tâm trả `detail: err.message` (lộ thông tin nội bộ/SQL). | **Đã vá** | 4xx → trả message cho client; 5xx → "Lỗi máy chủ" chung, chi tiết chỉ log server. |
| B6 | Thấp | Giá trị CCCD lạ (không phải ảnh/không phải key) bị lưu thẳng thành "key" rác. | **Đã vá** | `resolveCccd` chỉ nhận data URL ảnh hợp lệ hoặc key `students/\|applications/`; giá trị lạ bị bỏ qua. |
| B7 | Thấp | `has_cccd` bỏ sót mặt sau (`cccd_back`). | **Đã vá** | Tính cả `cccd_back`. |

**Ghi chú quan trọng:** hai hiện tượng "đọc dữ liệu cũ ở lần chạy đầu, không lặp lại" mà QA-Hóa đơn và QA-Cài đặt báo cáo thực chất **cùng gốc là lỗi B1** (kết nối bị "nhiễm" transaction dở do agent khác gọi đường lỗi approve chạy song song). Sau khi vá B1, hiện tượng này biến mất.

## 3. Danh mục theo dõi (chấp nhận / hardening — không chặn go-live)

| Mục | Mức | Quyết định |
|---|---|---|
| Logout không thu hồi JWT phía server (token còn hạn 30 ngày vẫn dùng được đến khi hết hạn) | Low | Chấp nhận (đánh đổi của JWT stateless). Cân nhắc token-version denylist nếu cần thu hồi phiên. |
| `GET /api/settings` cho mọi vai trò đăng nhập đọc được cấu hình **không bí mật** (smtp_host, school_email, đơn giá) — secret (`smtp_pass`) đã bị ẩn | Info | Chấp nhận; cân nhắc giới hạn cho admin/staff nếu muốn. |
| `GET /api/rooms` học viên đọc được (không gate role) | Low | Có thể có chủ ý (HV xem phòng). Xác nhận lại. |
| Xóa mềm học viên **không** dọn object CCCD trên S3 (giữ để khôi phục) | Info | Đúng với mô hình soft-delete; cần script purge PII khi xóa vĩnh viễn (chưa có endpoint hard-delete). |
| Guard xóa phòng theo `students.status` còn lệch với occupancy tính theo ngày | Low | An toàn (nghiêng về bảo vệ dữ liệu); nên đồng bộ nguồn sự thật sau. |
| Enum lý do trả phòng ở `me.routes` khác chú thích schema (`normal/urgent_visa`) | Low | Cột TEXT tự do nên không lỗi chức năng; nên đồng bộ chú thích. |
| Badge YoY "▲1139%" ở Dashboard điều hành do 2025 chỉ có dữ liệu lẻ | Low (mỹ quan) | Tự chuẩn khi có đủ 1 năm liền trước; cân nhắc ẩn khi năm trước < ngưỡng. |

## 4. Danh mục test case chi tiết

### 4.1 Auth / Phân quyền / Bảo mật (47/47)
| # | Test case | Kỳ vọng | KQ |
|---|---|---|---|
| A1 | Đăng nhập đúng | 200, Set-Cookie `ktx_token` HttpOnly + SameSite=Lax, **không** có token trong body | ✅ |
| A2 | Sai mật khẩu / thiếu trường | 401 / 400; thông báo không lộ user tồn tại hay không | ✅ |
| A3 | `GET /auth/me` có/không cookie | 200 (thông tin user) / 401 | ✅ |
| A4 | Logout | 200, xóa cookie (Max-Age=0) | ✅ |
| A5 | Staff bị chặn admin-only (audit, users, PUT settings, revenue) | 403 | ✅ |
| A6 | Staff được phép nghiệp vụ (students, rooms, vehicles) | 200 | ✅ |
| A7 | Bắt buộc đổi mật khẩu: tài khoản do admin tạo `must_change_password=true` | true | ✅ |
| A8 | Đổi mật khẩu: <6 ký tự / trùng cũ / hợp lệ | 400 / 400 / 200 (xóa cờ) | ✅ |
| A9 | Học viên: `/me/*` được; `/students`, `/admin/*` bị chặn | 200 / 403 | ✅ |
| A10 | Tài khoản bị vô hiệu hóa (xóa mềm) đăng nhập | 401; DB còn dòng với deleted_at | ✅ |
| A11 | Truy cập không cookie các endpoint bảo vệ | 401 | ✅ |
| A12 | Admin không tự hạ quyền / tự xóa | 400 / 400 | ✅ |

### 4.2 Phòng / Xe / Tài sản / Cơ sở (48/48)
| # | Test case | Kỳ vọng | KQ |
|---|---|---|---|
| I1 | Cơ sở: tạo/sửa, đếm số phòng | 201; room_count đúng | ✅ |
| I2 | Phòng: tạo, **tầng tự suy từ tên** (305→3), sửa, occupancy=0 khi trống | đúng | ✅ |
| I3 | Xóa mềm phòng + `?deleted=1` + khôi phục | ẩn/hiện đúng, DB còn dòng | ✅ |
| I4 | Chặn xóa phòng đang có HV ở | 400; sau check-out xóa được | ✅ |
| I5 | Chặn xóa cơ sở còn phòng | 400; hết phòng xóa mềm được | ✅ |
| I6 | Xe: CRUD + xóa mềm; xe của HV đã xóa mềm bị ẩn | đúng | ✅ |
| I7 | Tài sản: CRUD + xóa mềm | đúng | ✅ |
| I8 | **Không hard-delete**: mọi entity sau DELETE còn dòng với deleted_at | đúng | ✅ |
| I9 | PUT tên rỗng (phòng/cơ sở/tài sản) | **400** (đã vá từ 500) | ✅ |

### 4.3 Học viên + Ảnh CCCD (S3) (40/40 + adversarial)
| # | Test case | Kỳ vọng | KQ |
|---|---|---|---|
| S1 | Tạo/sửa học viên | 201; sửa lưu bền | ✅ |
| S2 | Upload CCCD → DB lưu **S3 key** (`students/..`), không base64 | đúng | ✅ |
| S3 | `GET /students/:id` trả URL proxy `/api/students/:id/cccd/:side` | đúng | ✅ |
| S4 | Proxy CCCD trả ảnh (200, image/*) | đúng | ✅ |
| S5 | Thay ảnh dọn object cũ; xóa ảnh (rỗng) → cột null + proxy 404 | đúng | ✅ |
| S6 | Authz proxy CCCD: không cookie 401; HV khác 403; đúng HV/staff 200 | đúng | ✅ |
| S7 | Danh sách HV **không** trả base64 (chỉ `has_cccd`) | đúng | ✅ |
| S8 | Nghiệp vụ: check-in/out, chuyển phòng, cọc, tất toán, cấp tài khoản | đúng | ✅ |
| S9 | Xóa mềm + `?deleted=1` + khôi phục | đúng | ✅ |
| S10 | (adv) SVG CCCD | **từ chối 400**, không lưu (đã vá) | ✅ |
| S11 | (adv) CCCD của HV đã xóa mềm | proxy **404** (đã vá) | ✅ |
| S12 | (adv) giá trị CCCD rác | bỏ qua, không lưu key rác (đã vá) | ✅ |

### 4.4 Cài đặt / SMTP / Media / Admin / Public (43/43)
| # | Test case | Kỳ vọng | KQ |
|---|---|---|---|
| C1 | `GET /settings` không có `smtp_pass`, có `smtp_pass_set` | đúng | ✅ |
| C2 | PUT settings; PUT `smtp_pass:''` **không** xóa mật khẩu đã lưu | đúng | ✅ |
| C3 | `POST /settings/smtp/test` host sai | `{ok:false, reason}`, không 500, không treo (timeout 10s) | ✅ |
| C4 | Media: upload → S3 key, `data=NULL`; proxy `/public/image/:key` 200; xóa → 404 | đúng | ✅ |
| C5 | Audit: có bản ghi cho thao tác; `smtp_pass`/cccd bị che `***` | đúng | ✅ |
| C6 | Admin users: tạo/sửa/đặt-lại-MK/xóa mềm; ẩn khỏi danh sách | đúng | ✅ |
| C7 | Guard giữ ≥1 admin; chặn xóa admin | 400 | ✅ |
| C8 | Public `/info`, `/stats`, `/available-rooms` (không auth) | 200, shape hợp lệ | ✅ |

### 4.5 Hóa đơn / Điện / Báo cáo — đường tiền (51/51)
| # | Test case | Kỳ vọng | KQ |
|---|---|---|---|
| V1 | Điện bulk: kwh = số cuối − số đầu (số đầu = cuối kỳ trước); không âm | đúng (chặn âm) | ✅ |
| V2 | **Preview lập hóa đơn không ghi gì** vào DB | 0 dòng ghi | ✅ |
| V3 | Lập thật: tiền phòng, điện chia theo số người, tổng = tổng các khoản | số học chính xác | ✅ |
| V4 | Chạy lại **idempotent**: 0 tạo / cập nhật đúng, không trùng | đúng | ✅ |
| V5 | Hóa đơn **đã thu bị khóa** (skip), số tiền không đổi | đúng | ✅ |
| V6 | HV vào **giữa tháng** → tạo bù, proration theo số ngày | days_stayed đúng | ✅ |
| V7 | Tạo lẻ / tạo tay / trùng kỳ | 201 / 201 / 400 | ✅ |
| V8 | Xóa mềm + hồi sinh khi lập lại (không lỗi UNIQUE) | đúng | ✅ |
| V9 | Đánh dấu đã thu hàng loạt (bỏ qua dòng đã xóa) | đúng | ✅ |
| V10 | Doanh thu/năm **loại hóa đơn đã xóa**; danh sách năm | đúng | ✅ |

### 4.6 Vi phạm / Hỗ trợ / Đơn đăng ký (82→86/86)
| # | Test case | Kỳ vọng | KQ |
|---|---|---|---|
| R1 | Loại vi phạm: CRUD; "xóa" = deactivate (active=false), không hard-delete | đúng | ✅ |
| R2 | Ghi vi phạm: level tăng dần 1→2→3 | đúng | ✅ |
| R3 | Đủ ngưỡng (≥3): trả mail attempt; **SMTP chưa cấu hình → sent=false + reason, KHÔNG 500**; vi phạm vẫn lưu | đúng | ✅ |
| R4 | Gửi lại mail thủ công | không crash | ✅ |
| R5 | Thống kê vi phạm; xóa mềm → loại khỏi thống kê | đúng | ✅ |
| R6 | **Đơn đăng ký công khai: CCCD lưu S3 key** (`applications/..`), không base64 | đúng | ✅ |
| R7 | Duyệt đơn tạo học viên (mang theo key CCCD); từ chối; xóa mềm | đúng | ✅ |
| R8 | Báo hỏng / đơn trả phòng của học viên (confirm/reject) | đúng | ✅ |
| R9 | **(BUG B1) Rò transaction ở duyệt đơn** làm mất ghi các request sau | trước: 4 fail → **sau vá: đạt** | ✅ |

## 5. Test fail-fast cấu hình (5/5)
| # | Test | Kỳ vọng | KQ |
|---|---|---|---|
| F1 | Thiếu `DATABASE_URL` | `db.js` throw, app không boot | ✅ |
| F2 | Thiếu `S3_*` | `storage.js` throw | ✅ |
| F3 | Thiếu `JWT_SECRET` | `auth.js` throw | ✅ |
| F4 | `JWT_SECRET` < 16 ký tự | throw | ✅ |
| F5 | Đủ env | require OK, app boot | ✅ |

(Bootstrap admin cũng fail-fast nếu bảng users rỗng và thiếu/ngắn `ADMIN_PASSWORD`.)

## 6. Test giao diện (6/6 render đúng)
Chụp headless (đăng nhập cookie thật): **Dashboard** (KPI + hoạt động), **Học viên** (240 dòng, lọc, sort, thùng rác), **Cài đặt**, **Điều hành** (biểu đồ cột + donut SVG), **trang Giới thiệu công khai** — **7 ảnh giới thiệu tải qua proxy từ MinIO hiển thị đúng** trên trình duyệt thật (chứng minh toàn bộ đường ảnh base64→S3→proxy hoạt động). Không lỗi JS.

## 7. Regression sau khi vá (18/18)
Chạy lại toàn bộ đường lỗi đã vá: transaction leak (12/12 ghi bền sau approve-400/404), students dup-login không rò, SVG chặn 400, CCCD HV xóa mềm 404, PUT tên rỗng 400, has_cccd mặt sau, giá trị rác bị bỏ qua. **Tất cả đạt.**

## 8. Toàn vẹn dữ liệu
Sau toàn bộ kiểm thử + dọn dẹp: **240 học viên, 849 hóa đơn, 30 phòng, 7 ảnh trên S3** — khớp dữ liệu đã migrate, 0 dòng test còn sót.

## 9. Kết luận
Hệ thống **đạt điều kiện go-live** cho phase staging. Lỗi nghiêm trọng nhất (mất dữ liệu do rò transaction) đã được phát hiện nhờ test đồng thời và đã vá + kiểm chứng. Các mục trong "Danh mục theo dõi" là hardening/tùy chọn, không chặn phát hành. Khuyến nghị: theo dõi log ghi dữ liệu trong tuần đầu sau khi lên staging.
