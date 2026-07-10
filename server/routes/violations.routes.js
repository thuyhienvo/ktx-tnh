const express = require('express');
const { query, getSettings } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { sendViolationMail, mailStatus } = require('../mailer');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

const SEV = v => (['minor', 'major', 'severe'].includes(v) ? v : 'minor');

/* ---------- Danh mục loại vi phạm ---------- */
router.get('/types', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM violation_types ORDER BY sort, id');
    res.json(rows);
  } catch (e) { next(e); }
});
router.post('/types', async (req, res, next) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Nhập tên loại vi phạm' });
    const mx = await query('SELECT COALESCE(MAX(sort),0)+1 AS s FROM violation_types');
    const { rows } = await query('INSERT INTO violation_types (name, severity, sort) VALUES ($1,$2,$3) RETURNING *',
      [name, SEV(req.body.severity), mx.rows[0].s]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});
router.put('/types/:id', async (req, res, next) => {
  try {
    const { rows } = await query('UPDATE violation_types SET name=$1, severity=$2, active=$3 WHERE id=$4 RETURNING *',
      [(req.body.name || '').trim(), SEV(req.body.severity), req.body.active !== false, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});
router.delete('/types/:id', async (req, res, next) => {
  try { await query('DELETE FROM violation_types WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { next(e); }
});

/* ---------- Trạng thái gửi mail (để cảnh báo trên UI) ---------- */
router.get('/mail-status', async (req, res, next) => {
  try { res.json(await mailStatus()); } catch (e) { next(e); }
});

/* ---------- Thống kê vi phạm ---------- */
router.get('/stats', async (req, res, next) => {
  try {
    const s = await getSettings();
    const threshold = +s.violation_mail_threshold || 3;
    const year = (req.query.year || new Date().toISOString().slice(0, 4));

    const total = (await query('SELECT COUNT(*)::int c FROM violations')).rows[0].c;
    const bySeverity = (await query(`SELECT severity, COUNT(*)::int c FROM violations GROUP BY severity`)).rows;
    const byType = (await query(`SELECT type_name, COUNT(*)::int c FROM violations GROUP BY type_name ORDER BY c DESC`)).rows;
    const byMonth = (await query(
      `SELECT to_char(date,'YYYY-MM') AS month, COUNT(*)::int c FROM violations
       WHERE to_char(date,'YYYY')=$1 GROUP BY month ORDER BY month`, [String(year)])).rows;
    // Học viên theo số lần vi phạm (kèm cảnh báo ngưỡng gửi nhà trường)
    const byStudent = (await query(
      `SELECT s.id, s.name, s.code, s.class_name, r.name AS room_name,
        COUNT(v.id)::int AS cnt,
        MAX(v.date) AS last_date,
        BOOL_OR(v.notified_school) AS notified
       FROM violations v JOIN students s ON s.id=v.student_id
       LEFT JOIN rooms r ON r.id=s.room_id
       GROUP BY s.id, s.name, s.code, s.class_name, r.name
       ORDER BY cnt DESC, last_date DESC`)).rows;
    const needMail = byStudent.filter(x => x.cnt >= threshold && !x.notified).length;
    res.json({ threshold, total, bySeverity, byType, byMonth, byStudent, needMail });
  } catch (e) { next(e); }
});

/* ---------- Vi phạm theo học viên ---------- */
router.get('/student/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM violations WHERE student_id=$1 ORDER BY date DESC, id DESC', [req.params.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

/* ---------- Danh sách tất cả vi phạm ---------- */
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT v.*, s.name AS student_name, s.code AS student_code, r.name AS room_name
      FROM violations v JOIN students s ON s.id=v.student_id
      LEFT JOIN rooms r ON r.id=s.room_id
      ORDER BY v.date DESC, v.id DESC`);
    res.json(rows);
  } catch (e) { next(e); }
});

/* ---------- Ghi nhận vi phạm mới ---------- */
router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    const student = (await query('SELECT id, name, code, class_name, phone FROM students WHERE id=$1', [b.student_id])).rows[0];
    if (!student) return res.status(404).json({ error: 'Không tìm thấy học viên' });

    // Loại vi phạm: lấy tên + mức độ (từ danh mục nếu có type_id)
    let typeName = (b.type_name || '').trim(), severity = SEV(b.severity), typeId = b.type_id || null;
    if (typeId) {
      const t = (await query('SELECT * FROM violation_types WHERE id=$1', [typeId])).rows[0];
      if (t) { typeName = t.name; severity = t.severity; }
    }
    if (!typeName) return res.status(400).json({ error: 'Chọn loại vi phạm' });

    const date = b.date || new Date().toISOString().slice(0, 10);
    const level = (await query('SELECT COUNT(*)::int c FROM violations WHERE student_id=$1', [b.student_id])).rows[0].c + 1;

    const { rows } = await query(
      `INSERT INTO violations (student_id, type_id, type_name, severity, level, date, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [b.student_id, typeId, typeName, severity, level, date, b.note || '']
    );
    const violation = rows[0];

    // Đến ngưỡng (mặc định lần 3) → gửi mail nhà trường
    const s = await getSettings();
    const threshold = +s.violation_mail_threshold || 3;
    let mail = null;
    if (level >= threshold) {
      const all = (await query('SELECT * FROM violations WHERE student_id=$1 ORDER BY date, id', [b.student_id])).rows;
      mail = await sendViolationMail(student, all);
      if (mail.sent) {
        await query(`UPDATE violations SET notified_school=true, notified_at=now() WHERE student_id=$1`, [b.student_id]);
      }
    }
    res.status(201).json({ violation, level, threshold, mail });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body;
    const { rows } = await query(
      `UPDATE violations SET note=$1, admin_note=$2, status=$3 WHERE id=$4 RETURNING *`,
      [b.note || '', b.admin_note || '', b.status === 'resolved' ? 'resolved' : 'open', req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try { await query('DELETE FROM violations WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { next(e); }
});

// Gửi (lại) mail nhà trường thủ công cho 1 học viên
router.post('/student/:id/notify', async (req, res, next) => {
  try {
    const student = (await query('SELECT id, name, code, class_name, phone FROM students WHERE id=$1', [req.params.id])).rows[0];
    if (!student) return res.status(404).json({ error: 'Không tìm thấy học viên' });
    const all = (await query('SELECT * FROM violations WHERE student_id=$1 ORDER BY date, id', [req.params.id])).rows;
    if (!all.length) return res.status(400).json({ error: 'Học viên chưa có vi phạm nào' });
    const mail = await sendViolationMail(student, all);
    if (mail.sent) await query(`UPDATE violations SET notified_school=true, notified_at=now() WHERE student_id=$1`, [req.params.id]);
    res.json({ mail });
  } catch (e) { next(e); }
});

module.exports = router;
