/* VietQR (chuẩn Napas 247) — sinh mã QR chuyển khoản NGAY TRONG APP, chạy offline.
 * Không gọi dịch vụ ngoài: chuỗi QR tự dựng theo EMVCo, vẽ bằng thư viện qrcode.min.js.
 * Dùng cho phiếu báo tiền phòng: quản lý/HV quét là chuyển đúng số tiền + nội dung.
 */
(function (global) {
  'use strict';

  // Danh sách ngân hàng (mã BIN Napas 6 số) — TRÍCH TỪ DANH SÁCH CHÍNH THỨC api.vietqr.io/v2/banks
  // (chỉ NH hỗ trợ nhận chuyển khoản). KHÔNG gõ tay: sai BIN là chuyển nhầm ngân hàng. Cập nhật lại từ nguồn đó.
  var BANKS = [
    { bin: '970436', short: 'Vietcombank', name: 'Ngân hàng TMCP Ngoại Thương Việt Nam' },
    { bin: '970415', short: 'VietinBank', name: 'Ngân hàng TMCP Công thương Việt Nam' },
    { bin: '970418', short: 'BIDV', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam' },
    { bin: '970405', short: 'Agribank', name: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam' },
    { bin: '970407', short: 'Techcombank', name: 'Ngân hàng TMCP Kỹ thương Việt Nam' },
    { bin: '970422', short: 'MBBank', name: 'Ngân hàng TMCP Quân đội' },
    { bin: '970416', short: 'ACB', name: 'Ngân hàng TMCP Á Châu' },
    { bin: '970432', short: 'VPBank', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng' },
    { bin: '970403', short: 'Sacombank', name: 'Ngân hàng TMCP Sài Gòn Thương Tín' },
    { bin: '970423', short: 'TPBank', name: 'Ngân hàng TMCP Tiên Phong' },
    { bin: '970437', short: 'HDBank', name: 'Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh' },
    { bin: '970441', short: 'VIB', name: 'Ngân hàng TMCP Quốc tế Việt Nam' },
    { bin: '970443', short: 'SHB', name: 'Ngân hàng TMCP Sài Gòn - Hà Nội' },
    { bin: '970448', short: 'OCB', name: 'Ngân hàng TMCP Phương Đông' },
    { bin: '970426', short: 'MSB', name: 'Ngân hàng TMCP Hàng Hải Việt Nam' },
    { bin: '970440', short: 'SeABank', name: 'Ngân hàng TMCP Đông Nam Á' },
    { bin: '970431', short: 'Eximbank', name: 'Ngân hàng TMCP Xuất Nhập khẩu Việt Nam' },
    { bin: '970449', short: 'LPBank', name: 'Ngân hàng TMCP Lộc Phát Việt Nam' },
    { bin: '970429', short: 'SCB', name: 'Ngân hàng TMCP Sài Gòn' },
    { bin: '970428', short: 'NamABank', name: 'Ngân hàng TMCP Nam Á' },
    { bin: '970425', short: 'ABBANK', name: 'Ngân hàng TMCP An Bình' },
    { bin: '970409', short: 'BacABank', name: 'Ngân hàng TMCP Bắc Á' },
    { bin: '970438', short: 'BaoVietBank', name: 'Ngân hàng TMCP Bảo Việt' },
    { bin: '546034', short: 'CAKE', name: 'TMCP Việt Nam Thịnh Vượng - Ngân hàng số CAKE by VPBank' },
    { bin: '422589', short: 'CIMB', name: 'Ngân hàng TNHH MTV CIMB Việt Nam' },
    { bin: '970446', short: 'COOPBANK', name: 'Ngân hàng Hợp tác xã Việt Nam' },
    { bin: '668888', short: 'KBank', name: 'Ngân hàng Đại chúng TNHH Kasikornbank' },
    { bin: '970452', short: 'KienLongBank', name: 'Ngân hàng TMCP Kiên Long' },
    { bin: '970414', short: 'MBV', name: 'Ngân hàng TNHH MTV Việt Nam Hiện Đại' },
    { bin: '971025', short: 'MoMo', name: 'CTCP Dịch Vụ Di Động Trực Tuyến' },
    { bin: '970419', short: 'NCB', name: 'Ngân hàng TMCP Quốc Dân' },
    { bin: '970430', short: 'PGBank', name: 'Ngân hàng TMCP Thịnh vượng và Phát triển' },
    { bin: '970412', short: 'PVcomBank', name: 'Ngân hàng TMCP Đại Chúng Việt Nam' },
    { bin: '971133', short: 'PVcomBank Pay', name: 'Ngân hàng TMCP Đại Chúng Việt Nam Ngân hàng số' },
    { bin: '970400', short: 'SaigonBank', name: 'Ngân hàng TMCP Sài Gòn Công Thương' },
    { bin: '970424', short: 'ShinhanBank', name: 'Ngân hàng TNHH MTV Shinhan Việt Nam' },
    { bin: '963388', short: 'Timo', name: 'Ngân hàng số Timo by Ban Viet Bank (Timo by Ban Viet Bank)' },
    { bin: '546035', short: 'Ubank', name: 'TMCP Việt Nam Thịnh Vượng - Ngân hàng số Ubank by VPBank' },
    { bin: '970427', short: 'VietABank', name: 'Ngân hàng TMCP Việt Á' },
    { bin: '970433', short: 'VietBank', name: 'Ngân hàng TMCP Việt Nam Thương Tín' },
    { bin: '970454', short: 'VietCapitalBank', name: 'Ngân hàng TMCP Bản Việt' },
    { bin: '970457', short: 'Woori', name: 'Ngân hàng TNHH MTV Woori Việt Nam' },
  ];
  var BIN_MAP = {}; BANKS.forEach(function (b) { BIN_MAP[b.bin] = b; });

  // Số BYTE của chuỗi (UTF-8) — EMVCo tính độ dài theo byte, KHÔNG theo ký tự.
  // Hiện mọi giá trị đều ASCII nên byte == ký tự, nhưng tính đúng để không vỡ nếu sau này lọt ký tự có dấu.
  function byteLen(v) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(v).length;
    return unescape(encodeURIComponent(v)).length;
  }
  // Một trường EMVCo = ID(2) + độ dài(2 số thập phân = số BYTE) + giá trị.
  // Ô độ dài chỉ 2 chữ số → giá trị ≥100 byte làm lệch cả chuỗi: chặn sớm bằng lỗi rõ ràng.
  function tlv(id, val) {
    var v = String(val);
    var n = byteLen(v);
    if (n > 99) throw new Error('Trường VietQR "' + id + '" dài ' + n + ' byte (>99) — không mã hoá được');
    return id + String(n).padStart(2, '0') + v;
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

  // Dựng chuỗi VietQR. amount = số tiền (đồng, nguyên ≥0); addInfo = nội dung CK. Null nếu dữ liệu sai.
  function buildString(o) {
    var bin = String(o.bin || '').replace(/\D/g, '');
    var acc = String(o.account || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(bin) || !/^\d{6,19}$/.test(acc)) return null;
    // Số tiền âm/không hợp lệ → coi như QR tĩnh (không gắn số tiền), không sinh chuỗi rác "54...-..."
    var amount = Math.max(0, Math.round(Number(o.amount) || 0));
    try {
      var benef = tlv('00', bin) + tlv('01', acc);
      var merchant = tlv('00', 'A000000727') + tlv('01', benef) + tlv('02', 'QRIBFTTA');
      var s = tlv('00', '01') + tlv('01', amount > 0 ? '12' : '11') + tlv('38', merchant) + tlv('53', '704');
      if (amount > 0) s += tlv('54', String(amount));
      s += tlv('58', 'VN');
      var info = asciiVN(o.addInfo).slice(0, 25);
      if (info) s += tlv('62', tlv('08', info));
      s += '6304';
      return s + crc16(s);
    } catch (e) { return null; }
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
