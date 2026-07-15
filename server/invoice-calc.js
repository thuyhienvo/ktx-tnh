const { query, getSettings } = require('./db');
const billing = require('./billing');

// Danh sách người ở 1 phòng trong kỳ + SỐ NGÀY Ở của từng người.
// Dùng để chia tiền điện theo ngày ở thực tế (thay cho cách chia đều đầu người).
async function roomRoster(roomId, month) {
  if (!roomId) return [];
  const { rows } = await query(
    `SELECT id, check_in_date, check_out_date FROM students
     WHERE room_id=$1 AND deleted_at IS NULL
       AND check_in_date <= $2 AND (check_out_date IS NULL OR check_out_date >= $3)`,
    [roomId, billing.lastDay(month), billing.firstDay(month)]);
  return rows
    .map(s => ({ student_id: s.id, days: billing.daysStayedInMonth(s, month) }))
    .filter(r => r.days > 0);
}

// Tính lại 1 hóa đơn theo dữ liệu hiện tại: số ngày ở, hình thức thuê, dịch vụ,
// và tiền điện từ chỉ số công-tơ tháng đó (chia theo số ngày ở). Giữ khoản khác.
async function recalcInvoice(studentId, month) {
  const inv = (await query('SELECT * FROM invoices WHERE student_id=$1 AND month=$2', [studentId, month])).rows[0];
  if (!inv) return null;
  const s = (await query('SELECT * FROM students WHERE id=$1', [studentId])).rows[0];
  if (!s) return null;
  const room = s.room_id ? (await query('SELECT * FROM rooms WHERE id=$1', [s.room_id])).rows[0] : null;
  const fees = await getSettings();
  const veh = (await query('SELECT COUNT(*)::int c FROM vehicles WHERE student_id=$1', [studentId])).rows[0].c;

  // Chỉ số điện + danh sách người ở phòng (kèm số ngày ở) để chia điện theo ngày
  let kwh = 0, roster = [];
  if (s.room_id) {
    const er = (await query('SELECT kwh FROM electric_readings WHERE room_id=$1 AND month=$2', [s.room_id, month])).rows[0];
    kwh = er ? Number(er.kwh) : 0;
    roster = await roomRoster(s.room_id, month);
  }

  const c = billing.computeInvoice({ student: s, room, month, fees, roster, kwh, vehicleCount: veh });
  const other = Number(inv.other_charge) || 0;
  const total = c.room_charge + c.electric_charge + c.water_charge + c.service_charge + c.washing_charge + c.parking_charge + other;

  const { rows } = await query(
    `UPDATE invoices SET days_stayed=$1, room_charge=$2, electric_kwh=$3, electric_charge=$4, water_charge=$5,
       service_charge=$6, washing_charge=$7, parking_charge=$8, total=$9 WHERE id=$10 RETURNING *`,
    [c.days_stayed, c.room_charge, c.electric_kwh, c.electric_charge, c.water_charge, c.service_charge, c.washing_charge, c.parking_charge, total, inv.id]
  );
  return rows[0];
}

module.exports = { recalcInvoice, roomRoster };
