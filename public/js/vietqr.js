/* VietQR (chuẩn Napas 247) — sinh mã QR chuyển khoản NGAY TRONG APP, chạy offline.
 * Không gọi dịch vụ ngoài: chuỗi QR tự dựng theo EMVCo, vẽ bằng thư viện qrcode.min.js.
 * Dùng cho phiếu báo tiền phòng: quản lý/HV quét là chuyển đúng số tiền + nội dung.
 */
(function (global) {
  'use strict';

  // Danh sách ngân hàng phổ biến + mã BIN Napas (6 số). Thêm dần khi cần.
  var BANKS = [
    { bin: '970436', short: 'Vietcombank', name: 'NH TMCP Ngoại thương Việt Nam' },
    { bin: '970415', short: 'VietinBank', name: 'NH TMCP Công thương Việt Nam' },
    { bin: '970418', short: 'BIDV', name: 'NH Đầu tư & Phát triển Việt Nam' },
    { bin: '970405', short: 'Agribank', name: 'NH Nông nghiệp & PTNT Việt Nam' },
    { bin: '970407', short: 'Techcombank', name: 'NH TMCP Kỹ thương' },
    { bin: '970422', short: 'MB Bank', name: 'NH TMCP Quân đội' },
    { bin: '970416', short: 'ACB', name: 'NH TMCP Á Châu' },
    { bin: '970432', short: 'VPBank', name: 'NH TMCP Việt Nam Thịnh Vượng' },
    { bin: '970403', short: 'Sacombank', name: 'NH TMCP Sài Gòn Thương Tín' },
    { bin: '970423', short: 'TPBank', name: 'NH TMCP Tiên Phong' },
    { bin: '970437', short: 'HDBank', name: 'NH TMCP Phát triển TP.HCM' },
    { bin: '970441', short: 'VIB', name: 'NH TMCP Quốc tế' },
    { bin: '970443', short: 'SHB', name: 'NH TMCP Sài Gòn - Hà Nội' },
    { bin: '970448', short: 'OCB', name: 'NH TMCP Phương Đông' },
    { bin: '970426', short: 'MSB', name: 'NH TMCP Hàng Hải' },
    { bin: '970468', short: 'SeABank', name: 'NH TMCP Đông Nam Á' },
    { bin: '970431', short: 'Eximbank', name: 'NH TMCP Xuất nhập khẩu' },
    { bin: '970449', short: 'LPBank', name: 'NH TMCP Lộc Phát (LienVietPostBank)' },
    { bin: '970429', short: 'SCB', name: 'NH TMCP Sài Gòn' },
    { bin: '970428', short: 'Nam A Bank', name: 'NH TMCP Nam Á' },
    { bin: '970419', short: 'NCB', name: 'NH TMCP Quốc dân' },
    { bin: '970412', short: 'PVcomBank', name: 'NH TMCP Đại chúng' },
    { bin: '970414', short: 'Oceanbank', name: 'NH TM TNHH MTV Đại Dương' },
    { bin: '970438', short: 'BaoViet Bank', name: 'NH TMCP Bảo Việt' },
    { bin: '970440', short: 'ABBANK', name: 'NH TMCP An Bình' },
    { bin: '970425', short: 'ABBANK (cũ)', name: 'NH TMCP An Bình' },
    { bin: '546034', short: 'Cake by VPBank', name: 'NH số Cake' },
    { bin: '963388', short: 'Timo', name: 'Timo by BVBank' },
  ];
  var BIN_MAP = {}; BANKS.forEach(function (b) { BIN_MAP[b.bin] = b; });

  // Một trường EMVCo = ID(2) + độ dài(2, số thập phân) + giá trị
  function tlv(id, val) {
    var v = String(val);
    return id + String(v.length).padStart(2, '0') + v;
  }

  // CRC16/CCITT-FALSE (poly 0x1021, init 0xFFFF) — tính trên cả literal '6304' ở cuối
  function crc16(str) {
    var crc = 0xFFFF;
    for (var i = 0; i < str.length; i++) {
      crc ^= (str.charCodeAt(i) & 0xFF) << 8;
      for (var j = 0; j < 8; j++) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
        crc &= 0xFFFF;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  // Bỏ dấu tiếng Việt + ký tự lạ cho nội dung CK (app ngân hàng thường chỉ nhận không dấu)
  function asciiVN(s) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .replace(/[^0-9a-zA-Z ]+/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  // Dựng chuỗi VietQR. amount = số tiền (đồng, nguyên); addInfo = nội dung CK.
  function buildString(o) {
    var bin = String(o.bin || '').replace(/\D/g, '');
    var acc = String(o.account || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(bin) || !acc) return null;
    var benef = tlv('00', bin) + tlv('01', acc);
    var merchant = tlv('00', 'A000000727') + tlv('01', benef) + tlv('02', 'QRIBFTTA');
    var amount = Math.round(Number(o.amount) || 0);
    var s = tlv('00', '01') + tlv('01', amount > 0 ? '12' : '11') + tlv('38', merchant) + tlv('53', '704');
    if (amount > 0) s += tlv('54', String(amount));
    s += tlv('58', 'VN');
    var info = asciiVN(o.addInfo).slice(0, 25);
    if (info) s += tlv('62', tlv('08', info));
    s += '6304';
    return s + crc16(s);
  }

  // Trả về data-URL ảnh QR (GIF) để nhét vào <img src>. Null nếu thiếu dữ liệu / thiếu thư viện.
  function dataURL(o) {
    var s = buildString(o);
    if (!s || typeof global.qrcode !== 'function') return null;
    try {
      var qr = global.qrcode(0, o.ecc || 'M'); // type 0 = tự chọn phiên bản
      qr.addData(s);
      qr.make();
      return qr.createDataURL(o.cell || 4, o.margin != null ? o.margin : 8);
    } catch (e) { return null; }
  }

  global.VietQR = { BANKS: BANKS, bankByBin: function (b) { return BIN_MAP[b] || null; }, buildString: buildString, dataURL: dataURL, asciiVN: asciiVN };
})(typeof window !== 'undefined' ? window : this);
