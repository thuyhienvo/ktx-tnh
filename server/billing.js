// ===== Bộ tính tiền phòng (thuần, dễ kiểm thử) =====

function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
function firstDay(month) { return `${month}-01`; }
function lastDay(month) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m, 0).getDate(); // số ngày trong tháng (local, không lệch múi giờ)
  return `${month}-${String(d).padStart(2, '0')}`;
}
function diffDaysInclusive(a, b) {
  return Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000) + 1);
}

// Số ngày ở thực tế trong tháng
function daysStayedInMonth(student, month) {
  const mStart = firstDay(month), mEnd = lastDay(month);
  const inD = student.check_in_date && student.check_in_date > mStart ? student.check_in_date : mStart;
  const outD = student.check_out_date && student.check_out_date < mEnd ? student.check_out_date : mEnd;
  // Chưa vào trong tháng này, hoặc đã rời trước khi tháng bắt đầu
  if (student.check_in_date && student.check_in_date > mEnd) return 0;
  if (student.check_out_date && student.check_out_date < mStart) return 0;
  return diffDaysInclusive(inD, outD);
}

// Hệ số cho các phí cố định khi ở tháng lẻ:
//  ≤ half   -> 0
//  > half   -> 0.5
//  > full   -> 1
//  ở đủ tháng -> 1
function partialFactor(days, dim, halfMin, fullMin) {
  if (days >= dim) return 1;
  if (days > fullMin) return 1;
  if (days > halfMin) return 0.5;
  return 0;
}

const r0 = n => Math.round(Number(n) || 0);

// Giá thuê nguyên phòng theo hạng
function roomPriceByHang(hang, fees) {
  return Number(fees['room_price_' + (hang || 'B')] || fees.room_fee);
}

// Tính 1 hóa đơn tháng cho 1 học viên
// opts: { student, room, month, fees, occupants, kwh, vehicleCount }
function computeInvoice({ student, room, month, fees, occupants, kwh, vehicleCount }) {
  const dim = daysInMonth(month);
  const days = daysStayedInMonth(student, month);

  // Tiền phòng: thuê ghép -> giá/người; thuê nguyên phòng -> giá theo hạng
  let roomFee;
  if (student.rental_type === 'phong') {
    roomFee = roomPriceByHang(room && room.hang, fees);
  } else {
    roomFee = room && room.monthly_fee != null ? Number(room.monthly_fee) : Number(fees.room_fee);
  }
  const room_charge = r0((roomFee / dim) * days); // chia đúng theo số ngày ở

  // Hệ số phí cố định (nước, dịch vụ, máy giặt, xe)
  const f = partialFactor(days, dim, +fees.partial_half_min, +fees.partial_full_min);
  const water_charge = r0(Number(fees.water_fee) * f);
  const service_charge = r0(Number(fees.service_fee) * f);
  const washing_charge = student.uses_washing ? r0(Number(fees.washing_fee) * f) : 0;
  const nVehicles = vehicleCount != null ? vehicleCount : (student.uses_parking ? 1 : 0);
  const parking_charge = r0(Number(fees.parking_fee) * nVehicles * f);

  // Điện: tổng kWh phòng × đơn giá, chia đều số người ở phòng
  const roomElectric = r0(Number(kwh || 0) * Number(fees.electric_unit));
  const electric_charge = occupants > 0 ? r0(roomElectric / occupants) : 0;

  const total = room_charge + electric_charge + water_charge + service_charge + washing_charge + parking_charge;

  return {
    days_stayed: days,
    room_charge,
    electric_kwh: Number(kwh || 0),
    electric_charge,
    water_charge,
    service_charge,
    washing_charge,
    parking_charge,
    other_charge: 0,
    total,
  };
}

// Xét điều kiện hoàn cọc khi trả phòng
// eligible nếu: xuất cảnh đột xuất, HOẶC báo trước >= 30 ngày
function depositRefundEligible({ noticeDate, checkoutDate, reason }) {
  if (reason === 'urgent_visa') return { eligible: true, reason: 'Xuất cảnh đột xuất — hoàn cọc bình thường' };
  if (!noticeDate || !checkoutDate) return { eligible: false, reason: 'Chưa có ngày báo trả phòng' };
  const noticeDays = Math.round((new Date(checkoutDate) - new Date(noticeDate)) / 86400000);
  if (noticeDays >= 30) return { eligible: true, reason: `Báo trước ${noticeDays} ngày (≥ 1 tháng)` };
  return { eligible: false, reason: `Chỉ báo trước ${noticeDays} ngày (< 1 tháng)` };
}

// Trạng thái tự tính theo ngày: upcoming(Sắp vào) | staying(Đang ở) | leaving(Sắp trả) | left(Đã trả)
function liveStatus(s, today) {
  const ci = s.check_in_date, co = s.check_out_date;
  if (co && co <= today) return 'left';
  if (ci && ci > today) return 'upcoming';
  if (co && co > today) return 'leaving';
  return 'staying';
}
// Đang chiếm giường (tính occupancy): đang ở hoặc sắp trả
function isOccupying(s, today) { const st = liveStatus(s, today); return st === 'staying' || st === 'leaving'; }

module.exports = {
  daysInMonth, firstDay, lastDay, daysStayedInMonth,
  partialFactor, computeInvoice, depositRefundEligible,
  roomPriceByHang, liveStatus, isOccupying,
};
