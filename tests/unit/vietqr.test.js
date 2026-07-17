// VietQR (Napas 247) — chuỗi QR chuyển khoản phải ĐÚNG TUYỆT ĐỐI: sai 1 ký tự CRC hoặc lệch số tiền
// là ngân hàng từ chối hoặc chuyển nhầm. Đây là đường TIỀN nên canh chặt bằng test vector chuẩn.
const path = require('path');

// Nạp module như trên trình duyệt: gắn qrcode + VietQR vào global (var toàn cục của thẻ <script>).
function loadVietQR() {
  global.window = global;
  global.qrcode = require(path.join(__dirname, '../../public/js/qrcode.min.js'));
  delete require.cache[require.resolve(path.join(__dirname, '../../public/js/vietqr.js'))];
  require(path.join(__dirname, '../../public/js/vietqr.js'));
  return global.VietQR;
}

// Bộ giải mã EMVCo tối giản để soi lại từng trường
function parseTLV(str) {
  const out = {}; let i = 0;
  while (i < str.length - 4) { const id = str.substr(i, 2), ln = +str.substr(i + 2, 2); out[id] = str.substr(i + 4, ln); i += 4 + ln; }
  return out;
}
function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) { crc ^= (str.charCodeAt(i) & 0xFF) << 8; for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? (((crc << 1) ^ 0x1021) & 0xFFFF) : ((crc << 1) & 0xFFFF); }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

module.exports = {
  name: 'VietQR — chuỗi chuyển khoản đúng chuẩn Napas',
  needsServer: false,

  async run(t) {
    const V = loadVietQR();

    // Test vector chuẩn của thuật toán: CRC16/CCITT-FALSE("123456789") = 0x29B1
    t.eq('CRC16/CCITT-FALSE("123456789") = 29B1', crc16('123456789'), '29B1');

    const s = V.buildString({ bin: '970436', account: '0011001234567', amount: 1700000, addInfo: 'HV0123 T072026' });
    t.ok('Dựng được chuỗi VietQR', typeof s === 'string' && s.length > 40, `len=${s && s.length}`);

    // CRC ở 4 ký tự cuối phải khớp phần thân
    t.eq('CRC 4 ký tự cuối khớp thân chuỗi (đúng chuẩn)', s.slice(-4), crc16(s.slice(0, -4)));

    const p = parseTLV(s);
    t.eq('Có tiền → POI(01)="12" (mã QR động)', p['01'], '12');
    t.eq('Tiền tệ(53)="704" (VND)', p['53'], '704');
    t.eq('Số tiền(54) khớp tổng phiếu', p['54'], '1700000');
    t.eq('Quốc gia(58)="VN"', p['58'], 'VN');

    const m = parseTLV(p['38']);
    t.eq('GUID Napas(38.00)="A000000727"', m['00'], 'A000000727');
    t.eq('Mã dịch vụ(38.02)="QRIBFTTA" (chuyển tới tài khoản)', m['02'], 'QRIBFTTA');
    const b = parseTLV(m['01']);
    t.eq('Mã ngân hàng BIN(38.01.00) đúng', b['00'], '970436');
    t.eq('Số tài khoản(38.01.01) đúng', b['01'], '0011001234567');

    // Không tiền → QR tĩnh (POI 11), không có trường 54
    const st = V.buildString({ bin: '970415', account: '999888777', amount: 0, addInfo: '' });
    t.eq('Không tiền → POI(01)="11" (QR tĩnh)', parseTLV(st)['01'], '11');
    t.ok('Không tiền → không có trường số tiền(54)', parseTLV(st)['54'] === undefined);

    // Guard: BIN sai/thiếu, tài khoản sai định dạng → null (không sinh QR rác)
    t.ok('BIN 5 chữ số → null', V.buildString({ bin: '12345', account: '123456', amount: 1 }) === null);
    t.ok('Thiếu tài khoản → null', V.buildString({ bin: '970436', account: '', amount: 1 }) === null);
    t.ok('Số TK < 6 chữ số → null', V.buildString({ bin: '970436', account: '123', amount: 1 }) === null);
    t.ok('Số TK có chữ cái → null', V.buildString({ bin: '970436', account: '00ABC11', amount: 1 }) === null);

    // Số tiền ÂM → coi như QR tĩnh (không gắn trường 54), không sinh chuỗi rác
    const neg = V.buildString({ bin: '970436', account: '0011001234567', amount: -5000, addInfo: '' });
    t.ok('Số tiền âm → không có trường 54', neg && parseTLV(neg)['54'] === undefined && parseTLV(neg)['01'] === '11', neg);

    // Dữ liệu ngân hàng phải khớp Napas (đã từng gõ tay sai SeABank/ABBANK/OceanBank)
    t.ok('Có đủ danh sách ngân hàng (≥40)', V.BANKS.length >= 40, `có ${V.BANKS.length} NH`);
    t.eq('SeABank đúng BIN 970440', (V.bankByBin('970440') || {}).short, 'SeABank');
    t.eq('ABBANK đúng BIN 970425', (V.bankByBin('970425') || {}).short, 'ABBANK');
    t.ok('BIN sai cũ 970468 KHÔNG còn trong danh sách', V.bankByBin('970468') === null);
    t.ok('Mỗi BIN chỉ xuất hiện một lần (không trùng)', new Set(V.BANKS.map(b => b.bin)).size === V.BANKS.length);

    // Nội dung bỏ dấu tiếng Việt (app ngân hàng chỉ nhận không dấu)
    t.eq('Bỏ dấu tiếng Việt trong nội dung', V.asciiVN('Trần Thị Hồng — Phòng 104 (đợt 2)'), 'Tran Thi Hong Phong 104 dot 2');

    // Vẽ được ảnh QR (data-URL) — thư viện offline hoạt động
    const url = V.dataURL({ bin: '970436', account: '0011001234567', amount: 1700000, addInfo: 'HV0123 T072026' });
    t.ok('dataURL trả ảnh QR (data:image)', typeof url === 'string' && url.startsWith('data:image'), `prefix=${url && url.slice(0, 16)}`);

    delete global.window; delete global.qrcode; delete global.VietQR;
  },
};
