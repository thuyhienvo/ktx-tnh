// Kiểm tra hợp lệ dùng chung cho input người dùng (chống ngày ảo làm sập DB, SĐT rác...).

// Ngày 'YYYY-MM-DD' PHẢI là ngày có thật trên lịch (chặn 2026-02-30, 2026-13-01, 0000-00-00...).
function isValidYmd(s) {
  s = String(s == null ? '' : s);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
// Chuẩn hoá: ngày hợp lệ -> giữ nguyên chuỗi; không hợp lệ -> null (để lưu NULL thay vì sập)
function ymdOrNull(s) { return isValidYmd(s) ? String(s) : null; }
const digits = s => String(s == null ? '' : s).replace(/\D/g, '');
// SĐT hợp lệ: 8–15 chữ số (cho phép có dấu cách, +, -, ...)
function isValidPhone(s) { const d = digits(s); return d.length >= 8 && d.length <= 15; }

// Kỳ hoá đơn: bắt buộc YYYY-MM và tháng 01..12 (chặn "2026-13", "xyz")
function isValidMonth(s) {
  s = String(s == null ? '' : s);
  if (!/^\d{4}-\d{2}$/.test(s)) return false;
  const [y, m] = s.split('-').map(Number);
  return y >= 1900 && y <= 2200 && m >= 1 && m <= 12;
}

// Các khoá Cài đặt BẮT BUỘC là số + khoảng hợp lệ.
// Trước đây mọi giá trị lưu thành chuỗi, không kiểm gì -> electric_unit="abc" làm tiền điện về 0,
// room_fee="-1200000" làm hoá đơn âm, ngưỡng gửi mail = 0/-5 làm báo trường mọi vi phạm đầu tiên.
const SETTING_NUM = {
  room_fee: { min: 0, max: 100000000 }, water_fee: { min: 0, max: 100000000 },
  electric_unit: { min: 0, max: 1000000 }, service_fee: { min: 0, max: 100000000 },
  washing_fee: { min: 0, max: 100000000 }, parking_fee: { min: 0, max: 100000000 },
  deposit_fee: { min: 0, max: 100000000 },
  room_price_A: { min: 0, max: 100000000 }, room_price_B: { min: 0, max: 100000000 },
  room_price_C: { min: 0, max: 100000000 }, room_price_D: { min: 0, max: 100000000 },
  partial_half_min: { min: 0, max: 31 }, partial_full_min: { min: 0, max: 31 },
  due_day_from: { min: 1, max: 31 }, due_day_to: { min: 1, max: 31 },
  violation_mail_threshold: { min: 1, max: 100 },
  smtp_port: { min: 1, max: 65535 },
};
// Trả về chuỗi lỗi nếu sai, null nếu hợp lệ
function checkSetting(key, raw) {
  const spec = SETTING_NUM[key];
  if (!spec) return null;
  const s = String(raw).trim();
  if (s === '' || !/^-?\d+(\.\d+)?$/.test(s)) return `"${key}" phải là số (đang nhận: "${raw}")`;
  const n = Number(s);
  if (!Number.isFinite(n)) return `"${key}" phải là số`;
  if (n < spec.min) return `"${key}" không được nhỏ hơn ${spec.min} (đang nhận: ${n})`;
  if (n > spec.max) return `"${key}" không được lớn hơn ${spec.max} (đang nhận: ${n})`;
  return null;
}

// Chỉ cho phép đúng các field đã khai báo. Field lạ -> báo lỗi thay vì NUỐT IM LẶNG.
// (Trước đây gửi "check_out_date" thay vì "date" thì app trả 200 rồi tự lấy ngày hôm nay.)
function rejectUnknown(body, allowed) {
  const extra = Object.keys(body || {}).filter(k => !allowed.includes(k));
  return extra.length ? `Trường không hợp lệ: ${extra.join(', ')}. Chỉ chấp nhận: ${allowed.join(', ')}` : null;
}

module.exports = { isValidYmd, ymdOrNull, isValidPhone, digits, isValidMonth, checkSetting, rejectUnknown, SETTING_NUM };
