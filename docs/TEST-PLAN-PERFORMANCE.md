# BỘ TEST HIỆU NĂNG / TẢI — App Quản lý KTX

> Câu hỏi: **100–1000 người cùng dùng thì sao?**
> Trả lời trung thực: với bản đang chạy, con số đó **vượt xa nhu cầu thật**, nhưng vẫn đáng đo vì
> (1) đích chiến lược là **đa cơ sở** — nhiều KTX × ~240 HV thì 1000 đồng thời vào ngày chốt hóa đơn là có thật,
> và (2) **vài chỗ gục ở mức thấp hơn 100 rất nhiều**. Bộ này chỉ ra chỗ nào gục, ở mức nào, vì dòng code nào.
> Kèm harness chạy được: `tests/perf/load.js`.

---

## 0. Chỉnh lại kỳ vọng — "đồng thời" nghĩa là gì

Đừng lẫn **người dùng** với **request đồng thời**. 240 học viên có tài khoản ≠ 240 request cùng một giây.
Một người mở app → tải vài API rồi **ngồi đọc** — thời gian "nghĩ" giữa hai thao tác thường 5–30 giây.

- **Tải thật hôm nay (1 cơ sở):** cao điểm là **ngày phát hành hóa đơn**. Admin bấm "Lập hóa đơn cả kỳ" (1 thao tác rất nặng), rồi trong vài giờ sau học viên lai rai đăng nhập xem phiếu báo. Số request **đồng thời** thực tế: **5–30**, hiếm khi hơn. "100 cùng lúc" đã là 40% toàn bộ học viên bấm đúng một giây.
- **Điều đáng lo không phải số người — mà là hình dạng tải:** 1 request nặng (lập hóa đơn) có thể **giữ chết** tài nguyên và làm 20 request nhẹ khác xếp hàng. Đó mới là kịch bản gãy thật, và nó xảy ra **ở mức đồng thời rất thấp**.
- **Đa cơ sở (đích P0):** 4 cơ sở cùng chốt hóa đơn một buổi sáng → cả nghìn phiếu + nhân viên mỗi cơ sở cùng thao tác → lúc đó 100–1000 đồng thời mới là con số phải chịu được. **Kiến trúc hiện tại chưa sẵn sàng cho mức đó** (mục 2).

---

## 1. Trần cứng của kiến trúc hiện tại (đọc từ code, không đoán)

| Giới hạn | Giá trị | Nguồn | Ý nghĩa khi tải nặng |
|---|---|---|---|
| Tiến trình Node | **1** (không cluster) | `server/index.js` | CPU chỉ dùng **1 lõi**. Mọi request chia nhau một luồng sự kiện. 1 handler nặng CPU (dựng CSV, bcrypt) làm **kẹt tất cả**. |
| Instance Render | **1 service** | ghi nhớ dự án | Không có bản sao chia tải, không tự co giãn. Sập là sập cả. |
| Pool kết nối CSDL | **max 10** | `db.js:21` | Tối đa **10 truy vấn CSDL chạy song song**. Request thứ 11 **chờ tối đa 10s** (`db.js:23`) rồi **lỗi**. Đây là nút cổ chai đầu tiên gặp phải. |
| `statement_timeout` | **15s** | `db.js:24` | Truy vấn quá 15s bị **hủy** → 500. Bom hẹn giờ cho các endpoint quét toàn bảng khi dữ liệu tăng. |
| `connectionTimeout` | **10s** | `db.js:23` | Chờ slot pool quá 10s → lỗi kết nối. |
| Rate-limit chung | **600 req/phút/IP** | `index.js:28,49` | **Toàn bộ văn phòng chung 1 IP** → cả cơ sở share 600 req/phút. Test tải từ 1 máy **đụng trần này ngay** (xem mục 4). |
| Rate-limit đăng nhập | 20 lần/15ph/IP, bỏ qua lần đúng | `index.js:32,51` | Nhiều người cùng IP đăng nhập **sai** vài lần → khóa cả IP (trùng TC-19 bộ v1). |
| Rate-limit `/apply` | **10 đơn/phút/IP** | `index.js:45,50` | (Ghi chú: có limiter riêng — sửa lại nhận định cũ ở V2-50.) |
| Body parser | 2MB thường / 16MB media·public | `index.js:23-25` | Nhiều request body lớn cùng lúc **ngốn RAM** của 1 instance. |

**Kết luận trần:** dù tối ưu cỡ nào, một instance + pool 10 + 1 lõi CPU **không phục vụ nổi 1000 request thật-sự-đồng-thời**. Muốn tới đó cần: nhiều instance sau load balancer, pool lớn hơn (và Postgres chịu được), tách việc nặng ra khỏi request. Đó là việc **kiến trúc**, không phải chỉnh tham số.

---

## 2. Bốn điểm gục — có thật, tied to code

