const express = require('express');
const bcrypt = require('bcryptjs');
const { query, withTransaction, getSettings } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { depositRefundEligible } = require('../billing');
const { recalcInvoice } = require('../invoice-calc');
const storage = require('../storage');
const { cccdUrls, SIDE_COL } = require('../cccd-url');
const { isValidYmd, isValidPhone, rejectUnknown } = require('../valid');
const DATE_FIELDS = ['birth_date', 'check_in_date', 'check_out_date', 'contract_date', 'deposit_date', 'class_start_date', 'expected_departure', 'checkout_notice_date'];

const router = express.Router();
router.use(requireAuth);

const CCCD_FIELDS = ['cccd_front', 'cccd_back', 'cccd_image'];
const signCccd = row => cccdUrls(row); // trả URL proxy cho các cột CCCD

// Ảnh CCCD -> S3 (bucket riêng tư). Lưu KEY vào DB, KHÔNG lưu base64.
// value: data URL ảnh mới -> upload; '' hoặc null -> xóa object cũ; key cũ -> giữ; undefined -> không đổi.
const isCccdKey = k => typeof k === 'string' && /^(students|applications)\//.test(k);
async function resolveCccd(studentId, field, value, oldKey) {
  if (value === undefined) return undefined;
  if (!value) {
    if (isCccdKey(oldKey)) await storage.deleteObject(storage.CCCD_BUCKET, oldKey).catch(() => {});
    return null;
  }
  if (isCccdKey(value)) return value; // đã là key hợp lệ (giữ nguyên khi không đổi ảnh)
  if (!/^data:image\//.test(value)) return undefined; // giá trị lạ (không phải ảnh/không phải key) -> bỏ qua, không ghi rác
  const p = storage.parseDataUrl(value);
  if (!p) { const e = new Error('Ảnh CCCD không hợp lệ (chỉ nhận JPG/PNG/WEBP/GIF)'); e.status = 400; throw e; }
  const key = `students/${studentId}/${field}.${p.ext}`;
  await storage.putDataUrl(storage.CCCD_BUCKET, key, value);
  if (isCccdKey(oldKey) && oldKey !== key) await storage.deleteObject(storage.CCCD_BUCKET, oldKey).catch(() => {});
  return key;
}

// Proxy ảnh CCCD (bucket riêng tư): admin/staff hoặc chính học viên đó. Ảnh chảy S3 -> app -> client.
router.get('/:id/cccd/:side', async (req, res, next) => {
  try {
    const col = SIDE_COL[req.params.side];
    if (!col) return res.status(404).end();
    const isStaff = ['admin', 'staff'].includes(req.user.role);
    if (!isStaff && req.user.student_id !== +req.params.id) return res.status(403).end();
    // Không phục vụ ảnh của học viên đã xóa mềm (bảo vệ PII)
    const row = (await query(`SELECT ${col} AS k FROM students WHERE id=$1 AND deleted_at IS NULL`, [req.params.id])).rows[0];
    if (!row || !row.k) return res.status(404).end();
    const obj = await storage.getObject(storage.CCCD_BUCKET, row.k);
    res.set('Content-Type', obj.contentType || 'image/jpeg');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'private, max-age=300');
    obj.body.pipe(res);
  } catch (e) { res.status(404).end(); }
});

