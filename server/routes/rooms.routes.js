const express = require('express');
const { query } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();
router.use(requireAuth);

// Sức chứa & giá phòng phải hợp lý. Trước đây lưu được capacity=-5 (làm mọi phép tính giường trống sai)
// và monthly_fee=-9.000.000 (hoá đơn âm). "Hạng D = 3 giường" chỉ là quy ước trên giao diện.
const CAP_MAX = { A: 8, B: 8, C: 8, D: 8 };
function badRoom(b, cur = {}) {
  const g = (k) => (b[k] !== undefined ? b[k] : cur[k]);
  const cap = Number(g('capacity'));
  if (g('capacity') !== undefined && g('capacity') !== null && g('capacity') !== '') {
    if (!Number.isFinite(cap)) return `Sức chứa phải là số (đang nhận: "${g('capacity')}")`;
    if (cap < 0) return `Sức chứa không được âm (đang nhận: ${cap})`;
    const max = CAP_MAX[String(g('hang') || 'B').toUpperCase()] || 8;
    if (cap > max) return `Sức chứa ${cap} vượt mức hợp lý cho phòng hạng ${g('hang') || 'B'} (tối đa ${max} giường)`;
  }
  const fee = Number(g('monthly_fee'));
  if (g('monthly_fee') !== undefined && g('monthly_fee') !== null && g('monthly_fee') !== '') {
    if (!Number.isFinite(fee)) return `Giá phòng phải là số (đang nhận: "${g('monthly_fee')}")`;
    if (fee < 0) return `Giá phòng không được âm (đang nhận: ${fee})`;
  }
  return null;
}

// Danh sách phòng kèm số người đang ở + tên cơ sở. ?deleted=1 -> chỉ phòng đã xóa
router.get('/', requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    const cond = req.query.deleted === '1' ? 'r.deleted_at IS NOT NULL' : 'r.deleted_at IS NULL';
    const { rows } = await query(`
      SELECT r.*, f.name AS facility_name,
        (SELECT COUNT(*) FROM students s WHERE s.room_id = r.id AND s.deleted_at IS NULL
           AND s.check_in_date <= CURRENT_DATE AND (s.check_out_date IS NULL OR s.check_out_date > CURRENT_DATE))::int AS occupancy,
        (SELECT COUNT(*) FROM students s WHERE s.room_id = r.id AND s.deleted_at IS NULL AND s.check_in_date > CURRENT_DATE)::int AS upcoming,
        (SELECT COUNT(*) FROM students s WHERE s.room_id = r.id AND s.deleted_at IS NULL
           AND s.check_out_date IS NOT NULL AND s.check_out_date > CURRENT_DATE)::int AS leaving
      FROM rooms r
      LEFT JOIN facilities f ON f.id = r.facility_id
      WHERE ${cond}
      ORDER BY r.floor, r.name`);
    res.json(rows);
  } catch (e) { next(e); }
});

const HANG = h => (['A', 'B', 'C', 'D'].includes(h) ? h : 'B');
const RTYPE = t => (['shared', 'whole', 'security', 'staff'].includes(t) ? t : 'shared');
// Tầng suy ra từ chữ số đầu tiên của tên phòng (VD 104 -> 1, A203 -> 2)
const floorOf = name => { const m = String(name || '').match(/\d/); return m ? +m[0] : 1; };

router.post('/', requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    const { facility_id, name, gender, hang, capacity, monthly_fee, note, room_type } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nhập tên phòng' });
    const badR = badRoom(req.body);
    if (badR) return res.status(400).json({ error: badR });
    // Trùng tên phòng trong cùng cơ sở -> nhân viên xếp nhầm người
    const dupR = await query(
      `SELECT 1 FROM rooms WHERE lower(trim(name))=lower(trim($1)) AND COALESCE(facility_id,0)=COALESCE($2,0) AND deleted_at IS NULL`,
      [name, facility_id || null]);
    if (dupR.rows[0]) return res.status(400).json({ error: `Phòng "${name.trim()}" đã tồn tại trong cơ sở này` });
    const { rows } = await query(
      `INSERT INTO rooms (facility_id, name, floor, gender, hang, capacity, monthly_fee, note, room_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [facility_id || null, name.trim(), floorOf(name), gender === 'female' ? 'female' : 'male',
       HANG(hang), +capacity || 0, +monthly_fee || 0, note || '', RTYPE(room_type)]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    // MERGE với bản ghi hiện tại — field không gửi thì giữ nguyên (chống mất dữ liệu / reset room_type, capacity)
    const cur = (await query('SELECT * FROM rooms WHERE id=$1 AND deleted_at IS NULL', [req.params.id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'Không tìm thấy phòng' });
    const raw = req.body || {};
    const g = (k, def) => (raw[k] !== undefined ? raw[k] : def);
    const name = g('name', cur.name);
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nhập tên phòng' });
    const badR = badRoom(raw, cur);
    if (badR) return res.status(400).json({ error: badR });
    const dupR = await query(
      `SELECT 1 FROM rooms WHERE lower(trim(name))=lower(trim($1)) AND COALESCE(facility_id,0)=COALESCE($2,0) AND id<>$3 AND deleted_at IS NULL`,
      [name, g('facility_id', cur.facility_id) || null, req.params.id]);
    if (dupR.rows[0]) return res.status(400).json({ error: `Phòng "${String(name).trim()}" đã tồn tại trong cơ sở này` });
    const { rows } = await query(
      `UPDATE rooms SET facility_id=$1, name=$2, floor=$3, gender=$4, hang=$5, capacity=$6, monthly_fee=$7, note=$8, room_type=$9
       WHERE id=$10 RETURNING *`,
      [g('facility_id', cur.facility_id) || null, String(name).trim(), floorOf(name),
       g('gender', cur.gender) === 'female' ? 'female' : 'male', HANG(g('hang', cur.hang)),
       +g('capacity', cur.capacity) || 0, +g('monthly_fee', cur.monthly_fee) || 0,
       g('note', cur.note) || '', RTYPE(g('room_type', cur.room_type)), req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Xóa mềm: đánh dấu deleted_at (khôi phục được), không xóa hẳn
router.delete('/:id', requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    // CHỈ đếm học viên CHƯA BỊ XOÁ. Trước đây đếm cả HV đã xoá -> xoá hết người rồi mà phòng vẫn
    // báo "đang có học viên ở" -> phòng kẹt vĩnh viễn không xoá được.
    const { rows } = await query(
      `SELECT COUNT(*)::int c, COUNT(*) FILTER (WHERE check_in_date > CURRENT_DATE)::int sap_vao
       FROM students WHERE room_id=$1 AND deleted_at IS NULL AND status='in'`, [req.params.id]);
    if (rows[0].c > 0) {
      const sv = rows[0].sap_vao;
      return res.status(400).json({
        error: `Phòng đang gán cho ${rows[0].c} học viên${sv ? ` (trong đó ${sv} người chưa đến ngày nhận phòng)` : ''}, không thể xóa. Chuyển họ sang phòng khác trước.`,
      });
    }
    await query('UPDATE rooms SET deleted_at=now() WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Khôi phục phòng đã xóa
router.post('/:id/restore', requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    await query('UPDATE rooms SET deleted_at=NULL WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
