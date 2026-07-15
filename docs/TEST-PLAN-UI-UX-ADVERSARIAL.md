# BỘ TEST UI/UX ĐỐI KHÁNG — App Quản lý KTX

> Khác với bộ test nghiệp vụ (`TEST-PLAN-ADVERSARIAL.md`): bộ này **tấn công trải nghiệm người dùng**, không phải logic.
> Mục tiêu: tìm chỗ làm người dùng **bối rối, mất dữ liệu, bấm nhầm, kẹt luồng, hiểu sai, hoặc vỡ giao diện**.
> Mỗi case ghi **KẾT QUẢ ĐÚNG** (trải nghiệm tốt phải là gì) và **NGHI NGỜ** (dự đoán app sẽ làm sai). Lệch nhau = lỗi UX.

**Ai dùng app này (bối cảnh để test cho đúng người):**
- **Admin/Staff** — trên máy tính, nhập liệu nhiều, thao tác nhanh, hay double-click, hay mở nhiều tab.
- **Học viên** — trên **điện thoại Android đời thấp, mạng yếu**, cài PWA, ít rành công nghệ.
- **Bảo trì** — trên điện thoại, ngoài hiện trường.

**Công cụ:** trình duyệt + DevTools (Device Toolbar để giả lập điện thoại, tab Network để giả lập mạng chậm/offline, tab Lighthouse để chấm accessibility). Test cả **chuột lẫn bàn phím**, cả **màn rộng lẫn màn hẹp 360px**.

**Nguyên tắc đối kháng:** đừng thao tác như người thiết kế mong đợi. Hãy **bấm 2 lần, bỏ dở giữa chừng, bấm Back, refresh giữa form, xoay ngang điện thoại, dán văn bản dài, để trống, nhập sai rồi sửa**.

---

## NHÓM 1 — MẤT DỮ LIỆU KHI NHẬP LIỆU (nặng nhất về UX)

### UX-01 · Bỏ dở form rồi bấm Back / đổi menu
- **Bước:** mở form thêm học viên, điền 15 trường, chưa lưu. Bấm menu khác hoặc nút Back của trình duyệt.
- **Đúng:** cảnh báo "Bạn có dữ liệu chưa lưu, rời đi?" trước khi mất.
- **Nghi ngờ:** **mất sạch không hỏi**. Nhập lại từ đầu. Với form 15 trường trên điện thoại, đây là lỗi làm người dùng bỏ cuộc.

### UX-02 · Refresh giữa chừng
- **Bước:** điền nửa form, nhấn F5 (hoặc kéo refresh trên điện thoại).
- **Nghi ngờ:** mất hết, không có bản nháp tự lưu.

### UX-03 · Double-click nút Lưu
- **Bước:** điền form, bấm "Lưu" **2 lần thật nhanh** (thói quen của người dùng khi mạng chậm tưởng chưa ăn).
- **Đúng:** nút khóa lại sau cú bấm đầu, chỉ tạo 1 bản ghi.
- **Nghi ngờ:** tạo **2 học viên trùng nhau**, hoặc gửi 2 request. Kiểm tra nút có chuyển trạng thái "đang lưu…" và disable không.

### UX-04 · Mạng chậm — không biết đang xử lý
- **Bước:** DevTools → Network → Slow 3G. Bấm Lưu, hoặc mở một danh sách lớn.
- **Đúng:** có spinner / "đang tải…" / skeleton ngay lập tức.
- **Nghi ngờ:** màn hình **đứng im không phản hồi** vài giây → người dùng tưởng treo, bấm lại lung tung. Kiểm tra mọi nút và mọi lần chuyển màn có báo hiệu đang xử lý không.

### UX-05 · Ngày sinh sai bị nuốt không báo
- **Bước:** ở form đăng ký, nhập ngày sinh không hợp lệ (tương lai, hoặc 31/02). Gửi.
- **Đúng:** ô ngày sinh **viền đỏ + dòng chữ giải thích ngay dưới ô**.
- **Nghi ngờ:** đơn gửi thành công, ngày sinh **âm thầm thành trống**. Người dùng không hề biết mình vừa mất dữ liệu. (Đây vừa là lỗi nghiệp vụ vừa là lỗi UX nghiêm trọng — không có phản hồi.)