### P-01 · "Lập hóa đơn cả kỳ" giữ 1 kết nối chạy tuần tự — bom hẹn giờ 15 giây
- **Code:** `invoices.routes.js:60` `pool.connect()` lấy **một** client → `:69` `BEGIN` → `:167` `for (const s of students)` vòng lặp **tuần tự**, mỗi vòng `await client.query(INSERT/UPDATE)` (`:185`, `:194`) → `:209` `COMMIT`. Toàn bộ ~240 học viên xử lý **nối đuôi trong MỘT giao dịch, trên MỘT kết nối**.
- **Vì sao gục:** cả giao dịch phải xong trong `statement_timeout`/giới hạn của nhà cung cấp. Trên Supabase/PgBouncer có trần thời gian câu lệnh → **quá ngưỡng là ROLLBACK sạch, không tạo được hóa đơn nào**. Và trong lúc chạy, nó **chiếm 1/10 pool** + khóa hàng loạt dòng `invoices`.
- **Đây là TC-48 của bộ v1.** V2 chưa đo thời gian thật. **Cần đo:** với ~240 HV, `POST /api/invoices/generate` (chế độ thật, không preview) mất bao lâu? Nếu >10s → đã ở vùng nguy hiểm; nhân số cơ sở lên là vượt.
- **Đo bằng tay:** `time curl -X POST .../api/invoices/generate -d '{"month":"2026-07"}'` — chạy 1 lần, xem giây.

### P-02 · Endpoint quét toàn bảng, không LIMIT ở tầng SQL
- `GET /api/admin/data-health` (`admin.routes.js:49-59`): **4 truy vấn GROUP BY + string_agg quét toàn bảng `students`**, `LIMIT` duy nhất là `rows.slice(0,30)` ở **JavaScript** (`:55`) — DB đã làm hết việc rồi mới cắt.
- `GET /api/reports/revenue` (`reports.routes.js:18-30`): GROUP BY toàn bộ `invoices` JOIN `students`, không LIMIT, không `year` thì gộp **cả lịch sử**.
- **Vì sao gục:** mỗi request ăn một slot pool trong thời gian dài. Gọi lặp (hoặc vài admin cùng mở) → **pool 10 cạn nhanh** → request thường (đăng nhập, xem phòng) xếp hàng → cả app "đơ". Dữ liệu càng nhiều, càng gần `statement_timeout` 15s.
- **Đo:** kịch bản `data-health` và `revenue` trong harness, tăng `--c` dần, nhìn p95/p99 và tỉ lệ 500.

### P-03 · Gửi SMTP đồng bộ ngay trong request — treo tới 12 giây
- **Code:** `violations.routes.js:128` `await sendViolationMail(...)` **giữa** luồng tạo vi phạm; `mailer.js:23-25` timeout `connection 10s / socket 12s`.
- **Vì sao gục:** khi SMTP chậm/treo, request `POST /api/violations` **giữ cả kết nối lẫn luồng tới 12s**. Vài cái cùng lúc là **ăn hết pool**. Người dùng bấm lại (vì tưởng treo) → nhân đôi vi phạm + mail (V2-06). Việc gửi mail lẽ ra phải **tách khỏi request** (hàng đợi/nền).

### P-04 · Không có phân trang ở các danh sách chính
- `GET /api/students`, `/api/violations` (`:87`), `/api/logs`, `/api/admin/audit` trả **cả bảng** (một số có trần cứng 500/2000 nhưng **không có phân trang thật**). Payload lớn dần theo dữ liệu → thời gian truyền + RAM client + băng thông đều tăng tuyến tính. Ở đa cơ sở (không lọc theo cơ sở — `facility_id` chưa dùng để phân vùng) thì mỗi lần mở danh sách kéo **toàn bộ mọi cơ sở**.

---

## 3. Kịch bản đo (dùng `tests/perf/load.js`)

**Chuẩn bị:** server chạy ở cửa khác, trỏ vào **CSDL dùng-rồi-bỏ** (Docker Postgres local, hoặc một
**Supabase branch tạm** — TUYỆT ĐỐI không phải staging/prod). Nhồi sẵn ~240 HV để giống thật.
Đặt `ADMIN_P` = mật khẩu admin.

```bash
# đọc nặng — danh sách 240 HV, 300 request, 50 đồng thời
ADMIN_P=... LOAD_ACK=1 node tests/perf/load.js read-heavy --n=300 --c=50

# endpoint quét toàn bảng — tăng đồng thời để ép cạn pool
ADMIN_P=... LOAD_ACK=1 node tests/perf/load.js data-health --n=100 --c=20
ADMIN_P=... LOAD_ACK=1 node tests/perf/load.js revenue     --n=100 --c=20

# tải bền 30 giây, pha trộn giống thật (70% list, 20% dashboard, 10% data-health)
ADMIN_P=... LOAD_ACK=1 node tests/perf/load.js mixed --dur=30 --c=40

# cổng học viên
ADMIN_P=... LOAD_STUDENT=hocvien:123456 LOAD_ACK=1 node tests/perf/load.js me-invoices --n=300 --c=50

# đăng nhập (đo bcrypt + authLimiter)
LOAD_ACK=1 node tests/perf/load.js login --n=50 --c=10
```

