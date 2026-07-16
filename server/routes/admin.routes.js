const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { requireAuth, requireRole, revokeTokens } = require('../auth');
const { checkPassword } = require('../valid');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

/* ---------- Nhật ký thao tác (audit) ---------- */
// ---- TÌNH TRẠNG DỮ LIỆU ----
// Ràng buộc ở CSDL chỉ áp được khi dữ liệu sạch. Cái nào chưa áp được thì nằm trong schema_guard —
// nhưng chị quản lý không đọc nhật ký máy chủ, nên phải bày ra đây kèm ĐÍCH DANH bản ghi cần sửa.
// Không có màn này thì ràng buộc trượt trong im lặng: ai cũng tưởng được bảo vệ, thật ra không.
const KIEM_TRA = [
  {
    ma: 'ma_hv_trung', ten: 'Học viên trùng mã',
    vi_sao: 'Một người có 2 hồ sơ → nhận 2 phiếu → bị thu tiền 2 lần.',
    cach_sua: 'Giữ 1 hồ sơ, xoá hồ sơ thừa. Nếu bạn ấy chuyển phòng, dùng nút "Chuyển phòng" trên hồ sơ giữ lại.',
    sql: `SELECT s.code AS khoa, string_agg(s.name || ' (#' || s.id || COALESCE(' · ' || r.name, '') || ')', ' + ' ORDER BY s.id) AS chi_tiet
            FROM students s LEFT JOIN rooms r ON r.id = s.room_id
           WHERE s.deleted_at IS NULL AND COALESCE(btrim(s.code),'') <> ''
           GROUP BY s.code HAVING COUNT(*) > 1 ORDER BY s.code`,
  },
  {
    ma: 'ngay_ra_truoc_ngay_vao', ten: 'Ngày trả phòng trước ngày nhận phòng',
    vi_sao: 'Thường là gõ nhầm NĂM. Số ngày ở tính ra 0 → phiếu sai.',
    cach_sua: 'Mở hồ sơ, sửa lại năm cho đúng.',
    sql: `SELECT name AS khoa, 'vào ' || check_in_date || ' · ra ' || check_out_date || ' (#' || id || ')' AS chi_tiet
            FROM students WHERE deleted_at IS NULL AND check_out_date < check_in_date ORDER BY check_out_date - check_in_date`,
  },
  {
    ma: 'cccd_trung', ten: 'Học viên trùng CCCD',
    vi_sao: 'Hai người không thể chung một CCCD → chắc chắn có hồ sơ thừa.',
    cach_sua: 'Giữ 1 hồ sơ, xoá hồ sơ thừa.',
    sql: `SELECT id_card AS khoa, string_agg(name || ' (#' || id || ')', ' + ' ORDER BY id) AS chi_tiet
            FROM students WHERE deleted_at IS NULL AND COALESCE(btrim(id_card),'') <> ''
            GROUP BY id_card HAVING COUNT(*) > 1`,
  },
  {
    ma: 'so_hd_trung', ten: 'Trùng số hợp đồng',
    vi_sao: 'Hai người cầm cùng một số hợp đồng.',
    cach_sua: 'Đối chiếu hợp đồng giấy, sửa lại số cho đúng người.',
    sql: `SELECT contract_no AS khoa, string_agg(name || ' (#' || id || ')', ' + ' ORDER BY id) AS chi_tiet
            FROM students WHERE deleted_at IS NULL AND COALESCE(btrim(contract_no),'') <> ''
            GROUP BY contract_no HAVING COUNT(*) > 1 ORDER BY contract_no`,
  },
];

router.get('/data-health', async (req, res, next) => {
  try {
    const guards = (await query('SELECT ten, loi FROM schema_guard ORDER BY ten')).rows;
    const out = [];
    for (const k of KIEM_TRA) {
      const { rows } = await query(k.sql);
      out.push({ ma: k.ma, ten: k.ten, vi_sao: k.vi_sao, cach_sua: k.cach_sua, so_luong: rows.length, rows: rows.slice(0, 30) });
    }
    res.json({ guards, checks: out, sach: guards.length === 0 && out.every(c => c.so_luong === 0) });
  } catch (e) { next(e); }
});

