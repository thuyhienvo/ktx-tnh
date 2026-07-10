# IMPLEMENTATION PLAN — Redesign App Quản lý Ký túc xá theo phong cách luxury residence

Hãy redesign app “Quản lý Ký túc xá / Nội trú Esuhai” theo cảm hứng từ website Maison Panthère: luxury residence, editorial layout, nhiều khoảng trắng, typography thanh lịch, hero section lớn, card chức năng sang trọng, CTA rõ ràng, trải nghiệm giống hệ thống quản lý boutique residence.

Mục tiêu: 
- Không copy y nguyên Maison Panthère.
- Chỉ lấy tinh thần: luxury, calm, editorial, residence booking, concierge/admin dashboard.
- Ứng dụng vẫn là phần mềm quản lý ký túc xá thực tế, ưu tiên dễ dùng, nhanh, rõ nghiệp vụ.

---

## 1. Tech Stack bắt buộc

Sử dụng stack sau:

- Frontend: React + TypeScript
- Build tool: Vite
- Styling: Tailwind CSS
- UI components: shadcn/ui
- Icons: lucide-react
- Animation: Framer Motion
- Charts: Recharts
- State/Data:
  - Nếu app hiện tại đang dùng backend/API sẵn thì giữ nguyên API.
  - Nếu chưa rõ backend, tạo service layer tách biệt:
    - `/src/services/students.ts`
    - `/src/services/rooms.ts`
    - `/src/services/applications.ts`
    - `/src/services/payments.ts`
- Routing: React Router
- Forms: React Hook Form + Zod
- Tables: TanStack Table nếu cần bảng dữ liệu nâng cao
- Date/calendar: date-fns + custom calendar component hoặc shadcn Calendar
- Deploy compatible với Render/Vercel.

Không dùng CSS inline rải rác. Tất cả design token phải gom ở Tailwind config hoặc CSS variables.

---

## 2. Design Direction

Phong cách tổng thể:

- Luxury residence management
- Boutique hotel dashboard
- Editorial magazine layout
- Tông màu ấm, nhẹ, cao cấp
- Không dùng dashboard quá “công sở” hoặc quá nhiều màu xanh mặc định
- Không dùng gradient lòe loẹt
- Không dùng emoji quá nhiều trong UI chính, chỉ icon tinh tế

Ứng dụng hiện tại đang có các module như:
- Tổng quan
- Học viên
- Phòng
- Xe vận hành
- Check-in / check-out
- Tiền phòng
- Doanh thu
- Đơn từ học viên
- Cài đặt

Hãy giữ toàn bộ nghiệp vụ này nhưng thay đổi cách trình bày để giống một hệ thống quản lý residence cao cấp.

---

## 3. Font / Typography

Dùng pairing font như sau:

### Option chính
- Heading font: `Cormorant Garamond` hoặc `Playfair Display`
- Body font: `Inter`
- Mono/number font: `JetBrains Mono` hoặc dùng Inter tabular nums

Import qua Google Fonts:

```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');