Harness in ra: **thông lượng (req/s), p50/p95/p99/max, tỉ lệ lỗi, phân loại lỗi**. Nó tự chú thích khi thấy
`429` (đụng rate-limit) hay `500`/timeout (nghi pool cạn / `statement_timeout`).

### Ngưỡng ĐẠT / KHÔNG ĐẠT (đề xuất — sếp chốt lại)
| Chỉ số | Đạt | Cần xem lại | Gãy |
|---|---|---|---|
| p95 đọc nặng (`read-heavy`, `me-invoices`) | < 500ms | 0.5–2s | > 2s |
| p95 `data-health` / `revenue` | < 1s | 1–5s | > 5s hoặc có 500 |
| Tỉ lệ lỗi (trừ 429 do test 1 IP) | 0% | < 1% | ≥ 1% |
| `POST /invoices/generate` ~240 HV | < 5s | 5–10s | > 10s (P-01) |
| Thông lượng `mixed` không lỗi | — | — | tụt khi tăng `--c` = đã tới trần |

---

## 4. Cái bẫy môi trường — đọc trước khi tin số

1. **Test từ 1 máy = 1 IP → đụng `apiLimiter` 600/phút ngay.** Harness sẽ báo một loạt `429`. Đó **không phải** app chậm — đó là rate-limit. Muốn đo sức chịu thật của CSDL/handler thì hoặc tạm nâng `max` khi test, hoặc đọc số **trước khi** chạm 600 req trong phút đó. Nhưng cũng nhớ: **ngoài đời cả văn phòng chung 1 IP thật** → 429 này là hành vi thật, không phải giả (trùng TC-19).
2. **Localhost KHÔNG mô phỏng được độ trễ mạng + Render.** Trên máy, DB kề bên, RTT ~0. Trên Render + Supabase có độ trễ mạng mỗi truy vấn — mà app gọi **nhiều truy vấn nối tiếp** mỗi request (vd `generate` có hàng chục `await client.query`) → **số thật trên cloud CHẬM HƠN nhiều lần** số local. Local chỉ dùng để **so sánh tương đối** (kịch bản nào tệ hơn) và **tìm chỗ gãy logic** (pool cạn, timeout), **không** để hứa "p95 = Xms trên prod".
3. **Đừng bao giờ bắn tải vào staging/prod.** `ktx-tnh.onrender.com` là 1 service, không có bản staging riêng — cày nó là cày bản demo cho sếp. Harness chặn cứng non-localhost, nhưng **server local có thể trỏ DATABASE_URL vào staging** — đó là lý do có rào `LOAD_ACK=1`. Kiểm `.env` của server **trước mỗi lần chạy**.

---

## 5. Việc nên làm (theo thứ tự tác động, nếu nhắm đa cơ sở)

Không phải để "sửa hiệu năng" chung chung — mỗi việc gỡ đúng một nút cổ chai ở trên:

1. **Tách "lập hóa đơn cả kỳ" ra khỏi request** (P-01): chạy nền theo lô, hoặc chia nhỏ giao dịch theo phòng/cơ sở, báo tiến độ. Đây là thao tác nguy hiểm nhất khi dữ liệu tăng.
2. **Phân trang thật + lọc theo cơ sở** cho students/violations/logs/audit (P-04) — vừa là hiệu năng, vừa là nền đa cơ sở.
3. **Đặt `LIMIT` ở tầng SQL** cho data-health/reports (P-02), và cân nhắc cache kết quả report.
4. **Đưa gửi mail ra hàng đợi nền** (P-03), request trả ngay.
5. **Cluster Node theo số lõi** + cân nhắc nâng `pool.max` **song song** với việc kiểm Postgres chịu được — nâng pool mà DB không chịu nổi thì chỉ dời nút cổ chai.
6. **Rate-limit theo tài khoản, không chỉ theo IP** (P-04 trần bảng + TC-19) để văn phòng chung IP không tự khóa nhau.

---

## 6. Đối chiếu với các bộ khác
- **TC-48 (bộ v1)** nêu nghi ngờ `generate` timeout — bộ này biến nó thành P-01 có cách đo cụ thể.
- **V2-75** (data-health/reports quét toàn bảng) — bộ này đo được nó gục ở mức đồng thời nào (P-02).
- **V2-82** (modal kẹt khi `refreshCache` lỗi → bấm lại → bản ghi trùng) — dưới tải, `refreshCache` **rất dễ** lỗi (pool cạn/timeout) nên bản ghi trùng do double-click sẽ **phổ biến hơn** đúng lúc đông người. Chạy P-02 gây tải trong lúc một người thao tác form để tái hiện.
