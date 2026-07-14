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

module.exports = { isValidYmd, ymdOrNull, isValidPhone, digits };
