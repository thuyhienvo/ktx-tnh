const express = require('express');
const bcrypt = require('bcryptjs');
const { query, pool, getSettings } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { depositRefundEligible } = require('../billing');
const { recalcInvoice } = require('../invoice-calc');

const router = express.Router();
router.use(requireAuth);

// Danh sách (không kèm ảnh CCCD cho nhẹ)
const LIST_SELECT = `
  SELECT s.id, s.code, s.name, s.gender, s.phone, s.id_card, s.room_id, s.check_in_date, s.check_out_date,
    s.status, s.note, s.uses_washing, s.deposit_amount, s.deposit_status, s.deposit_date, s.deposit_refund_date,
    s.checkout_notice_date, s.checkout_reason, s.birth_date, s.class_name, s.rental_type, s.residency_status,
    s.contract_no, s.contract_date, s.contract_status, s.deposit_bank, s.deposit_account,
    (s.cccd_front IS NOT NULL OR s.cccd_image IS NOT NULL) AS has_cccd,
    r.name AS room_name, r.floor AS room_floor, r.gender AS room_gender, r.hang AS room_hang,
    u.username AS login_username,
    (SELECT COUNT(*) FROM vehicles v WHERE v.student_id=s.id)::int AS vehicle_count,
    (SELECT COALESCE(SUM(i.total),0)::int FROM invoices i WHERE i.student_id=s.id AND i.status<>'paid') AS debt
  FROM students s
  LEFT JOIN rooms r ON r.id = s.room_id
  LEFT JOIN users u ON u.student_id = s.id`;

const CONTRACT = c => (['done', 'scanned', 'unsigned', 'none'].includes(c) ? c : 'unsigned');
const RENTAL = t => (t === 'phong' ? 'phong' : 'ghep');
const RESIDENCY = r => (r === 'registered' ? 'registered' : 'unregistered');
const D = v => (v ? v : null);

router.get('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await query(`${LIST_SELECT} ORDER BY s.name`);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT s.*, r.name AS room_name, r.floor AS room_floor, r.gender AS room_gender, r.hang AS room_hang,
        u.username AS login_username,
        (SELECT COALESCE(SUM(i.total),0)::int FROM invoices i WHERE i.student_id=s.id AND i.status<>'paid') AS debt
      FROM students s
      LEFT JOIN rooms r ON r.id = s.room_id
      LEFT JOIN users u ON u.student_id = s.id
      WHERE s.id=$1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy học viên' });
    const veh = await query('SELECT * FROM vehicles WHERE student_id=$1 ORDER BY id', [req.params.id]);
    rows[0].vehicles = veh.rows;
    res.json(rows[0]);
  } catch (e) { next(e); }
});

function studentFields(b) {
  return [
    b.code || '', (b.name || '').trim(), b.gender === 'female' ? 'female' : 'male', b.phone || '', b.id_card || '',
    D(b.birth_date), b.class_name || '', b.room_id || null, D(b.check_in_date), b.note || '',
    !!b.uses_washing, RENTAL(b.rental_type), RESIDENCY(b.residency_status),
    b.contract_no || '', D(b.contract_date), CONTRACT(b.contract_status), b.cccd_image || null,
  ];
}

