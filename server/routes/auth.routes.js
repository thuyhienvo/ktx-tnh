const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { query } = db;
const { signToken, requireAuth, setAuthCookie, clearAuthCookie, revokeTokens, readToken } = require('../auth');
const { checkPassword } = require('../valid');
const guard = require('../login-guard');
const jwt = require('jsonwebtoken');

const router = express.Router();

const publicUser = u => ({
  id: u.id, username: u.username, role: u.role, full_name: u.full_name,
  student_id: u.student_id, must_change_password: !!u.must_change_password,
});

// Cổng đăng nhập nào nhận vai nào.
// LƯU Ý: đây là RÀO CHẮN CHỈ ĐƯỜNG, KHÔNG PHẢI LỚP BẢO MẬT — cổng do client tự khai,
// ai cầm mật khẩu học viên chỉ cần khai cổng 'student' là qua. Giá trị của nó là:
// người gõ nhầm cổng được báo đúng chỗ cần đi, thay vì hệ thống lặng lẽ lờ đi lựa chọn của họ.
// Quyền thật vẫn do requireRole ở từng route quyết định, đọc lại vai từ CSDL mỗi lần gọi.
const CONG = {
  admin: { vai: ['admin', 'staff', 'maintenance'], ten: 'Ban quản lý' },
  student: { vai: ['student'], ten: 'Học viên' },
};

// Đăng nhập — đặt token vào cookie httpOnly, KHÔNG trả token cho client
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Nhập tên đăng nhập và mật khẩu' });
    const now = Date.now();

    // Tài khoản này có đang bị khoá vì sai quá nhiều lần không? Kiểm TRƯỚC khi so mật khẩu.
    const khoa = guard.truocKhiThu(username, now);
    if (khoa.khoa) {
      const phut = Math.ceil(khoa.conLai / 60);
      await guard.ghiNhatKyDangNhap(db.pool, { username: username.trim(), req, ketQua: 'bị khoá (đang trong thời gian khoá)' });
      return res.status(429).json({ error: `Tài khoản tạm khoá do đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ${phut} phút.` });
    }

    const { rows } = await query('SELECT * FROM users WHERE lower(username) = lower($1) AND deleted_at IS NULL', [username.trim()]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      const { khoaMoi } = guard.ghiNhanKetQua(username, false, now);
      await guard.ghiNhatKyDangNhap(db.pool, { user: user || null, username: username.trim(), req, ketQua: khoaMoi ? 'SAI mật khẩu — vượt ngưỡng, KHOÁ tài khoản' : 'SAI mật khẩu' });
      if (khoaMoi) return res.status(429).json({ error: `Đăng nhập sai quá nhiều lần. Tài khoản tạm khoá ${Math.round(guard.KHOA_MS / 60000)} phút để bảo vệ.` });
      return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });
    }
    // Học viên đã bị xoá hồ sơ (deleted_at) thì không cho đăng nhập nữa
    if (user.role === 'student' && user.student_id) {
      const s = (await query('SELECT 1 FROM students WHERE id=$1 AND deleted_at IS NULL', [user.student_id])).rows[0];
      if (!s) {
        await guard.ghiNhatKyDangNhap(db.pool, { user, req, ketQua: 'tài khoản học viên đã bị xoá hồ sơ' });
        return res.status(401).json({ error: 'Tài khoản không còn hiệu lực' });
      }
    }
    // Đúng cổng chưa? Kiểm SAU khi đã xác thực mật khẩu — nếu kiểm trước thì câu báo lỗi
    // vô tình nói cho người lạ biết "tên đăng nhập này là tài khoản học viên", tức là
    // biến ô đăng nhập thành máy dò xem tài khoản nào tồn tại và thuộc loại gì.
    const cong = CONG[req.body.portal];
    if (cong && !cong.vai.includes(user.role)) {
      // Mật khẩu ĐÚNG, chỉ nhầm cổng -> KHÔNG tính là lần sai, xoá bộ đếm.
      guard.ghiNhanKetQua(username, true, now);
      const dung = user.role === 'student' ? 'student' : 'admin';
      return res.status(403).json({
        error: `Đây là tài khoản ${CONG[dung].ten.toLowerCase()}. Vui lòng đăng nhập ở cổng "${CONG[dung].ten}".`,
        portal: dung,
      });
    }
    // Thành công: xoá bộ đếm sai, ghi nhật ký, cấp vé.
    guard.ghiNhanKetQua(username, true, now);
    await guard.ghiNhatKyDangNhap(db.pool, { user, req, ketQua: 'đăng nhập thành công' });
    setAuthCookie(res, signToken(user));
    res.json({ user: publicUser(user) });
  } catch (e) { next(e); }
});

// Đăng xuất — THU HỒI vé (không chỉ xoá cookie ở máy client).
// Trước đây chỉ clearCookie -> ai đã copy được token thì vẫn dùng tiếp 30 ngày sau khi chủ tài khoản đăng xuất.
router.post('/logout', async (req, res) => {
  try {
    const t = readToken(req);
    if (t) { const p = jwt.verify(t, require('../auth').JWT_SECRET); await revokeTokens(p.id); }
  } catch (e) { /* token hỏng/hết hạn -> không cần thu hồi */ }
  clearAuthCookie(res);
  res.json({ ok: true });
});

// Thông tin người đang đăng nhập (dùng khi tải lại trang — nguồn xác thực là cookie)
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT id, username, role, full_name, student_id, must_change_password FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0]) return res.status(401).json({ error: 'Tài khoản không tồn tại' });
    res.json(publicUser(rows[0]));
  } catch (e) { next(e); }
});

// Đổi mật khẩu (chính mình) — xóa cờ bắt buộc đổi mật khẩu sau khi thành công
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = rows[0];
    const loiMk = checkPassword(newPassword, [user.username, user.full_name]);
    if (loiMk) return res.status(400).json({ error: 'Mật khẩu mới: ' + loiMk.charAt(0).toLowerCase() + loiMk.slice(1) });
    if (!bcrypt.compareSync(oldPassword || '', user.password_hash)) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
    }
    if (bcrypt.compareSync(newPassword, user.password_hash)) {
      return res.status(400).json({ error: 'Mật khẩu mới phải khác mật khẩu hiện tại' });
    }
    await query('UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2',
      [bcrypt.hashSync(newPassword, 10), user.id]);
    // Đổi mật khẩu -> thu hồi mọi vé cũ (ai đang dùng token cũ bị đá ra), rồi cấp vé mới cho CHÍNH phiên này
    await revokeTokens(user.id);
    const fresh = (await query('SELECT id, username, role, student_id, token_epoch FROM users WHERE id=$1', [user.id])).rows[0];
    setAuthCookie(res, signToken(fresh));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