// Danh sách (không kèm ảnh CCCD cho nhẹ)
const LIST_SELECT = `
  SELECT s.id, s.code, s.name, s.gender, s.phone, s.id_card, s.room_id, s.check_in_date, s.check_out_date,
    s.status, s.note, s.uses_washing, s.deposit_amount, s.deposit_status, s.deposit_date, s.deposit_refund_date,
    s.checkout_notice_date, s.checkout_reason, s.birth_date, s.class_name, s.rental_type, s.residency_status,
    s.contract_no, s.contract_date, s.contract_status, s.deposit_bank, s.deposit_account,
    s.class_start_date, s.expected_departure, s.parent_phone,
    (s.cccd_front IS NOT NULL OR s.cccd_back IS NOT NULL OR s.cccd_image IS NOT NULL) AS has_cccd,
    r.name AS room_name, r.floor AS room_floor, r.gender AS room_gender, r.hang AS room_hang,
    u.username AS login_username,
    (SELECT COUNT(*) FROM vehicles v WHERE v.student_id=s.id AND v.deleted_at IS NULL)::int AS vehicle_count,
    (SELECT COUNT(*) FROM violations vi WHERE vi.student_id=s.id AND vi.deleted_at IS NULL)::int AS violation_count
  FROM students s
  LEFT JOIN rooms r ON r.id = s.room_id
  LEFT JOIN users u ON u.student_id = s.id`;

const CONTRACT = c => (['done', 'scanned', 'unsigned', 'none', 'handover'].includes(c) ? c : 'unsigned');
const RENTAL = t => (t === 'phong' ? 'phong' : 'ghep');
const RESIDENCY = r => (['registered', 'processing'].includes(r) ? r : 'unregistered');
const D = v => (v ? v : null);

router.get('/', requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    const where = req.query.deleted === '1' ? 'WHERE s.deleted_at IS NOT NULL' : 'WHERE s.deleted_at IS NULL';
    const { rows } = await query(`${LIST_SELECT} ${where} ORDER BY s.name`);
    res.json(rows);
  } catch (e) { next(e); }
});

// ---- Số hợp đồng tự động theo pháp nhân + ngày ký (điểm 7 — ban thư ký quản lý HĐ) ----
const entityOf = (gender, st) => gender === 'female' ? (st.legal_female || 'E2') : (st.legal_male || 'S2');
const fmtContractNo = (seq, year, entity) => `${String(seq).padStart(2, '0')}/${year}/HDKTX-${entity}`;

// Gợi ý số HĐ kế tiếp cho 1 học viên (theo pháp nhân + ngày ký)
router.get('/contract-no/next', requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    const st = await getSettings();
    const gender = req.query.gender === 'female' ? 'female' : 'male';
    const entity = entityOf(gender, st);
    const date = (req.query.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const year = date.slice(0, 4);
    const n = (await query(
      `SELECT COUNT(*)::int c FROM students
       WHERE deleted_at IS NULL AND gender=$1 AND contract_no <> ''
         AND contract_date IS NOT NULL AND to_char(contract_date,'YYYY')=$2 AND contract_date <= $3`,
      [gender, year, date])).rows[0].c;
    res.json({ contract_no: fmtContractNo(n + 1, year, entity), entity, seq: n + 1, year });
  } catch (e) { next(e); }
});

// Đánh số lại toàn bộ HĐ theo ngày ký (ban thư ký chủ động bấm); dry=true chỉ xem trước, không ghi
router.post('/contract-no/renumber', requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    const st = await getSettings();
    const dry = !!req.body.dry;
    const { rows } = await query(
      `SELECT id, name, gender, contract_no, contract_date FROM students
       WHERE deleted_at IS NULL AND contract_date IS NOT NULL AND contract_status IN ('done','scanned')
       ORDER BY contract_date, id`);
    const counter = {};
    const plan = rows.map(r => {
      const entity = entityOf(r.gender, st);
      const year = String(r.contract_date).slice(0, 4);
      const key = entity + '|' + year;
      counter[key] = (counter[key] || 0) + 1;
      const nn = fmtContractNo(counter[key], year, entity);
      return { id: r.id, name: r.name, date: String(r.contract_date).slice(0, 10), entity, old: r.contract_no || '', new: nn, changed: (r.contract_no || '') !== nn };
    });
    if (!dry) {
      const changed = plan.filter(p => p.changed);
      await withTransaction(async (client) => {
        for (const p of changed) await client.query('UPDATE students SET contract_no=$1 WHERE id=$2', [p.new, p.id]);
      });
    }
    res.json({ total: plan.length, changed: plan.filter(p => p.changed).length, plan });
  } catch (e) { next(e); }
});