### UX-06 · Thông báo lỗi chung chung
- **Bước:** cố ý gây lỗi lưu (bỏ trống tên, hoặc trùng username). Đọc kỹ dòng báo lỗi.
- **Đúng:** báo **đúng ô nào sai và sai vì sao**, bằng tiếng Việt dễ hiểu.
- **Nghi ngờ:** chỉ hiện toast đỏ mơ hồ kiểu "Có lỗi xảy ra" / "Error 400", **không chỉ ra ô nào**, không cuộn tới ô đó. Người dùng phải tự dò.

---

## NHÓM 2 — HÀNH ĐỘNG NGUY HIỂM KHÔNG CÓ PHANH

### UX-07 · Xóa mà không xác nhận / không hoàn tác
- **Bước:** bấm nút xóa học viên, xóa phòng, xóa hóa đơn.
- **Đúng:** hộp xác nhận nêu rõ hậu quả ("Xóa học viên Nguyễn Văn A và toàn bộ hóa đơn liên quan?"), và tốt nhất có "Hoàn tác" sau khi xóa.
- **Nghi ngờ:** xóa ngay, hoặc xác nhận chỉ hỏi "Bạn chắc chứ?" trống rỗng không nói xóa cái gì. Không có hoàn tác.

### UX-08 · Nút "đánh dấu đã thu" toàn hệ thống không cảnh báo
- **Bước:** tìm nút đánh dấu đã thu tiền ở màn Tiền phòng. Xem UI trước khi bấm.
- **Đúng:** nếu một nút có thể ảnh hưởng nhiều hóa đơn, UI phải nói rõ **phạm vi** ("Đánh dấu 240 hóa đơn kỳ 07/2026?") và bắt xác nhận.
- **Nghi ngờ:** nút trông vô hại như mọi nút khác, không phân biệt mức độ nguy hiểm bằng màu/hình. Người dùng bấm nhầm mà không cảm nhận được rủi ro. (Tương ứng lỗi nghiệp vụ TC-01 — ở đây soi ở góc "UI không cảnh báo".)

### UX-09 · Nút nguy hiểm đặt cạnh nút thường
- **Bước:** rà các màn có nút "Xóa" / "Trả phòng" / "Hoàn cọc" nằm sát nút "Sửa" / "Xem".
- **Đúng:** nút phá hủy tách biệt rõ (màu, khoảng cách, hoặc nằm trong menu phụ) để tránh bấm nhầm — nhất là trên điện thoại ngón tay to.
- **Nghi ngờ:** các nút san sát, cùng cỡ, cùng màu → bấm nhầm thường xuyên trên mobile.

---

## NHÓM 3 — ĐIỆN THOẠI & MÀN HÌNH HẸP (học viên + bảo trì dùng)

### UX-10 · Bảng dữ liệu tràn ngang trên điện thoại
- **Bước:** DevTools → giả lập màn 360px. Mở danh sách học viên, danh sách hóa đơn, bảng chỉ số điện.
- **Đúng:** bảng cuộn ngang gọn trong khung, hoặc đổi sang dạng thẻ (card) trên mobile; thân trang **không** bị đẩy rộng ra.
- **Nghi ngờ:** bảng nhiều cột **đẩy vỡ layout**, phải cuộn ngang cả trang, chữ tràn ra ngoài. Cột tiền/ngày bị cắt.

### UX-11 · Nút và ô nhập quá nhỏ để chạm
- **Bước:** trên màn 360px, thử chạm các nút, checkbox (máy giặt/gửi xe), link trong bảng.
- **Đúng:** vùng chạm tối thiểu ~44px, không dính nhau.
- **Nghi ngờ:** nút/icon nhỏ, sát nhau → chạm trượt.

### UX-12 · Bàn phím ảo che ô đang nhập
- **Bước:** trên điện thoại thật (hoặc giả lập), chạm vào ô ở nửa dưới form → bàn phím bật lên.
- **Đúng:** trang tự cuộn để ô đang nhập không bị bàn phím che.
- **Nghi ngờ:** ô nhập bị bàn phím che, người dùng gõ mù.

