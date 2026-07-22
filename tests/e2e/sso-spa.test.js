// SSO luồng SPA (không secret): /config trả tenantId+clientId cho trình duyệt tự dựng luồng; /verify
// nhận id_token trình duyệt gửi về, KIỂM chữ ký JWKS rồi mới cấp cookie (id_token rác -> từ chối).
const { BASE } = require('../lib/harness');
const KEYS = ['sso_enabled', 'sso_tenant_id', 'sso_client_id', 'sso_client_secret', 'sso_allowed_domains'];
const setS = (db, k, v) => db.query(
  `INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`, [k, v]);

module.exports = {
  name: 'SSO SPA — /config trả tenantId+clientId (không secret) + /verify kiểm id_token',
  needsServer: true,

  async run(t) {
    const old = {};
    for (const k of KEYS) { const r = await t.db.query('SELECT value FROM settings WHERE key=$1', [k]); old[k] = r.rows[0] ? r.rows[0].value : null; }
    try {
      await setS(t.db, 'sso_client_secret', '');
      await setS(t.db, 'sso_tenant_id', 'test-tenant-id');
      await setS(t.db, 'sso_client_id', 'test-client-id');
      await setS(t.db, 'sso_allowed_domains', '');
      await setS(t.db, 'sso_enabled', 'true');

      const cfg = await t.api('GET', '/api/auth/sso/config');
      t.ok('/config trả tenantId + clientId (để trình duyệt tự dựng luồng SPA)',
        cfg.json && cfg.json.tenantId === 'test-tenant-id' && cfg.json.clientId === 'test-client-id', JSON.stringify(cfg.json));
      t.ok('/config KHÔNG lộ client_secret', cfg.json && !('clientSecret' in cfg.json) && !('client_secret' in cfg.json), JSON.stringify(cfg.json));

      // id_token rác -> server phải TỪ CHỐI ở bước kiểm chữ ký (không cấp cookie bừa).
      const bad = await t.api('POST', '/api/auth/sso/verify', null, { id_token: 'khong-phai-jwt-hop-le' });
      t.eq('/verify từ chối id_token rác (kiểm chữ ký JWKS) → 401', bad.status, 401, `HTTP ${bad.status} ${JSON.stringify(bad.json)}`);
      t.ok('/verify KHÔNG cấp cookie khi token sai', bad.status === 401, 'phải 401');

      const empty = await t.api('POST', '/api/auth/sso/verify', null, {});
      t.eq('/verify thiếu id_token → 400', empty.status, 400, `HTTP ${empty.status}`);
    } finally {
      for (const k of KEYS) { if (old[k] !== null) await setS(t.db, k, old[k]); }
      if (old['sso_enabled'] === null) await setS(t.db, 'sso_enabled', 'false');
    }
  },
};