router.get('/:id', requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT s.*, r.name AS room_name, r.floor AS room_floor, r.gender AS room_gender, r.hang AS room_hang,
        u.username AS login_username
      FROM students s
      LEFT JOIN rooms r ON r.id = s.room_id
      LEFT JOIN users u ON u.student_id = s.id
      WHERE s.id=$1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy học viên' });
    const veh = await query('SELECT * FROM vehicles WHERE student_id=$1 ORDER BY id', [req.params.id]);
    rows[0].vehicles = veh.rows;
    const vio = await query('SELECT * FROM violations WHERE student_id=$1 AND deleted_at IS NULL ORDER BY date DESC, id DESC', [req.params.id]);
    rows[0].violations = vio.rows;
    res.json(await signCccd(rows[0]));
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

router.post('/', requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    const b = req.body;
    // ---- KIỂM TRA trước khi mở transaction (tránh rò transaction khi return sớm) ----
    if (!b.name || !b.name.trim()) return res.status(400).json({ error: 'Nhập họ tên học viên' });
    // SĐT: đơn đăng ký công khai đã kiểm 8–15 chữ số; form quản trị trước đây KHÔNG kiểm -> lưu được "abc", "123"
    if (b.phone != null && String(b.phone).trim() !== '' && !isValidPhone(b.phone))
      return res.status(400).json({ error: `Số điện thoại không hợp lệ: "${b.phone}" (cần 8–15 chữ số)` });
    if (b.parent_phone != null && String(b.parent_phone).trim() !== '' && !isValidPhone(b.parent_phone))
      return res.status(400).json({ error: `SĐT phụ huynh không hợp lệ: "${b.parent_phone}" (cần 8–15 chữ số)` });
    // Chặn ngày ảo (đúng format nhưng không có thật) → tránh sập 500
    for (const k of DATE_FIELDS) if (b[k] != null && b[k] !== '' && !isValidYmd(b[k])) return res.status(400).json({ error: `Ngày không hợp lệ (${k})` });
    if (isValidYmd(b.check_in_date) && isValidYmd(b.check_out_date) && b.check_out_date < b.check_in_date)
      return res.status(400).json({ error: 'Ngày trả phòng không thể trước ngày nhận phòng' });
    // KHÔNG chặn xếp vượt công suất: nghiệp vụ cho phép HV vào ở chờ bạn cùng phòng xuất cảnh.
    // Tình trạng quá tải được HIỂN THỊ cảnh báo ở Điều hành / Phòng để cấp trên nắm.
    let uname = null, pass = null;
    if (b.create_login) {
      uname = (b.login_username || b.code || '').trim();
      pass = (b.login_password || '').trim();
      if (!uname) return res.status(400).json({ error: 'Cần tên đăng nhập (hoặc mã HV) để tạo tài khoản' });
      if (pass.length < 4) return res.status(400).json({ error: 'Mật khẩu tài khoản tối thiểu 4 ký tự' });
      const dup = await query('SELECT 1 FROM users WHERE lower(username)=lower($1)', [uname]);
      if (dup.rows.length) return res.status(400).json({ error: `Tên đăng nhập "${uname}" đã tồn tại` });
    }

    const checkIn = b.check_in_date || new Date().toISOString().slice(0, 10);
    const checkOut = b.check_out_date || null;
    const todayStr = new Date().toISOString().slice(0, 10);
    const status = checkOut && checkOut <= todayStr ? 'out' : 'in';
    const settings = await getSettings();
    const takeDeposit = !!b.deposit_paid;
    const depositFee = +settings.deposit_fee || 0;
    const f = studentFields({ ...b, check_in_date: checkIn });
    f[16] = null; // cccd_image: upload sau khi có id (không lưu base64 vào DB)

    // ---- GHI trong 1 transaction (withTransaction đảm bảo ROLLBACK + release khi lỗi) ----
    const student = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO students
          (code, name, gender, phone, id_card, birth_date, class_name, room_id, check_in_date, note,
           uses_washing, rental_type, residency_status, contract_no, contract_date, contract_status, cccd_image,
           status, check_out_date, deposit_amount, deposit_status, deposit_date, cccd_front, cccd_back, checkout_reason,
           class_start_date, expected_departure, parent_phone)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28) RETURNING *`,
        [...f, status, checkOut, takeDeposit ? depositFee : 0, takeDeposit ? 'held' : 'none', takeDeposit ? checkIn : null,
         null, null,
         (checkOut && ['departure', 'personal', 'facility', 'dropout', 'reserve', 'other'].includes(b.checkout_reason)) ? b.checkout_reason : (checkOut ? 'other' : null),
         D(b.class_start_date), D(b.expected_departure), b.parent_phone || '']
      );
      const st = rows[0];

      // Tải ảnh CCCD lên Storage rồi lưu key (id đã có)
      const cccdUpd = {};
      for (const field of CCCD_FIELDS) {
        const r = await resolveCccd(st.id, field, b[field]);
        if (r) cccdUpd[field] = r;
      }
      if (Object.keys(cccdUpd).length) {
        const keys = Object.keys(cccdUpd);
        const sets = keys.map((k, i) => `${k}=$${i + 1}`).join(', ');
        await client.query(`UPDATE students SET ${sets} WHERE id=$${keys.length + 1}`, [...keys.map(k => cccdUpd[k]), st.id]);
        Object.assign(st, cccdUpd);
      }

      await client.query(
        `INSERT INTO logs (student_id, type, date, room_id, note, source) VALUES ($1,'in',$2,$3,'Đăng ký & vào ở','admin')`,
        [st.id, checkIn, b.room_id || null]
      );
      if (b.create_login) {
        await client.query(
          `INSERT INTO users (username, password_hash, role, full_name, student_id) VALUES ($1,$2,'student',$3,$4)`,
          [uname, bcrypt.hashSync(pass, 10), b.name.trim(), st.id]
        );
      }
      return st;
    });

    res.status(201).json(await signCccd(student));
  } catch (e) { next(e); }
});

router.put('/:id', requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    const raw = req.body || {};
    // MERGE với bản ghi hiện tại — chỉ ghi đè field được GỬI (undefined = giữ nguyên) → chống mất dữ liệu khi gọi API thiếu field
    const cur = (await query('SELECT * FROM students WHERE id=$1 AND deleted_at IS NULL', [req.params.id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'Không tìm thấy học viên' });
    const b = { ...cur };
    for (const k of Object.keys(raw)) if (raw[k] !== undefined) b[k] = raw[k];
    // Chặn ngày ảo trong dữ liệu GỬI LÊN → tránh sập 500; và ngày trả < ngày vào
    for (const k of DATE_FIELDS) if (raw[k] != null && raw[k] !== '' && !isValidYmd(raw[k])) return res.status(400).json({ error: `Ngày không hợp lệ (${k})` });
    if (isValidYmd(b.check_in_date) && isValidYmd(b.check_out_date) && String(b.check_out_date).slice(0, 10) < String(b.check_in_date).slice(0, 10))
      return res.status(400).json({ error: 'Ngày trả phòng không thể trước ngày nhận phòng' });
    const f = studentFields(b);
    const cols = `code=$1, name=$2, gender=$3, phone=$4, id_card=$5, birth_date=$6, class_name=$7, room_id=$8,
      check_in_date=$9, note=$10, uses_washing=$11, rental_type=$12, residency_status=$13,
      contract_no=$14, contract_date=$15, contract_status=$16,
      class_start_date=$17, expected_departure=$18, parent_phone=$19`;
    const params = f.slice(0, 16);
    params.push(D(b.class_start_date), D(b.expected_departure), b.parent_phone || '');
    let extra = '';
    // Ảnh CCCD: chỉ cập nhật nếu client GỬI kèm (dựa vào body gốc, không phải merged)
    const needCccd = CCCD_FIELDS.some(field => raw[field] !== undefined);
    const oldKeys = needCccd ? { cccd_front: cur.cccd_front, cccd_back: cur.cccd_back, cccd_image: cur.cccd_image } : {};
    for (const field of CCCD_FIELDS) {
      if (raw[field] === undefined) continue;
      const resolved = await resolveCccd(req.params.id, field, raw[field], oldKeys[field]);
      if (resolved === undefined) continue; // giá trị không hợp lệ -> giữ nguyên, không ghi rác
      extra += `, ${field}=$${params.length + 1}`;
      params.push(resolved);
    }
    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE students SET ${cols}${extra} WHERE id=$${params.length} RETURNING *`, params);
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy học viên' });
    res.json(await signCccd(rows[0]));
  } catch (e) { next(e); }
});

