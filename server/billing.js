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

// Chia tiền điện của PHÒNG theo SỐ NGÀY Ở THỰC TẾ của từng người.
// roster: [{ student_id, days }] — mọi người ở phòng đó trong kỳ.
//
// Trước đây: chia đều đầu người, không nhân ngày -> người ở 1 ngày trả bằng người ở cả tháng,
// còn người ở lại thì được giảm sai vì bị chia thêm suất.
// Dùng phương pháp "phần dư lớn nhất" để TỔNG các phần khớp TUYỆT ĐỐI với tiền điện của phòng
// (không hụt/dư đồng nào, kể cả khi đơn giá không chia hết).
function splitElectricByDays(roomElectric, roster) {
  const out = {};
  const list = (roster || []).filter(r => (r.days || 0) > 0);
  const totalDays = list.reduce((a, r) => a + r.days, 0);
  if (!(roomElectric > 0) || totalDays <= 0) { (roster || []).forEach(r => { out[r.student_id] = 0; }); return out; }
  const parts = list.map(r => {
    const exact = (roomElectric * r.days) / totalDays;
    const base = Math.floor(exact);
    return { id: r.student_id, base, frac: exact - base };
  });
  let rem = r0(roomElectric) - parts.reduce((a, p) => a + p.base, 0);
  parts.slice().sort((a, b) => (b.frac - a.frac) || (a.id - b.id)).forEach(p => { if (rem > 0) { p.base += 1; rem -= 1; } });
  parts.forEach(p => { out[p.id] = p.base; });
  (roster || []).forEach(r => { if (out[r.student_id] === undefined) out[r.student_id] = 0; });
  return out;
}

// Giá thuê nguyên phòng theo hạng
function roomPriceByHang(hang, fees) {
  return Number(fees['room_price_' + (hang || 'B')] || fees.room_fee);
}

// Tính 1 hóa đơn tháng cho 1 học viên
// opts: { student, room, month, fees, roster, occupants, kwh, vehicleCount }
//   roster = [{student_id, days}] của TẤT CẢ người ở cùng phòng trong kỳ -> chia điện theo ngày ở (đúng).
//   occupants = số người (CÁCH CŨ: chia đều đầu người) — chỉ dùng khi không truyền roster.
function computeInvoice({ student, room, month, fees, occupants, roster, kwh, vehicleCount }) {
  const dim = daysInMonth(month);
  const days = daysStayedInMonth(student, month);

  // Tiền phòng: thuê ghép -> giá/người; thuê nguyên phòng -> giá theo hạng
  let roomFee;
  if (student.rental_type === 'phong') {
    roomFee = roomPriceByHang(room && room.hang, fees);
  } else {
    // Phòng CHƯA đặt giá riêng (null/0) -> dùng đơn giá "Tiền phòng" trong Cài đặt.
    // (Trước đây coi 0 là "giá thật = miễn phí" -> mọi HV thuê ghép bị tính tiền phòng = 0)
    const rf = room && Number(room.monthly_fee) > 0 ? Number(room.monthly_fee) : Number(fees.room_fee);
    roomFee = rf;
  }
  const room_charge = r0((roomFee / dim) * days); // chia đúng theo số ngày ở

  // Hệ số phí cố định (nước, dịch vụ, máy giặt, xe)
  const f = partialFactor(days, dim, +fees.partial_half_min, +fees.partial_full_min);
  const water_charge = r0(Number(fees.water_fee) * f);
  const service_charge = r0(Number(fees.service_fee) * f);
  const washing_charge = student.uses_washing ? r0(Number(fees.washing_fee) * f) : 0;
  const nVehicles = vehicleCount != null ? vehicleCount : (student.uses_parking ? 1 : 0);
  const parking_charge = r0(Number(fees.parking_fee) * nVehicles * f);

  // Điện: tổng kWh phòng × đơn giá, chia theo SỐ NGÀY Ở của từng người
  const roomElectric = r0(Number(kwh || 0) * Number(fees.electric_unit));
  let electric_charge;
  if (Array.isArray(roster) && roster.length) {
    const share = splitElectricByDays(roomElectric, roster);
    electric_charge = share[student.id] != null ? share[student.id] : 0;
  } else {
    // Không có roster -> quay về cách cũ (chia đều đầu người). Chỉ còn dùng cho script/di sản.
    electric_charge = occupants > 0 ? r0(roomElectric / occupants) : 0;
  }

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
  if (reason === 'departure') return { eligible: true, reason: 'Xuất cảnh đi Nhật — hoàn cọc' };
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
  roomPriceByHang, liveStatus, isOccupying, splitElectricByDays,
};
