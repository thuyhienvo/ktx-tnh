// Tài khoản nhận tiền (QR chuyển khoản): sai 1 chữ số BIN/số TK là chuyển NHẦM tài khoản.
// Backend phải chặn dữ liệu sai, KHÔNG lưu bừa — và trả tài khoản cho học viên để tự sinh QR.
async function restore(db, snap) {
  for (const k of ['bank_bin', 'bank_account_no', 'bank_account_name']) {
    await db.query(`INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [k, snap[k] || '']);
  }
}

module.exports = {
  name: 'Tài khoản nhận tiền (QR) — chặn dữ liệu sai, trả cho học viên',
  needsServer: true,

  async run(t) {
    const T = await t.login('admin', process.env.ADMIN_P);
    // Chụp lại giá trị hiện tại để trả về sau khi test
    const cur = (await t.db.query(`SELECT key,value FROM settings WHERE key IN ('bank_bin','bank_account_no','bank_account_name')`)).rows;
    const snap = {}; cur.forEach(r => snap[r.key] = r.value);

    // BIN sai (5 chữ số) → 400, KHÔNG lưu
    const rBad = await t.api('PUT', '/api/settings', T, { bank_bin: '12345', bank_account_no: '0011001234567' });
    t.ok('BIN 5 chữ số → 400 (không lưu)', rBad.status === 400, `HTTP ${rBad.status}`);

    // Số TK có chữ cái → 400
    const rBad2 = await t.api('PUT', '/api/settings', T, { bank_bin: '970436', bank_account_no: '00ABC11' });
    t.ok('Số tài khoản có chữ cái → 400', rBad2.status === 400, `HTTP ${rBad2.status}`);

    // Hợp lệ → lưu được
    const rOk = await t.api('PUT', '/api/settings', T, { bank_bin: '970436', bank_account_no: '0011001234567', bank_account_name: 'KY TUC XA ESUHAI' });
    t.ok('BIN 6 số + STK hợp lệ → lưu OK', rOk.status === 200, `HTTP ${rOk.status}`);
    const saved = (await t.db.query(`SELECT value FROM settings WHERE key='bank_bin'`)).rows[0];
    t.eq('bank_bin đã lưu đúng', saved && saved.value, '970436');

    // Học viên phải nhận được tài khoản qua /me/profile (để tự sinh QR) — KHÔNG lộ secret
    const stu = (await t.db.query(`SELECT u.username FROM users u WHERE u.role='student' AND u.student_id IS NOT NULL LIMIT 1`)).rows[0];
    if (stu) {
      // Đặt mật khẩu tạm để đăng nhập kiểm tra
      const bcrypt = require('bcryptjs');
      const hash = bcrypt.hashSync('__probe_pw_9', 10);
      const oldHash = (await t.db.query(`SELECT password_hash FROM users WHERE username=$1`, [stu.username])).rows[0].password_hash;
      await t.db.query(`UPDATE users SET password_hash=$1, must_change_password=false WHERE username=$2`, [hash, stu.username]);
      const St = await t.login(stu.username, '__probe_pw_9');
      const prof = await t.api('GET', '/api/me/profile', St);
      t.eq('Học viên nhận bank_bin qua /me/profile', prof.json && prof.json.bank_bin, '970436');
      t.ok('/me/profile KHÔNG chứa mật khẩu SMTP', !(prof.json && 'smtp_pass' in prof.json));
      await t.db.query(`UPDATE users SET password_hash=$1 WHERE username=$2`, [oldHash, stu.username]);
    }

    await restore(t.db, snap);
  },
};