router.post('/', requireRole('admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = req.body;
    if (!b.name || !b.name.trim()) return res.status(400).json({ error: 'Nhập họ tên học viên' });
    const checkIn = b.check_in_date || new Date().toISOString().slice(0, 10);
    const checkOut = b.check_out_date || null;
    const todayStr = new Date().toISOString().slice(0, 10);
    const status = checkOut && checkOut <= todayStr ? 'out' : 'in';
    const settings = await getSettings();
    const takeDeposit = !!b.deposit_paid;
    const depositFee = +settings.deposit_fee || 0;

    const f = studentFields({ ...b, check_in_date: checkIn });
    const { rows } = await client.query(
      `INSERT INTO students
        (code, name, gender, phone, id_card, birth_date, class_name, room_id, check_in_date, note,
         uses_washing, rental_type, residency_status, contract_no, contract_date, contract_status, cccd_image,
         status, check_out_date, deposit_amount, deposit_status, deposit_date, cccd_front, cccd_back, checkout_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) RETURNING *`,
      [...f, status, checkOut, takeDeposit ? depositFee : 0, takeDeposit ? 'held' : 'none', takeDeposit ? checkIn : null,
       b.cccd_front || null, b.cccd_back || null,
       (checkOut && ['departure', 'personal', 'facility', 'other'].includes(b.checkout_reason)) ? b.checkout_reason : (checkOut ? 'other' : null)]
    );
    const student = rows[0];

    await client.query(
      `INSERT INTO logs (student_id, type, date, room_id, note, source) VALUES ($1,'in',$2,$3,'Đăng ký & vào ở','admin')`,
      [student.id, checkIn, b.room_id || null]
    );

    if (b.create_login) {
      const uname = (b.login_username || b.code || '').trim();
      const pass = (b.login_password || '').trim();
      if (!uname) return res.status(400).json({ error: 'Cần tên đăng nhập (hoặc mã HV) để tạo tài khoản' });
      if (pass.length < 4) return res.status(400).json({ error: 'Mật khẩu tài khoản tối thiểu 4 ký tự' });
      const dup = await client.query('SELECT 1 FROM users WHERE lower(username)=lower($1)', [uname]);
      if (dup.rows.length) return res.status(400).json({ error: `Tên đăng nhập "${uname}" đã tồn tại` });
      await client.query(
        `INSERT INTO users (username, password_hash, role, full_name, student_id) VALUES ($1,$2,'student',$3,$4)`,
        [uname, bcrypt.hashSync(pass, 10), b.name.trim(), student.id]
      );
    }
    await client.query('COMMIT');
    res.status(201).json(student);
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

router.put('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const b = req.body;
    const f = studentFields(b);
    const cols = `code=$1, name=$2, gender=$3, phone=$4, id_card=$5, birth_date=$6, class_name=$7, room_id=$8,
      check_in_date=$9, note=$10, uses_washing=$11, rental_type=$12, residency_status=$13,
      contract_no=$14, contract_date=$15, contract_status=$16`;
    const params = f.slice(0, 16);
    let extra = '';
    // Ảnh CCCD: chỉ cập nhật nếu gửi kèm (giữ ảnh cũ nếu bỏ trống)
    if (b.cccd_front !== undefined) { extra += `, cccd_front=$${params.length + 1}`; params.push(b.cccd_front || null); }
    if (b.cccd_back !== undefined) { extra += `, cccd_back=$${params.length + 1}`; params.push(b.cccd_back || null); }
    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE students SET ${cols}${extra} WHERE id=$${params.length} RETURNING *`, params);
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy học viên' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try { await query('DELETE FROM students WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { next(e); }
});

// Check-in
router.post('/:id/checkin', requireRole('admin'), async (req, res, next) => {
  try {
    const { date, room_id, note } = req.body;
    const d = date || new Date().toISOString().slice(0, 10);
    const { rows } = await query(
      `UPDATE students SET status='in', room_id=$1, check_in_date=$2, check_out_date=NULL,
         checkout_notice_date=NULL, checkout_reason=NULL WHERE id=$3 RETURNING *`,
      [room_id || null, d, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy học viên' });
    await query(`INSERT INTO logs (student_id, type, date, room_id, note, source) VALUES ($1,'in',$2,$3,$4,'admin')`,
      [req.params.id, d, room_id || null, note || 'Check-in']);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Check-out (kèm ngày báo + lý do, tự xét hoàn cọc)
router.post('/:id/checkout', requireRole('admin'), async (req, res, next) => {
  try {
    const { date, notice_date, reason, note } = req.body;
    const d = date || new Date().toISOString().slice(0, 10);
    const rs = ['departure', 'personal', 'facility', 'other'].includes(reason) ? reason : 'other';
    const cur = await query('SELECT room_id FROM students WHERE id=$1', [req.params.id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Không tìm thấy học viên' });
    const elig = depositRefundEligible({ noticeDate: notice_date || null, checkoutDate: d, reason: rs });
    const { rows } = await query(
      `UPDATE students SET status='out', check_out_date=$1, checkout_notice_date=$2, checkout_reason=$3 WHERE id=$4 RETURNING *`,
      [d, notice_date || null, rs, req.params.id]
    );
    await query(`INSERT INTO logs (student_id, type, date, room_id, note, source) VALUES ($1,'out',$2,$3,$4,'admin')`,
      [req.params.id, d, cur.rows[0].room_id || null, note || 'Check-out']);
    // Tính lại hóa đơn tháng trả phòng theo số ngày ở thực tế (nếu đã lập)
    let recalced = null;
    try { recalced = await recalcInvoice(req.params.id, d.slice(0, 7)); } catch (e) {}
    res.json({ student: rows[0], refund: elig, recalced });
  } catch (e) { next(e); }
});

// Chuyển phòng
router.post('/:id/transfer', requireRole('admin'), async (req, res, next) => {
  try {
    const { room_id, date, note } = req.body;
    if (!room_id) return res.status(400).json({ error: 'Chọn phòng mới' });
    const d = date || new Date().toISOString().slice(0, 10);
    const cur = await query('SELECT room_id FROM students WHERE id=$1', [req.params.id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Không tìm thấy học viên' });
    const oldRoom = cur.rows[0].room_id;
    const { rows } = await query(`UPDATE students SET room_id=$1 WHERE id=$2 RETURNING *`, [room_id, req.params.id]);
    const oldName = oldRoom ? (await query('SELECT name FROM rooms WHERE id=$1', [oldRoom])).rows[0]?.name : '—';
    const newName = (await query('SELECT name FROM rooms WHERE id=$1', [room_id])).rows[0]?.name;
    await query(`INSERT INTO logs (student_id, type, date, room_id, note, source) VALUES ($1,'in',$2,$3,$4,'admin')`,
      [req.params.id, d, room_id, note || `Chuyển phòng ${oldName} → ${newName}`]);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Ghi nhận đóng cọc
router.post('/:id/deposit', requireRole('admin'), async (req, res, next) => {
  try {
    const settings = await getSettings();
    const amount = req.body.amount != null ? +req.body.amount : (+settings.deposit_fee || 0);
    const date = req.body.date || new Date().toISOString().slice(0, 10);
    const { rows } = await query(
      `UPDATE students SET deposit_amount=$1, deposit_status='held', deposit_date=$2, deposit_refund_date=NULL WHERE id=$3 RETURNING *`,
      [amount, date, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy học viên' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Xử lý cọc khi trả phòng: hoàn (kèm STK/ngân hàng + khấu trừ hư hao) hoặc giữ cọc
router.post('/:id/deposit-settle', requireRole('admin'), async (req, res, next) => {
  try {
    const action = req.body.action === 'refund' ? 'refunded' : 'forfeited';
    const date = req.body.date || new Date().toISOString().slice(0, 10);
    const deduction = +req.body.deduction || 0;
    const { rows } = await query(
      `UPDATE students SET deposit_status=$1, deposit_refund_date=$2, deposit_bank=$3, deposit_account=$4,
         deposit_deduction=$5, deposit_deduction_note=$6 WHERE id=$7 RETURNING *`,
      [action, date, req.body.bank || '', req.body.account || '', deduction, req.body.deduction_note || '', req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy học viên' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Tài khoản đăng nhập
router.post('/:id/account', requireRole('admin'), async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!password || password.length < 4) return res.status(400).json({ error: 'Mật khẩu tối thiểu 4 ký tự' });
    const st = await query('SELECT * FROM students WHERE id=$1', [req.params.id]);
    if (!st.rows[0]) return res.status(404).json({ error: 'Không tìm thấy học viên' });
    const existing = await query('SELECT * FROM users WHERE student_id=$1', [req.params.id]);
    const hash = bcrypt.hashSync(password, 10);
    if (existing.rows[0]) {
      await query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, existing.rows[0].id]);
      res.json({ ok: true, username: existing.rows[0].username });
    } else {
      const uname = (username || st.rows[0].code || '').trim();
      if (!uname) return res.status(400).json({ error: 'Cần tên đăng nhập' });
      const dup = await query('SELECT 1 FROM users WHERE lower(username)=lower($1)', [uname]);
      if (dup.rows.length) return res.status(400).json({ error: `Tên đăng nhập "${uname}" đã tồn tại` });
      await query(`INSERT INTO users (username, password_hash, role, full_name, student_id) VALUES ($1,$2,'student',$3,$4)`,
        [uname, hash, st.rows[0].name, req.params.id]);
      res.json({ ok: true, username: uname });
    }
  } catch (e) { next(e); }
});

module.exports = router;