### UX-13 · Menu / điều hướng trên mobile
- **Bước:** trên màn hẹp, tìm cách mở menu chính, chuyển giữa các mục.
- **Đúng:** có menu hamburger hoạt động mượt, đóng lại sau khi chọn.
- **Nghi ngờ:** menu desktop nhồi vào màn hẹp, tràn hoặc phải cuộn xa; hoặc menu che nội dung không đóng được.

### UX-14 · Xoay ngang màn hình
- **Bước:** xoay điện thoại sang ngang giữa lúc đang xem phiếu báo tiền phòng / biểu đồ điều hành.
- **Nghi ngờ:** layout nhảy loạn, biểu đồ SVG không co giãn, nội dung bị cắt.

---

## NHÓM 4 — TRẠNG THÁI RỖNG / TẢI / LỖI / OFFLINE

### UX-15 · Màn hình khi chưa có dữ liệu
- **Bước:** đăng nhập lần đầu (chưa có học viên/phòng), hoặc lọc ra kết quả rỗng.
- **Đúng:** trạng thái rỗng thân thiện — "Chưa có học viên nào. Bấm + để thêm" — có hướng dẫn bước tiếp.
- **Nghi ngờ:** **bảng trống trơn**, hoặc chỉ "No data", hoặc tệ hơn là khoảng trắng khiến người dùng tưởng lỗi.

### UX-16 · Mất mạng giữa chừng (PWA)
- **Bước:** DevTools → Network → Offline. Bấm quanh app, thử lưu.
- **Đúng:** báo rõ "Mất kết nối, thao tác chưa được lưu" — không giả vờ thành công.
- **Nghi ngờ:** app treo, hoặc **báo lưu thành công nhưng thực ra không** (optimistic UI sai), hoặc màn trắng. Học viên mạng yếu gặp thường xuyên.

### UX-17 · Server trả lỗi 500
- **Bước:** gây lỗi server (ví dụ mở `/api/electric?month=abc` như bộ nghiệp vụ, hoặc thao tác gây 500).
- **Đúng:** thông báo lỗi lịch sự, còn dùng app tiếp được.
- **Nghi ngờ:** màn trắng, hoặc kẹt spinner mãi mãi, hoặc văng JSON lỗi thô ra màn hình.

### UX-18 · Cache PWA cũ sau khi deploy bản mới
- **Bước:** cài PWA, dùng. Sau khi có bản deploy mới (đổi `sw.js`), mở lại app.
- **Đúng:** app nhận biết có bản mới và mời "Tải lại để cập nhật".
- **Nghi ngờ:** service worker phục vụ **bản cũ trong cache**, người dùng thấy giao diện/logic lỗi thời mà không biết, hoặc lỗi lệch phiên bản front/back. Kiểm tra cơ chế cập nhật của `sw.js`.

---

## NHÓM 5 — SỐ, TIỀN, NGÀY THÁNG HIỂN THỊ

### UX-19 · Định dạng tiền khó đọc
- **Bước:** xem số tiền ở hóa đơn, doanh thu, cọc. Kiểm tra 1200000 hiển thị thế nào.
- **Đúng:** `1.200.000 ₫` có dấu phân cách nghìn, nhất quán mọi màn.
- **Nghi ngờ:** chỗ hiển thị `1200000`, chỗ `1,200,000`, chỗ `1.200.000đ` — không nhất quán; số lớn khó đọc, dễ đọc nhầm số 0.

### UX-20 · Số tiền âm hiển thị mập mờ
- **Bước:** tạo tình huống có số âm (theo bộ nghiệp vụ) rồi xem cách hiển thị.
- **Đúng:** số âm phải nổi bật (đỏ, có dấu −) để người dùng nhận ra bất thường.
- **Nghi ngờ:** hiển thị lẫn lộn, hoặc `-1.200.000` bị cắt dấu, trông như số dương.