// Xóa mềm (khôi phục được — không xóa dữ liệu thật)
router.delete('/:id', requireRole('admin', 'staff'), async (req, res, next) => {
  try { await query('UPDATE students SET deleted_at=now() WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { next(e); }
});

// Khôi phục học viên đã xóa
router.post('/:id/restore', requireRole('admin', 'staff'), async (req, res, next) => {
  try { await query('UPDATE students SET deleted_at=NULL WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { next(e); }
});

// Bật/tắt dịch vụ máy giặt cho học viên (tab Máy giặt)
router.post('/:id/washing', requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    const on = !!req.body.on;
    const { rows } = await query('UPDATE students SET uses_washing=$1 WHERE id=$2 AND deleted_at IS NULL RETURNING id', [on, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy học viên' });
    res.json({ ok: true, on });
  } catch (e) { next(e); }
});

// Check-in
router.post('/:id/checkin', requireRole('admin', 'staff'), async (req, res, next) => {
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
router.post('/:id/checkout', requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    // Chặn field lạ: gửi "check_out_date" (đúng tên cột DB) từng bị NUỐT IM LẶNG rồi tự lấy ngày hôm nay
    const bad = rejectUnknown(req.body, ['date', 'notice_date', 'reason', 'note']);
    if (bad) return res.status(400).json({ error: bad });
    const { date, notice_date, reason, note } = req.body;
    if (date != null && !isValidYmd(date)) return res.status(400).json({ error: 'Ngày trả phòng không hợp lệ' });
    if (notice_date != null && notice_date !== '' && !isValidYmd(notice_date)) return res.status(400).json({ error: 'Ngày báo trả phòng không hợp lệ' });
    const d = date || new Date().toISOString().slice(0, 10);
    // Ngày rời đi KHÔNG được trước ngày nhận phòng (đường tạo HV và cổng bảo trì đã chặn, đường này thì chưa)
    const ci = (await query('SELECT check_in_date FROM students WHERE id=$1 AND deleted_at IS NULL', [req.params.id])).rows[0];
    if (!ci) return res.status(404).json({ error: 'Không tìm thấy học viên' });
    if (ci.check_in_date && d < String(ci.check_in_date).slice(0, 10))
      return res.status(400).json({ error: `Ngày trả phòng (${d}) không thể trước ngày nhận phòng (${String(ci.check_in_date).slice(0, 10)})` });
    const rs = ['departure', 'personal', 'facility', 'dropout', 'reserve', 'other'].includes(reason) ? reason : 'other';
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
    // HV đã rời -> DỌN phiếu của các KỲ SAU. Trước đây phiếu tháng sau vẫn nguyên và vẫn đòi tiền
    // người không còn ở (check-out chỉ tính lại đúng tháng trả phòng).
    const dropped = await query(
      `UPDATE invoices SET deleted_at=now() WHERE student_id=$1 AND month > $2 AND deleted_at IS NULL RETURNING month, total`,
      [req.params.id, d.slice(0, 7)]);
    res.json({ student: rows[0], refund: elig, recalced, dropped_future_invoices: dropped.rows.map(r => r.month) });
  } catch (e) { next(e); }
});

// Chuyển phòng
router.post('/:id/transfer', requireRole('admin', 'staff'), async (req, res, next) => {
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
router.post('/:id/deposit', requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    const bad = rejectUnknown(req.body, ['amount', 'date']);
    if (bad) return res.status(400).json({ error: bad });
    const settings = await getSettings();
    const amount = req.body.amount != null ? +req.body.amount : (+settings.deposit_fee || 0);
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: `Tiền cọc phải là số không âm (đang nhận: ${req.body.amount})` });
    if (req.body.date != null && !isValidYmd(req.body.date)) return res.status(400).json({ error: 'Ngày đóng cọc không hợp lệ' });
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
router.post('/:id/deposit-settle', requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    const bad = rejectUnknown(req.body, ['action', 'date', 'deduction', 'bank', 'account', 'deduction_note', 'override_reason']);
    if (bad) return res.status(400).json({ error: bad });
    const action = req.body.action === 'refund' ? 'refunded' : 'forfeited';
    if (req.body.date != null && !isValidYmd(req.body.date)) return res.status(400).json({ error: 'Ngày hoàn cọc không hợp lệ' });
    const date = req.body.date || new Date().toISOString().slice(0, 10);
    const deduction = +req.body.deduction || 0;

    const stu = (await query('SELECT deposit_amount, deposit_status, checkout_notice_date, check_out_date, checkout_reason FROM students WHERE id=$1 AND deleted_at IS NULL', [req.params.id])).rows[0];
    if (!stu) return res.status(404).json({ error: 'Không tìm thấy học viên' });
    const coc = Number(stu.deposit_amount) || 0;
    // Khấu trừ hư hao: không âm (âm = TRẢ cho HV nhiều hơn số họ cọc) và không vượt số cọc
    if (!Number.isFinite(deduction) || deduction < 0)
      return res.status(400).json({ error: `Khấu trừ hư hao không được âm (đang nhận: ${req.body.deduction})` });
    if (deduction > coc)
      return res.status(400).json({ error: `Khấu trừ ${deduction.toLocaleString('vi-VN')} vượt quá số cọc đang giữ ${coc.toLocaleString('vi-VN')}. Nếu cần đòi thêm, lập khoản thu riêng.` });

    // Hoàn cọc: phải ĐỦ ĐIỀU KIỆN. Trước đây kết luận "không đủ điều kiện" chỉ là dòng chữ gợi ý,
    // khâu tất toán không hỏi lại -> bấm hoàn là hoàn.
    if (action === 'refunded') {
      const elig = depositRefundEligible({ noticeDate: stu.checkout_notice_date || null, checkoutDate: stu.check_out_date || null, reason: stu.checkout_reason || 'other' });
      if (!elig.eligible) {
        const ov = String(req.body.override_reason || '').trim();
        if (ov.length < 10) {
          return res.status(400).json({
            error: `Không đủ điều kiện hoàn cọc: ${elig.reason}. Nếu vẫn quyết định hoàn, gửi kèm "override_reason" (lý do ghi đè, tối thiểu 10 ký tự) — lý do này sẽ được ghi vào hồ sơ và nhật ký.`,
            refund_check: elig,
          });
        }
        // Có lý do ghi đè -> cho phép nhưng GHI VẾT vào ghi chú khấu trừ để tra được về sau
        req.body.deduction_note = `[HOÀN NGOẠI LỆ — ${elig.reason}] ${ov}${req.body.deduction_note ? ' · ' + req.body.deduction_note : ''}`;
      }
    }
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
router.post('/:id/account', requireRole('admin', 'staff'), async (req, res, next) => {
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
