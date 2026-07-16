# BỘ TEST QUYỀN RIÊNG TƯ & PHÁP LÝ — App Quản lý KTX

> ⚠️ **Không phải tư vấn pháp lý.** Đây là rà soát kỹ thuật + đối chiếu quy định theo hiểu biết tới đầu 2026,
> để chị **đưa cho bộ phận pháp chế/luật sư** quyết định. Con người thật, dữ liệu thật (CCCD, ngày sinh, ảnh,
> SĐT phụ huynh) → phần này rủi ro **pháp lý và uy tín**, không chỉ kỹ thuật.
> Bối cảnh: học viên là công dân VN; app deploy trên **Render (nước ngoài)** + **Supabase (nước ngoài)**.

## Vì sao mảng này quan trọng với app này
App thu và lưu **dữ liệu cá nhân nhạy cảm**: số CCCD (`students.id_card`, `applications`), **ảnh 2 mặt CCCD**
(bucket `S3_CCCD_BUCKET` trên Supabase), ngày sinh, SĐT học viên **và SĐT phụ huynh**, lớp, quê quán, biển số xe,
lịch sử vi phạm/kỷ luật. Theo pháp luật VN, phần lớn đây là **dữ liệu cá nhân**, một số thuộc nhóm **nhạy cảm**.

**Khung pháp lý VN cần đối chiếu** (pháp chế xác nhận hiệu lực/áp dụng cụ thể):
- **Nghị định 13/2023/NĐ-CP** về bảo vệ dữ liệu cá nhân (hiệu lực 01/7/2023): định nghĩa dữ liệu cá nhân cơ bản/nhạy cảm, **yêu cầu sự đồng ý**, quyền của chủ thể dữ liệu, **hồ sơ đánh giá tác động xử lý DLCN (DPIA)**, và **hồ sơ đánh giá tác động chuyển DLCN ra nước ngoài**.
- **Luật Bảo vệ dữ liệu cá nhân** (theo hiểu biết tới đầu 2026 đã được thông qua và có hiệu lực) — siết thêm nghĩa vụ, chế tài. **Pháp chế xác nhận mốc hiệu lực và điều khoản áp dụng.**

---

## NHÓM P1 — SỰ ĐỒNG Ý & MINH BẠCH (P0 pháp lý)

### PRV-01 · Không có cơ chế xin đồng ý khi thu dữ liệu
- **Bước:** mở form đăng ký công khai `/dang-ky`. Tìm ô "Tôi đồng ý cho KTX thu thập/xử lý dữ liệu cá nhân", link tới chính sách.
- **Đúng:** có ô đồng ý **tách bạch, không tick sẵn**, nêu rõ mục đích + thời hạn lưu + việc chuyển ra nước ngoài, kèm link chính sách.
- **Nghi ngờ:** **không có gì** (grep `public/` không thấy consent/chính sách/điều khoản). Form thu CCCD + ảnh + ngày sinh + SĐT phụ huynh mà không xin phép, không nói lưu ở đâu, giữ bao lâu. NĐ 13 yêu cầu **sự đồng ý trước khi xử lý**, và đồng ý phải **được thể hiện rõ ràng, có thể rút lại**.
- **Mức độ:** Nghiêm trọng (pháp lý).

### PRV-02 · Không có Chính sách bảo mật / Thông báo xử lý dữ liệu
- **Bước:** tìm trang "Chính sách bảo mật" công khai; kiểm footer trang đăng ký.
- **Nghi ngờ:** không tồn tại. Cần văn bản nêu: thu dữ liệu gì, mục đích, căn cứ pháp lý, thời hạn lưu, chia sẻ cho ai (nhà trường qua mail vi phạm!), chuyển ra nước ngoài (Render/Supabase), quyền của học viên, cách liên hệ.
- **Mức độ:** Nghiêm trọng (pháp lý).

### PRV-03 · Dữ liệu người CHƯA THÀNH NIÊN — đồng ý của cha mẹ
- **Bước:** xác định độ tuổi học viên KTX. App thu `birth_date` và `parent_phone` → có khả năng có người < 18 (thậm chí < 16).
- **Đúng:** với người chưa thành niên, NĐ 13 yêu cầu **sự đồng ý của cha/mẹ hoặc người giám hộ**, và xử lý dữ liệu trẻ em có ràng buộc chặt hơn.
- **Nghi ngờ:** app không phân biệt tuổi, không có luồng đồng ý của phụ huynh — dù đã thu sẵn SĐT phụ huynh. Nếu có học viên < 16 thì đây là nghĩa vụ bắt buộc.
- **Mức độ:** Cao (tùy độ tuổi thực tế — pháp chế xác nhận).

---

## NHÓM P2 — CHUYỂN DỮ LIỆU RA NƯỚC NGOÀI (P0 pháp lý)

### PRV-04 · CCCD + ảnh công dân VN đang nằm trên hạ tầng nước ngoài, không có hồ sơ
- **Bước:** xác nhận vị trí lưu trữ: CSDL Supabase (`render.yaml:29` endpoint `*.supabase.co`), app Render — đều là nhà cung cấp nước ngoài.
- **Đúng:** NĐ 13 yêu cầu **lập Hồ sơ đánh giá tác động chuyển dữ liệu cá nhân ra nước ngoài** và gửi Bộ Công an (Cục A05), lưu và cập nhật. Với **số định danh/CCCD** (dữ liệu nhạy cảm) yêu cầu càng chặt.
- **Nghi ngờ:** không có dấu vết hồ sơ nào; quyết định hạ tầng thuần kỹ thuật, chưa qua đánh giá pháp lý. Đây có thể là **rủi ro lớn nhất** của cả dự án về mặt tuân thủ.
- **Cân nhắc kỹ thuật:** nếu tuân thủ khó, xét **lưu ảnh CCCD/CSDL ở hạ tầng đặt tại VN** (nhà cung cấp trong nước), hoặc **không lưu ảnh CCCD** mà chỉ đối chiếu rồi xóa. Đây là quyết định sản phẩm + pháp lý, cần đưa lên product owner.
- **Mức độ:** Nghiêm trọng.

