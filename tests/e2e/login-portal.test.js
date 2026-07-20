// Chốt "cổng đăng nhập" (portal) — trước 20/07/2026 KHÔNG có một test nào chạm tới nó,
// dù chính sếp là người bắt lỗi 16/07 rằng 2 tab đăng nhập chỉ là trang trí.
// Nhắc lại cho người đọc sau: cổng do client TỰ KHAI nên KHÔNG PHẢI lớp bảo mật —
// nó chỉ chỉ đường cho người gõ nhầm. Quyền thật do requireRole đọc vai từ CSDL mỗi request.
// Vì vậy bộ này đo đúng 2 thứ: (1) nhầm cổng thì chặn và TUYỆT ĐỐI không cấp vé,
// (2) cổng rác/độc không được làm sập máy chủ.
const bcrypt = require('../../node_modules/bcryptjs');
const { BASE } = require('../lib/harness');
const P = '__test_portal';

const clean = db => db.query(`DELETE FROM users WHERE username LIKE '${P}%'`);

// Gọi thẳng /login để đọc được set-cookie — t.login() của harness nuốt mất phần này.
const dangNhap = (username, password, portal) =>
  fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(portal === undefined ? { username, password } : { username, password, portal }),
  }).then(async r => ({
    status: r.status,
    cookie: /ktx_token=/.test(r.headers.get('set-cookie') || ''),
    json: await r.json().catch(() => null),
  }));

module.exports = {
  name: 'Đăng nhập — chốt cổng (portal) chỉ đường, không được cấp vé sai chỗ',
  needsServer: true,
  cleanup: t => clean(t.db),

  async run(t) {
    await clean(t.db);
    const pw = 'test1234';
    const hash = bcrypt.hashSync(pw, 10);
    await t.db.query(
      `INSERT INTO users (username,password_hash,role,full_name,must_change_password)
       VALUES ($1,$3,'staff','Test cổng NV',false), ($2,$3,'student','Test cổng HV',false)`,
      [P + '_nv', P + '_hv', hash]);

    try {
      // ===== Nhầm cổng: mật khẩu ĐÚNG nhưng vào sai cửa
      const a = await dangNhap(P + '_nv', pw, 'student');
      t.eq('TC-P1 · nhân viên khai cổng "Học viên" → phải 403', a.status, 403, `HTTP ${a.status} — ${a.json && a.json.error}`);
      t.ok('TC-P1b · … và TUYỆT ĐỐI không được cấp vé kèm theo lời từ chối',
        a.cookie === false, a.cookie ? 'CÓ set-cookie ktx_token — vé phát ra dù đã trả 403!' : 'không có set-cookie (đúng)');
      t.ok('TC-P1c · … và phải chỉ đúng đường về cổng cần đi',
        a.json && a.json.portal === 'admin', `portal trả về = ${a.json && a.json.portal}`);

      const b = await dangNhap(P + '_hv', pw, 'admin');
      t.eq('TC-P2 · học viên khai cổng "Ban quản lý" → phải 403', b.status, 403, `HTTP ${b.status} — ${b.json && b.json.error}`);
      t.ok('TC-P2b · … và không cấp vé', b.cookie === false, b.cookie ? 'CÓ set-cookie!' : 'không có set-cookie (đúng)');

      // ===== Cổng rác / cổng độc: không được sập, cũng không được nhận nhầm
      for (const rac of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
        const r = await dangNhap(P + '_hv', pw, rac);
        t.ok(`TC-P3 · portal="${rac}" (thuộc tính kế thừa của Object) → không được 5xx`,
          r.status < 500, `HTTP ${r.status}${r.status >= 500 ? ' — máy chủ VỠ vì tra CONG[...] ăn cả prototype' : ''}`);
      }

      // ===== Đường bình thường không được hỏng
      const c = await dangNhap(P + '_nv', pw, 'admin');
      t.eq('Đường bình thường · nhân viên vào đúng cổng "Ban quản lý"', c.status, 200, `HTTP ${c.status}`);
      t.ok('Đường bình thường · … và có cấp vé', c.cookie === true, c.cookie ? 'có set-cookie' : 'KHÔNG cấp vé dù đăng nhập đúng!');

      const d = await dangNhap(P + '_hv', pw, 'student');
      t.eq('Đường bình thường · học viên vào đúng cổng "Học viên"', d.status, 200, `HTTP ${d.status}`);

      // Bộ test cũ (và harness) đăng nhập KHÔNG gửi portal — phải giữ nguyên đường đó, nếu không
      // 250+ case còn lại gãy hàng loạt.
      const e = await dangNhap(P + '_hv', pw, undefined);
      t.eq('Đường bình thường · không gửi portal → vẫn vào được (harness đang dùng đường này)', e.status, 200, `HTTP ${e.status}`);

      // ===== Nhầm cổng KHÔNG phải đăng nhập sai, nên không được tính vào bộ đếm khoá tài khoản
      for (let i = 0; i < 3; i++) await dangNhap(P + '_hv', pw, 'admin');
      const f = await dangNhap(P + '_hv', pw, 'student');
      t.eq('TC-P4 · nhầm cổng 3 lần rồi vào đúng cổng → không bị khoá oan', f.status, 200,
        `HTTP ${f.status}${f.status === 429 ? ' — bị khoá vì nhầm cổng, sai nghiệp vụ' : ''}`);
    } finally {
      await clean(t.db);
    }
  },
};