### UX-21 · Ô nhập số cho gõ chữ / ký tự lạ
- **Bước:** ở ô tiền/chỉ số điện, thử gõ chữ, dấu chấm, dấu phẩy, nhiều số 0, dán "1.200.000₫".
- **Đúng:** ô chỉ nhận số hợp lệ, hoặc tự dọn định dạng, báo rõ nếu sai.
- **Nghi ngờ:** nhận bừa, hoặc dán vào thì hỏng (dấu chấm nghìn làm sai giá trị).

### UX-22 · Định dạng ngày lộn xộn
- **Bước:** xem ngày ở các màn (check-in, hợp đồng, hóa đơn). Kiểm tra dd/mm hay mm/dd, và ô nhập ngày.
- **Đúng:** nhất quán `dd/mm/yyyy` (chuẩn VN), ô nhập có date picker rõ ràng.
- **Nghi ngờ:** chỗ `2026-07-16`, chỗ `16/07/2026`, chỗ `7/16/2026`; người VN dễ đọc nhầm tháng/ngày. Ô "kỳ" (month) nhập tay không có picker → gõ sai định dạng.

---

## NHÓM 6 — SỐ LIỆU MÂU THUẪN GIỮA CÁC MÀN

### UX-23 · Cùng một con số, hai màn khác nhau
- **Bước:** so sánh số học viên "đang ở" / số giường trống giữa **Tổng quan**, **Danh sách phòng**, **Báo cáo điều hành**, và **trang công khai**.
- **Đúng:** mọi màn hiển thị cùng con số.
- **Nghi ngờ:** lệch nhau (app có 2 cách tính trạng thái "đang ở" + trang công khai đếm cả bản đã xóa). Người dùng thấy số vênh → **mất niềm tin vào toàn bộ app**. Đây là lỗi UX nghiêm trọng dù gốc là lỗi dữ liệu.

### UX-24 · Trạng thái hiển thị không khớp hành động
- **Bước:** cho một học viên có ngày vào tương lai. Xem nhãn trạng thái ("đang ở" / "sắp vào") có nhất quán ở mọi nơi không.
- **Nghi ngờ:** màn này ghi "đang ở", màn kia "sắp vào" cho cùng một người.

---

## NHÓM 7 — LUỒNG KẸT / NGÕ CỤT

### UX-25 · Màn bắt buộc đổi mật khẩu
- **Bước:** đăng nhập tài khoản mới (must_change_password). Thử bấm Back, đóng modal, bấm menu khác.
- **Đúng:** hoặc bắt đổi dứt khoát (không thoát được cho tới khi đổi), hoặc cho phép hoãn rõ ràng — không nửa vời.
- **Nghi ngờ:** modal đổi mật khẩu **thoát được bằng cách bấm ra ngoài** (trùng lỗ hổng bảo mật), hoặc ngược lại **kẹt cứng không có nút thoát/không đổi được** nếu lỗi.

### UX-26 · Deep link / mở thẳng URL khi chưa đăng nhập
- **Bước:** dán thẳng URL một trang nội bộ khi chưa đăng nhập, hoặc bằng tài khoản không đủ quyền.
- **Đúng:** chuyển về trang đăng nhập, sau khi đăng nhập quay lại đúng trang định vào.
- **Nghi ngờ:** màn trắng, hoặc báo lỗi cụt, hoặc đăng nhập xong về trang chủ (mất ngữ cảnh).

### UX-27 · Nút Back của trình duyệt trong app một trang
- **Bước:** đi qua vài màn, bấm Back nhiều lần.
- **Đúng:** Back quay lại màn trước hợp lý.
- **Nghi ngờ:** Back nhảy thẳng ra ngoài app / về đăng nhập / mất hết ngữ cảnh, vì app không quản lý lịch sử điều hướng.

### UX-28 · Modal chồng modal / không đóng được
- **Bước:** mở modal (sửa học viên), từ trong đó mở tiếp modal khác (chọn phòng, thêm xe). Thử đóng bằng nút X, phím Esc, bấm nền.
- **Đúng:** đóng được bằng cả 3 cách, đóng đúng lớp trên cùng.
- **Nghi ngờ:** Esc không hoạt động, bấm nền đóng nhầm cả 2 lớp mất dữ liệu, hoặc nền tối kẹt lại che màn.