---

## NHÓM P3 — QUYỀN CỦA CHỦ THỂ DỮ LIỆU (P1)

### PRV-05 · Học viên không có quyền xem đầy đủ / xuất / xóa dữ liệu của mình
- **Bước:** login HV → tìm chức năng "tải dữ liệu của tôi" / "yêu cầu xóa tài khoản".
- **Đúng:** NĐ 13 cho chủ thể dữ liệu quyền **truy cập, chỉnh sửa, xóa, rút đồng ý, phản đối xử lý**. Cần có đường để HV thực hiện (hoặc quy trình thủ công có cam kết thời hạn).
- **Nghi ngờ:** không có endpoint HV tự xuất/xóa (`me.routes.js` chỉ đọc vài mục). "Xóa" của admin là **xóa mềm** — dữ liệu (gồm CCCD, ảnh) **nằm lại vĩnh viễn**, không có xóa cứng. Rút đồng ý thì không có gì để rút vì chưa từng xin (PRV-01).
- **Mức độ:** Cao.

### PRV-06 · Không có chính sách thời hạn lưu — dữ liệu giữ mãi mãi
- **Bước:** tìm cơ chế tự xóa/ẩn dữ liệu học viên đã rời KTX sau X năm.
- **Nghi ngờ:** không có. Học viên trả phòng 5 năm trước vẫn còn nguyên CCCD + ảnh trong hệ thống. NĐ 13 nêu nguyên tắc **chỉ lưu trong thời gian cần thiết cho mục đích**. Cần chính sách: sau khi hết hợp đồng + hết nghĩa vụ kế toán, **xóa cứng hoặc ẩn danh hóa** CCCD/ảnh.
- **Mức độ:** Trung bình–Cao.

---

## NHÓM P4 — LỘ / GIỮ DỮ LIỆU QUÁ MỨC (P1 — ghép bộ nghiệp vụ)

### PRV-07 · Đường đọc CCCD hàng loạt không để lại vết
- **Nghi ngờ:** `GET /api/admin/data-health` trả **số CCCD nguyên vẹn** (`admin.routes.js:35`), là **GET nên không vào audit** → admin (hoặc tài khoản admin bị chiếm) đọc/kết xuất CCCD toàn bộ HV **không dấu vết**. Ghép **V2-74**. Với DLCN nhạy cảm, việc *đọc* mới là thứ cần ghi log.
- **Kèm:** HV đọc được ghi chú nội bộ về mình (`admin_note`, `note`, lý do khấu trừ cọc) — **V2-45**. Nhân viên bảo trì đọc được tên + SĐT mọi HV báo hỏng — audit mảng bảo trì.

### PRV-08 · Thu SĐT phụ huynh — có cần không, đã xin phép chưa
- **Nghi ngờ:** app lưu `parent_phone`. Đây là dữ liệu của **bên thứ ba** (phụ huynh) — về nguyên tắc cũng cần căn cứ hợp pháp để thu và xử lý. Rà lại: có thật cần không, dùng vào việc gì, phụ huynh có được thông báo không.

### PRV-09 · Rò rỉ dữ liệu — có quy trình thông báo không
- **Nghi ngờ:** không có kênh phát hiện/thông báo sự cố (ghép MON-02/03: không error tracking, không alert). NĐ 13 yêu cầu **thông báo vi phạm dữ liệu cá nhân cho cơ quan chức năng trong 72 giờ**. Không có giám sát thì **không biết để mà báo**. Cần: quy trình ứng phó sự cố + đầu mối chịu trách nhiệm bảo vệ DLCN.

---

## Đã kiểm — ĐẠT, đáng ghi nhận
- Ảnh CCCD **được bảo vệ đúng ở đường xem chính thức**: `GET /api/students/:id/cccd/:side` kiểm chính chủ (`students.routes.js:48`), từ chối hồ sơ đã xóa (`:50`), `Cache-Control: private`. Bucket CCCD tách khỏi bucket ảnh công khai.
- Audit log DB **che secret** (`index.js:89`). Mật khẩu băm bcrypt, không lưu thô.
- Không IDOR ở cổng học viên (mỗi HV chỉ đọc dữ liệu của mình).

## Thứ tự ưu tiên (đưa pháp chế)
**P0 pháp lý — làm trước go-live 30/07:**
1. **PRV-04** hồ sơ chuyển dữ liệu ra nước ngoài (hoặc đổi hạ tầng về VN / không lưu ảnh CCCD) — rủi ro lớn nhất.
2. **PRV-01 + PRV-02** ô đồng ý + chính sách bảo mật trên form đăng ký.
3. **PRV-03** đồng ý của phụ huynh nếu có HV chưa thành niên.

**P1 — ngay sau:**
4. **PRV-05** quyền xuất/xóa dữ liệu của HV (ít nhất quy trình thủ công).
5. **PRV-06** chính sách thời hạn lưu + xóa cứng/ẩn danh CCCD cũ.
6. **PRV-07** ghi log việc đọc CCCD; **PRV-09** quy trình báo sự cố 72h + đầu mối phụ trách DLCN.

> Nhắc lại: phần này để **pháp chế/luật sư quyết định**, không phải kết luận pháp lý từ bộ test.
