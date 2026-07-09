# CI/CD: Push code → tự build & deploy

Luồng: **git push** → GitHub Actions **build Docker image** → đẩy vào **GHCR** (`ghcr.io/thuyhienvo/ktx-tnh`) → gọi **Deploy Hook của Render** → Render kéo image mới và chạy.

File workflow: `.github/workflows/deploy.yml` (đã có sẵn).

## Cấu hình một lần (sau đó tự động mãi)

**1. Để GitHub Action build image**
Không cần làm gì thêm — dùng `GITHUB_TOKEN` sẵn có. Sau lần push đầu, vào **repo → tab Actions** xem build; xong image nằm ở **repo → Packages**.

**2. Cho Render kéo được image từ GHCR**
Vào **repo → Packages → `ktx-tnh` → Package settings → Change visibility → Public**
(Hoặc để Private thì phải khai báo thông tin đăng nhập GHCR trong Render — Public là đơn giản nhất; image chỉ chứa **code**, không chứa dữ liệu/khoá.)

**3. Tạo web service kiểu Image trên Render**
- Render → **New +** → **Web Service** → **Deploy an existing image**.
- Image URL: `ghcr.io/thuyhienvo/ktx-tnh:latest`
- Region: **Singapore**, Plan: **Free**.
- Biến môi trường (Environment):
  - `DATABASE_URL` = internal connection string của Postgres **ktx-db** (lấy ở trang DB đó).
  - `JWT_SECRET` = một chuỗi ngẫu nhiên dài.
  - `ADMIN_USERNAME` = `admin`
  - `ADMIN_PASSWORD` = mật khẩu quản trị bạn chọn.
- Health Check Path: `/api/health`.

**4. Lấy Deploy Hook & gắn vào GitHub**
- Trong service vừa tạo → **Settings → Deploy Hook** → copy URL.
- Vào **repo → Settings → Secrets and variables → Actions → New repository secret**:
  - Name: `RENDER_DEPLOY_HOOK_URL`
  - Value: dán URL vừa copy.

## Xong!
Từ giờ mỗi lần **push lên `main`** (hoặc bấm Run trong tab Actions), hệ thống tự: build → đẩy GHCR → deploy Render. Không cần bấm tay.

> Ghi chú: service kiểu **git-build** cũ (`ktx-tnh`) có thể xoá đi sau khi service **image** chạy ổn (dùng chung Postgres `ktx-db`).