---

## NHÓM 8 — IN ẤN & XUẤT FILE (trải nghiệm)

### UX-29 · Bản in phiếu báo tiền phòng
- **Bước:** in phiếu báo tiền phòng (Ctrl+P / window.print). Xem bản xem trước in.
- **Đúng:** chỉ in nội dung phiếu, ẩn menu/nút; vừa 1 trang A4; số tiền, tên rõ ràng.
- **Nghi ngờ:** in cả menu/nút điều hướng, tràn nhiều trang, cắt mất cột, nền màu tốn mực. Kiểm tra class ẩn-khi-in có phủ hết không.

### UX-30 · Báo cáo điều hành khi in / xuất PDF
- **Bước:** in màn Báo cáo điều hành (có biểu đồ SVG).
- **Nghi ngờ:** biểu đồ mất màu/mất chữ khi in, hoặc bị cắt; layout dàn trang xấu.

### UX-31 · Mở file CSV vừa xuất
- **Bước:** xuất CSV doanh thu / tiền phòng, mở bằng Excel tiếng Việt.
- **Đúng:** tiếng Việt có dấu hiển thị đúng (nhờ BOM), cột thẳng hàng, số ra số.
- **Nghi ngờ:** tên tiếng Việt thành ký tự lạ nếu thiếu BOM ở máy nào đó; hoặc số điện thoại/mã bị Excel đổi thành số khoa học `9.01E+09`.

---

## NHÓM 9 — TIẾP CẬN (ACCESSIBILITY) & BÀN PHÍM

### UX-32 · Dùng app chỉ bằng bàn phím
- **Bước:** bỏ chuột. Dùng Tab / Shift+Tab / Enter / Esc để đăng nhập, thêm học viên, lưu.
- **Đúng:** thứ tự Tab hợp lý, thấy rõ ô đang focus, Enter submit được, Esc đóng modal.
- **Nghi ngờ:** không thấy viền focus (mất dấu con trỏ), Tab nhảy loạn, không tới được nút Lưu, modal bẫy focus sai.

### UX-33 · Nhãn ô nhập & trình đọc màn hình
- **Bước:** chạy Lighthouse (tab Accessibility) trên vài màn chính. Xem điểm và lỗi.
- **Đúng:** mọi ô có nhãn gắn đúng (label for), nút có tên, ảnh có alt.
- **Nghi ngờ:** nhiều ô chỉ có placeholder không có label, nút chỉ có icon không tên → điểm accessibility thấp, người khiếm thị không dùng được.

### UX-34 · Độ tương phản màu
- **Bước:** Lighthouse contrast, hoặc soi mắt các chữ xám nhạt trên nền trắng, chữ trên nút màu.
- **Đúng:** đạt chuẩn tương phản, đọc được ngoài nắng (bảo trì dùng ngoài trời).
- **Nghi ngờ:** chữ xám nhạt, chip trạng thái màu nhạt khó đọc, nhất là trên điện thoại giữa trời sáng.

---

## NHÓM 10 — VĂN BẢN, TRÀN, NHẤT QUÁN

### UX-35 · Tên / ghi chú quá dài
- **Bước:** nhập tên học viên rất dài, ghi chú dài, tên phòng dài. Xem ở bảng, thẻ, phiếu in, dropdown.
- **Đúng:** cắt gọn có "…" hoặc xuống dòng gọn, không vỡ layout.
- **Nghi ngờ:** đẩy cột rộng ra, tràn khỏi thẻ, che nút bên cạnh.

### UX-36 · Ký tự đặc biệt & dấu tiếng Việt
- **Bước:** nhập tên có dấu đầy đủ, emoji, ký tự `<>&"'`. Xem hiển thị mọi nơi (đây cũng là mặt UX của test XSS TC-46).
- **Đúng:** hiện đúng nguyên văn, dấu tiếng Việt không lỗi font.
- **Nghi ngờ:** dấu bị vỡ ở bản in/CSV, hoặc ký tự `<` làm hỏng hiển thị.

