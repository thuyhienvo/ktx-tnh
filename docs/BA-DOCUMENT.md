# Tài liệu Nghiệp vụ (BA) — Hệ thống Quản lý Khu Nội trú Esuhai

> Tài liệu dành cho lãnh đạo & người dùng nghiệp vụ: hệ thống làm được gì, cho ai, và mang lại giá trị gì.

## 1. Hệ thống là gì?

Phần mềm web quản lý **toàn bộ vòng đời** của một khu nội trú/ký túc xá học viên — từ lúc học viên **đăng ký vào ở**, **sinh hoạt** (đóng tiền, báo hỏng, vi phạm), đến khi **trả phòng**. Thay cho việc quản lý rời rạc trên Excel/giấy, hệ thống tập trung mọi khâu vào một nơi, tự động hoá tính tiền và phân quyền rõ ràng cho từng bộ phận.

Có thể **cài như ứng dụng trên điện thoại** (PWA) và dùng trên máy tính.

## 2. Ai dùng — và thấy gì?

| Vai trò | Dùng để làm gì |
|---|---|
| **Quản trị viên** | Toàn quyền: điều hành, báo cáo doanh thu, cấu hình, quản lý tài khoản |
| **Nhân viên quản lý** | Nghiệp vụ hằng ngày: học viên, phòng, xe, check-in/out, tiền phòng, hỗ trợ |
| **Bảo trì** | Nhận và xử lý các việc sửa chữa được chuyển tới |
| **Học viên** | Cổng riêng: xem hóa đơn, vi phạm, gửi yêu cầu hỗ trợ, xin trả phòng |

Mỗi vai trò chỉ thấy đúng phần việc của mình — dữ liệu và thao tác được phân quyền chặt chẽ.

## 3. Hệ thống làm được gì (theo phân hệ)

### 3.1 Quản lý học viên
- Hồ sơ đầy đủ: thông tin cá nhân, lớp, **ảnh CCCD** (lưu an toàn), hợp đồng, tình trạng tạm trú, tiền cọc.
- **Check-in / Check-out**, **chuyển phòng**, ghi nhận **đặt cọc / hoàn cọc** (tự xét điều kiện hoàn cọc theo ngày báo trước).
- Lọc/sắp xếp nhanh theo trạng thái (đang ở, sắp vào, sắp trả, đã trả), chưa tạm trú, chưa đóng cọc, hợp đồng chưa ký...
- **Xóa mềm** — không mất dữ liệu, khôi phục được.

### 3.2 Quản lý phòng & xe
- Danh sách phòng theo tầng/hạng/giới tính, **hiển thị số người đang ở / giường trống** theo thời gian thực.
- Quản lý xe học viên gửi (biển số, mã dán xe).

### 3.3 Tiền phòng — tự động hoá
- **Tự lập hóa đơn cả kỳ** chỉ với một thao tác: tính tiền phòng (chia theo ngày ở thực tế), **tiền điện chia đều theo số người trong phòng**, nước, dịch vụ, máy giặt, gửi xe.
- **Xem trước** trước khi chốt; **chạy lại bao nhiêu lần cũng được** (không tạo trùng): học viên vào giữa tháng tự được tạo bù, hóa đơn đã thu được khóa.
- Đánh dấu đã thu, xuất **phiếu báo tiền phòng**, đối chiếu mã sản phẩm Bravo.

### 3.4 Báo cáo & Dashboard điều hành
- **Bảng điều hành cho lãnh đạo**: tỉ lệ lấp đầy, tỉ lệ thu, doanh thu năm — kèm **biểu đồ** (cột theo tháng, cơ cấu doanh thu, cơ cấu học viên).
- Báo cáo **doanh thu theo tháng/năm**, thống kê học viên xuất cảnh.

### 3.5 Quản lý vi phạm
- Ghi nhận vi phạm theo từng học viên (danh mục vi phạm tùy chỉnh, mức độ).
- **Đến ngưỡng (mặc định 3 lần) tự động cảnh báo & gửi email cho nhà trường**.
- Thống kê vi phạm theo học viên/loại/tháng.

