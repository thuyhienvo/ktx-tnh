const express = require('express');
const bcrypt = require('bcryptjs');
const { query, pool, getSettings } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin', 'staff'));

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT a.*, f.name AS facility_name FROM applications a
      LEFT JOIN facilities f ON f.id = a.facility_id
      ORDER BY (a.status='pending') DESC, a.created_at DESC`);
    res.json(rows);
  } catch (e) { next(e); }
});

// Ghi chú của quản lý cho đơn đăng ký
router.put('/:id/note', async (req, res, next) => {
  try {
    const { rows } = await query('UPDATE applications SET admin_note=$1 WHERE id=$2 RETURNING id', [req.body.note || '', req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy đơn' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Duyệt đơn: tạo học viên từ đơn + xếp phòng + (tùy chọn) tạo tài khoản
router.post('/:id/approve', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const app = (await client.query('SELECT * FROM applications WHERE id=$1', [req.params.id])).rows[0];
    if (!app) return res.status(404).json({ error: 'Không tìm thấy đơn' });
    if (app.status === 'approved') return res.status(400).json({ error: 'Đơn đã được duyệt' });

    const b = req.body; // room_id, check_in_date, create_login, deposit_paid, deposit_amount, contract_no/date/status, rental_type
    const checkIn = b.check_in_date || new Date().toISOString().slice(0, 10);
    const settings = await getSettings();
    const takeDeposit = !!b.deposit_paid;
    const depositAmt = b.deposit_amount != null ? +b.deposit_amount : (+settings.deposit_fee || 0);
    const cStatus = ['done', 'scanned', 'unsigned', 'none'].includes(b.contract_status) ? b.contract_status : 'unsigned';

    const { rows } = await client.query(
      `INSERT INTO students (code, name, gender, phone, birth_date, class_name, room_id, check_in_date, status, note,
         rental_type, residency_status, contract_no, contract_date, contract_status, uses_washing, deposit_amount, deposit_status, deposit_date,
         cccd_front, cccd_back)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'in',$9,$10,'unregistered',$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [app.code || '', app.name, app.gender, app.phone, app.birth_date, app.class_name,
       b.room_id || null, checkIn, app.note || '', b.rental_type || app.rental_type || 'ghep',
       b.contract_no || '', b.contract_date || null, cStatus,
       !!app.wants_washing, takeDeposit ? depositAmt : 0, takeDeposit ? 'held' : 'none', takeDeposit ? checkIn : null,
       app.cccd_front || null, app.cccd_back || null]
    );
    const student = rows[0];
    await client.query(`INSERT INTO logs (student_id, type, date, room_id, note, source) VALUES ($1,'in',$2,$3,'Duyệt đơn & vào ở','admin')`,
      [student.id, checkIn, b.room_id || null]);

    // Tự thêm xe vào DS xe nếu học viên đăng ký gửi xe
    if (app.wants_parking || (app.plate && app.plate.trim())) {
      await client.query(`INSERT INTO vehicles (student_id, plate) VALUES ($1,$2)`, [student.id, app.plate || '']);
    }

    let account = null;
    if (b.create_login) {
      const uname = (b.login_username || app.phone || app.code || '').trim();
      const pass = (b.login_password || '').trim();
      if (!uname) return res.status(400).json({ error: 'Cần tên đăng nhập' });
      if (pass.length < 4) return res.status(400).json({ error: 'Mật khẩu tối thiểu 4 ký tự' });
      const dup = await client.query('SELECT 1 FROM users WHERE lower(username)=lower($1)', [uname]);
      if (dup.rows.length) return res.status(400).json({ error: `Tên đăng nhập "${uname}" đã tồn tại` });
      await client.query(`INSERT INTO users (username, password_hash, role, full_name, student_id) VALUES ($1,$2,'student',$3,$4)`,
        [uname, bcrypt.hashSync(pass, 10), app.name, student.id]);
      account = { username: uname, password: pass };
    }

    await client.query(`UPDATE applications SET status='approved', student_id=$1, reviewed_at=now() WHERE id=$2`, [student.id, app.id]);
    await client.query('COMMIT');
    res.json({ ok: true, student, account });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

router.post('/:id/reject', async (req, res, next) => {
  try {
    await query(`UPDATE applications SET status='rejected', reviewed_at=now() WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try { await query('DELETE FROM applications WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { next(e); }
});

module.exports = router;