// Nhật ký có LỌC ĐƯỢC thì mới điều tra được. Trước đây chỉ nhận limit (trần 500) -> sau vài tuần
// 500 dòng mới nhất chỉ còn vài ngày, sự cố 3 tháng trước nằm trong CSDL mà lấy không ra (V2-66).
router.get('/audit', async (req, res, next) => {
  try {
    const limit = Math.min(500, Math.max(1, +req.query.limit || 200));
    const offset = Math.max(0, +req.query.offset || 0);   // lật trang -> với tới dòng cũ
    const where = [], params = [];
    if (req.query.user) { params.push('%' + req.query.user + '%'); where.push(`username ILIKE $${params.length}`); }
    if (req.query.method) { params.push(req.query.method.toUpperCase()); where.push(`method = $${params.length}`); }
    // Lọc theo khoảng ngày (from/to là YYYY-MM-DD). to là trọn ngày -> so < to + 1 ngày.
    if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '')) { params.push(req.query.from); where.push(`at >= $${params.length}::date`); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '')) { params.push(req.query.to); where.push(`at < ($${params.length}::date + 1)`); }
    if (req.query.path) { params.push('%' + req.query.path + '%'); where.push(`path ILIKE $${params.length}`); }
    const sqlWhere = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const total = (await query(`SELECT COUNT(*)::int c FROM audit_log ${sqlWhere}`, params)).rows[0].c;
    params.push(limit); const pLimit = params.length;
    params.push(offset); const pOffset = params.length;
    const { rows } = await query(
      `SELECT * FROM audit_log ${sqlWhere} ORDER BY at DESC LIMIT $${pLimit} OFFSET $${pOffset}`, params);
    res.json({ total, limit, offset, rows });
  } catch (e) { next(e); }
});

/* ---------- Quản lý tài khoản nhân viên ---------- */
const ROLE = r => (['admin', 'staff', 'maintenance'].includes(r) ? r : 'staff');

router.get('/users', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, username, role, full_name, created_at FROM users
       WHERE role IN ('admin','staff','maintenance') AND deleted_at IS NULL ORDER BY role, username`);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/users', async (req, res, next) => {
  try {
    const username = (req.body.username || '').trim();
    const password = (req.body.password || '').trim();
    if (!username) return res.status(400).json({ error: 'Nhập tên đăng nhập' });
    const loiMk = checkPassword(password, [username, req.body.full_name]);
    if (loiMk) return res.status(400).json({ error: loiMk });
    const dup = await query('SELECT 1 FROM users WHERE lower(username)=lower($1)', [username]);
    if (dup.rows.length) return res.status(400).json({ error: `Tên đăng nhập "${username}" đã tồn tại` });
    // Tài khoản do quản trị tạo -> buộc nhân viên đổi mật khẩu ở lần đăng nhập đầu
    const { rows } = await query(
      `INSERT INTO users (username, password_hash, role, full_name, must_change_password)
       VALUES ($1,$2,$3,$4,true) RETURNING id, username, role, full_name`,
      [username, bcrypt.hashSync(password, 10), ROLE(req.body.role), (req.body.full_name || '').trim()]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/users/:id', async (req, res, next) => {
  try {
    const id = +req.params.id;
    if (id === req.user.id && req.body.role && req.body.role !== 'admin')
      return res.status(400).json({ error: 'Không thể tự hạ quyền chính mình' });
    const { rows } = await query(
      `UPDATE users SET full_name=$1, role=$2 WHERE id=$3 AND role IN ('admin','staff','maintenance') RETURNING id`,
      [(req.body.full_name || '').trim(), ROLE(req.body.role), id]);
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
    // Đổi vai trò -> THU HỒI vé cũ ngay. Nếu không, người vừa bị giáng chức vẫn giữ quyền admin 30 ngày.
    await revokeTokens(id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/users/:id/password', async (req, res, next) => {
  try {
    const password = (req.body.password || '').trim();
    const uNow = (await query('SELECT username, full_name FROM users WHERE id=$1', [req.params.id])).rows[0] || {};
    const loiMk = checkPassword(password, [uNow.username, uNow.full_name]);
    if (loiMk) return res.status(400).json({ error: loiMk });
    // Đặt lại mật khẩu -> buộc người dùng đổi lại ở lần đăng nhập kế tiếp
    await query('UPDATE users SET password_hash=$1, must_change_password=true WHERE id=$2', [bcrypt.hashSync(password, 10), req.params.id]);
    await revokeTokens(+req.params.id); // đá mọi phiên đang mở của tài khoản đó
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    const id = +req.params.id;
    if (id === req.user.id) return res.status(400).json({ error: 'Không thể xóa chính mình' });
    const admins = (await query("SELECT COUNT(*)::int c FROM users WHERE role='admin' AND deleted_at IS NULL")).rows[0].c;
    const target = (await query('SELECT role FROM users WHERE id=$1', [id])).rows[0];
    if (target && target.role === 'admin' && admins <= 1) return res.status(400).json({ error: 'Phải còn ít nhất 1 quản trị viên' });
    // Vô hiệu hóa (xóa mềm) — giữ lại lịch sử thao tác của tài khoản
    await query("UPDATE users SET deleted_at=now() WHERE id=$1 AND role IN ('admin','staff','maintenance')", [id]);
    await revokeTokens(id); // đá ngay mọi phiên đang mở của tài khoản vừa bị vô hiệu hoá
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