### 3.6 Trung tâm hỗ trợ (một cửa)
- **Đăng ký ở nội trú**: học viên tự đăng ký ở trang công khai, hoặc nhân viên tạo đơn hộ → **duyệt đơn để tạo học viên** (quy trình một cửa, có lưu vết).
- **Hỗ trợ học viên** — 3 đầu mục: *báo hư hỏng trong phòng*, *báo cáo vi phạm*, *khác (cần hỗ trợ)*.
- **Đăng ký trả phòng**: học viên gửi đơn → quản lý duyệt → tự động check-out & tính lại hóa đơn.

### 3.7 Luồng Bảo trì
- Với báo **hư hỏng phòng**: quản lý bấm **"Duyệt & chuyển bảo trì"**.
- **Bộ phận bảo trì đăng nhập → nhận thông báo "X công việc cần xử lý"**, thấy danh sách việc (phòng, nội dung, người báo, SĐT).
- Bảo trì cập nhật: *Bắt đầu xử lý* → *Đã xử lý xong* (ghi rõ đã làm gì) hoặc *Chưa xử lý được* (ghi **lý do**, VD chờ linh kiện).
- Quản lý & học viên **thấy được tiến độ và lý do**.

### 3.8 Cổng học viên (tự phục vụ)
- Xem phòng, **hóa đơn/công nợ**, tình trạng cọc, **nhắc nhở vi phạm** của mình.
- **Gửi yêu cầu hỗ trợ** (hư hỏng/vi phạm/khác) và **xin trả phòng** ngay trên app.

### 3.9 Trang giới thiệu & đăng ký công khai
- Trang công khai cho học viên tiềm năng: hình ảnh khu nội trú/phòng/tiện ích, **bảng giá**, phòng còn trống, và form **đăng ký nội trú** trực tuyến. Quản trị **tự chỉnh nội dung & ảnh** không cần lập trình.

### 3.10 Quản trị hệ thống
- **Phân quyền** 4 vai trò; quản lý tài khoản nhân viên/bảo trì.
- **Nhật ký hệ thống (audit log)**: ghi lại mọi thao tác thêm/sửa/xóa — ai làm, khi nào (tự ẩn thông tin nhạy cảm).
- Cấu hình đơn giá, email SMTP, nội dung trang giới thiệu.

## 4. Quy trình nghiệp vụ chính

**A. Học viên vào ở:** Đăng ký (HV tự điền / NV tạo hộ) → Quản lý duyệt đơn → Tạo học viên & xếp phòng → (tùy chọn) cấp tài khoản đăng nhập cho HV.

**B. Thu tiền hằng tháng:** Nhập chỉ số điện → Lập hóa đơn cả kỳ (tự tính) → Gửi phiếu báo → Đánh dấu đã thu → Doanh thu tự cập nhật lên dashboard.

**C. Sửa chữa hư hỏng:** HV báo hư hỏng → Quản lý chuyển bảo trì → Bảo trì xử lý & ghi kết quả → HV/Quản lý thấy trạng thái.

**D. Trả phòng:** HV gửi đơn trả phòng → Quản lý duyệt → Tự check-out, xét hoàn cọc, tính lại hóa đơn kỳ cuối.

## 5. Giá trị mang lại

- **Tiết kiệm thời gian**: tự động tính tiền phòng/điện thay vì tính tay trên Excel; lập hóa đơn cả trăm học viên trong vài giây.
- **Minh bạch & không mất dữ liệu**: mọi thao tác có nhật ký; xóa mềm (khôi phục được); phân quyền rõ ràng.
- **Chuyên nghiệp với học viên**: cổng tự phục vụ, trang đăng ký trực tuyến, phản hồi hỗ trợ có tiến độ.
- **Kiểm soát cho lãnh đạo**: dashboard KPI + biểu đồ, báo cáo doanh thu, cảnh báo vi phạm tự động về nhà trường.
- **Phối hợp giữa các bộ phận**: quản lý ↔ bảo trì ↔ học viên liên thông trên một hệ thống.

## 6. Trạng thái triển khai

- Đã hoàn thiện các phân hệ trên và **kiểm thử pre-go-live** (338 test case, đạt 100% sau khi vá).
- Đang chạy môi trường **staging** (bản demo) với dữ liệu mẫu đầy đủ cho mọi phân hệ.
- Bảo mật đạt chuẩn cho giai đoạn dev/staging; thông tin cá nhân trong bản demo đã được **ẩn danh** theo quy định bảo vệ dữ liệu cá nhân.
