const { query, getSettings } = require('./db');
const billing = require('./billing');

// Tính lại 1 hóa đơn theo dữ liệu hiện tại: số ngày ở, hình thức thuê, dịch vụ,
// và tiền điện từ chỉ số công-tơ tháng đó (chia đều theo số người). Giữ khoản khác.
async function recalcInvoice(studentId, month) {
  const inv = (await query('SELECT * FROM invoices WHERE student_id=$1 AND month=$2', [studentId, month])).rows[0];
  if (!inv) return null;
  const s = (await query('SELECT * FROM students WHERE id=$1', [studentId])).rows[0];
  if (!s) return null;
  const room = s.room_id ? (await query('SELECT * FROM rooms WHERE id=$1', [s.room_id])).rows[0] : null;
  const fees = await getSettings();
  const veh = (await query('SELECT COUNT(*)::int c FROM vehicles WHERE student_id=$1', [studentId])).rows[0].c;

  // Chỉ số điện + số người ở phòng để chia điện
  let kwh = 0, occ = 1;
  if (s.room_id) {
    const er = (await query('SELECT kwh FROM electric_readings WHERE room_id=$1 AND month=$2', [s.room_id, month])).rows[0];
    kwh = er ? Number(er.kwh) : 0;
    occ = (await query(
      `SELECT COUNT(*)::int c FROM students WHERE room_id=$1 AND check_in_date <= $2 AND (check_out_date IS NULL OR check_out_date >= $3)`,
      [s.room_id, billing.lastDay(month), billing.firstDay(month)])).rows[0].c || 1;
  }

  const c = billing.computeInvoice({ student: s, room, month, fees, occupants: occ, kwh, vehicleCount: veh });
  const other = Number(inv.other_charge) || 0;
  const total = c.room_charge + c.electric_charge + c.water_charge + c.service_charge + c.washing_charge + c.parking_charge + other;

  const { rows } = await query(
    `UPDATE invoices SET days_stayed=$1, room_charge=$2, electric_kwh=$3, electric_charge=$4, water_charge=$5,
       service_charge=$6, washing_charge=$7, parking_charge=$8, total=$9 WHERE id=$10 RETURNING *`,
    [c.days_stayed, c.room_charge, c.electric_kwh, c.electric_charge, c.water_charge, c.service_charge, c.washing_charge, c.parking_charge, total, inv.id]
  );
  return rows[0];
}

module.exports = { recalcInvoice };