### UX-37 · Từ ngữ & nhãn không nhất quán
- **Bước:** rà toàn app xem cùng một thứ có bị gọi nhiều tên không: "Học viên" vs "Sinh viên" vs "HV"; "Phòng" vs "Room"; "Trả phòng" vs "Check-out" vs "Xuất cảnh"; nút "Lưu" vs "Cập nhật" vs "Xác nhận".
- **Đúng:** một khái niệm một tên, thuần Việt nhất quán.
- **Nghi ngờ:** lẫn lộn Việt–Anh, nhiều tên cho một thứ → người dùng mới bối rối.

### UX-38 · Icon không có chữ giải thích
- **Bước:** rà các nút chỉ có biểu tượng (sửa/xóa/xem/in).
- **Đúng:** có tooltip hoặc chữ kèm; ý nghĩa rõ.
- **Nghi ngờ:** một dãy icon na ná nhau không chữ → người dùng phải đoán, dễ bấm nhầm (cộng hưởng với UX-09).

### UX-39 · Phản hồi sau khi thao tác thành công
- **Bước:** lưu học viên, thu tiền, chuyển phòng thành công.
- **Đúng:** toast xác nhận rõ "Đã lưu học viên A", danh sách tự cập nhật.
- **Nghi ngờ:** không có phản hồi (người dùng không chắc đã lưu chưa, bấm lại), hoặc toast biến mất quá nhanh, hoặc danh sách không tự làm mới phải F5.

### UX-40 · Hai người sửa cùng lúc (UX của xung đột)
- **Bước:** 2 tab cùng mở một học viên. Tab A sửa lưu. Tab B (dữ liệu cũ) sửa lưu đè.
- **Đúng:** cảnh báo "Dữ liệu đã bị người khác thay đổi" trước khi đè.
- **Nghi ngờ:** Tab B **đè mất thay đổi của Tab A không cảnh báo** — mất dữ liệu thầm lặng do không có khóa/kiểm phiên bản.

---

## Thứ tự ưu tiên

**Nếu chỉ có nửa buổi, chạy 10 case này** — chúng ảnh hưởng nhiều người dùng nhất:

UX-01 (mất form khi Back) · UX-03 (double-click Lưu) · UX-05 (ngày sinh nuốt im) · UX-07 (xóa không phanh) · UX-10 (bảng vỡ trên mobile) · UX-16 (offline PWA) · UX-19 (định dạng tiền) · UX-23 (số liệu vênh giữa các màn) · UX-29 (bản in dính menu) · UX-39 (không phản hồi sau khi lưu).

## Ba vấn đề gốc về UX (không phải lỗi lẻ)

1. **App không bảo vệ công sức nhập liệu.** Không tự lưu nháp, không cảnh báo khi rời trang, không chống double-submit, không phản hồi khi mạng chậm → người dùng dễ mất dữ liệu và mất niềm tin. Đây là nhóm đáng sửa trước.
2. **App được viết cho màn hình rộng, nhưng học viên và bảo trì dùng điện thoại.** Bảng nhiều cột, nút nhỏ, form dài không tối ưu cảm ứng → nhóm dùng mobile chịu trải nghiệm tệ nhất.
3. **Thiếu phản hồi và thiếu phanh.** Ít xác nhận khi thành công, ít cảnh báo trước khi phá hủy, số liệu vênh giữa các màn → người dùng vừa không chắc mình đã làm đúng, vừa dễ làm sai mà không biết.

## Lưu ý

- Đây là test **trải nghiệm**, phần lớn là quan sát và phán đoán — nên chụp màn hình / quay màn hình làm bằng chứng, mô tả cảm giác người dùng, không chỉ ghi "pass/fail".
- Nhiều case giao thoa với bộ test nghiệp vụ (`TEST-PLAN-ADVERSARIAL.md`) nhưng nhìn ở góc khác: ở đó hỏi "app có làm sai không", ở đây hỏi "người dùng có bị hại/bối rối không".
- Chỉ test trên **bản local**, không đụng bản demo trên Render.
