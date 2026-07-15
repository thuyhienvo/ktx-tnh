// TC-10 e2e — chuyển phòng / trả phòng giữa tháng: tiền điện có đi ĐÚNG NGƯỜI không,
// và tổng có rơi mất đồng nào không. Chạy trên CSDL thật, tự dọn sạch sau khi chạy.
const { fmt } = require('../lib/harness');

const M = '2026-07', UNIT = 3500;
const P = '__test_dien'; // tiền tố để dọn — không đụng dữ liệu thật

async function clean(db) {
  await db.query(`DELETE FROM invoices    WHERE student_id IN (SELECT id FROM students WHERE code LIKE '${P}%')`);
  await db.query(`DELETE FROM room_stays  WHERE student_id IN (SELECT id FROM students WHERE code LIKE '${P}%')`);
  await db.query(`DELETE FROM logs        WHERE student_id IN (SELECT id FROM students WHERE code LIKE '${P}%')`);
  await db.query(`DELETE FROM meter_reads       WHERE room_id IN (SELECT id FROM rooms WHERE name LIKE '${P}%')`);
  await db.query(`DELETE FROM electric_readings WHERE room_id IN (SELECT id FROM rooms WHERE name LIKE '${P}%')`);
  await db.query(`DELETE FROM students WHERE code LIKE '${P}%'`);
  await db.query(`DELETE FROM rooms    WHERE name LIKE '${P}%'`);
}

module.exports = {
  name: 'Tiền điện e2e — chốt chỉ số lúc rời phòng (TC-10)',
  needsServer: true,
  cleanup: t => clean(t.db),

  async run(t) {
    const T = await t.login('admin', process.env.ADMIN_P);
    await clean(t.db);

    const oldUnit = (await t.db.query(`SELECT value FROM settings WHERE key='electric_unit'`)).rows[0];
    await t.db.query(`UPDATE settings SET value=$1 WHERE key='electric_unit'`, [String(UNIT)]);

    const fac = (await t.db.query('SELECT id FROM facilities LIMIT 1')).rows[0].id;
    const mkRoom = async n => (await t.db.query(
      `INSERT INTO rooms (name, facility_id, capacity, gender, hang, monthly_fee) VALUES ($1,$2,8,'male','B',1000000) RETURNING id`,
      [P + n, fac])).rows[0].id;
    const mkStu = async (n, room) => (await t.db.query(
      `INSERT INTO students (code,name,gender,room_id,check_in_date,status,rental_type,residency_status)
       VALUES ($1,$1,'male',$2,'2026-07-01','in','ghep','unregistered') RETURNING id`, [P + n, room])).rows[0].id;
    const stay = (id, room) => t.db.query(`INSERT INTO room_stays (student_id,room_id,from_date,to_date) VALUES ($1,$2,'2026-07-01',NULL)`, [id, room]);
    const meter = (room, end) => t.db.query(`INSERT INTO electric_readings (room_id,month,reading_start,reading_end,kwh) VALUES ($1,$2,0,$3,$3)`, [room, M, end]);
    const elec = async ids => {
      const o = {};
      (await t.db.query(`SELECT student_id, electric_charge FROM invoices WHERE month=$1 AND student_id = ANY($2) AND deleted_at IS NULL`, [M, ids]))
        .rows.forEach(r => { o[r.student_id] = Number(r.electric_charge); });
      return o;
    };

    try {
      // ===== CHUYỂN PHÒNG giữa tháng — phòng A dùng 300 kWh, X chuyển đi 15/07, chốt 100 kWh
      const RA = await mkRoom('_A'), RB = await mkRoom('_B');
      const A1 = await mkStu('_A1', RA), A2 = await mkStu('_A2', RA), X = await mkStu('_X', RA);
      for (const id of [A1, A2, X]) await stay(id, RA);
      await meter(RA, 300); await meter(RB, 0);

      const tr = await t.api('POST', `/api/students/${X}/transfer`, T, { room_id: RB, date: '2026-07-15', meter_reading: 100 });
      t.ok('Chuyển phòng kèm chốt chỉ số → OK', tr.status === 200, `HTTP ${tr.status}`);

      const stays = (await t.db.query(`SELECT room_id, from_date, to_date FROM room_stays WHERE student_id=$1 ORDER BY from_date`, [X])).rows;
      t.ok('Giữ được dấu vết phòng CŨ (trước đây chuyển phòng là mất sạch)',
        stays.length === 2 && stays[0].room_id === RA && stays[0].to_date === '2026-07-14' && stays[1].room_id === RB,
        JSON.stringify(stays));

      const g = await t.api('POST', '/api/invoices/generate', T, { month: M });
      t.ok('Lập phiếu cả kỳ chạy được', g.status === 200, `HTTP ${g.status}`);

      const e = await elec([A1, A2, X]);
      // Chặng 1 (01→15): 100kWh = 350.000 — A1,A2 15 ngày + X 14 ngày (chuyển đi = hết ngày 14)
      // Chặng 2 (16→31): 200kWh = 700.000 — chỉ A1, A2
      t.ok('X VẪN PHẢI TRẢ phần điện đã dùng ở phòng cũ (cách cũ: X trả 0đ)', e[X] > 0, `X = ${fmt(e[X])}`);
      t.near('X trả đúng phần chặng 1 theo ngày ở (≈111.364)', e[X], 111364, 2);
      t.near('A1 không gánh thay (≈469.318 — cách cũ phải trả 525.000)', e[A1], 469318, 2);
      t.near('A2 không gánh thay (≈469.318)', e[A2], 469318, 2);
      t.eq('TỔNG 3 phiếu = ĐÚNG tiền điện phòng A, không rơi đồng nào', e[A1] + e[A2] + e[X], 300 * UNIT,
        `tổng ${fmt(e[A1] + e[A2] + e[X])} · phải ${fmt(300 * UNIT)}`);

      // ===== Chốt chỉ số SAI — phải chặn, và KHÔNG được chuyển phòng nửa vời
      for (const [nhan, val, vi] of [
        ['nhỏ hơn lần chốt trước (100)', 50, 'công-tơ không quay ngược được'],
        ['lớn hơn chỉ số cuối tháng (300)', 999, 'vượt chỉ số cuối tháng'],
        ['số âm', -5, 'chỉ số âm'],
        ['chữ "abc"', 'abc', 'không được âm thầm thành 0'],
      ]) {
        const r = await t.api('POST', `/api/students/${A1}/transfer`, T, { room_id: RB, date: '2026-07-20', meter_reading: val });
        t.ok(`Chốt chỉ số ${nhan} → phải CHẶN (${vi})`, r.status === 400, `HTTP ${r.status} — ${r.json && r.json.error}`);
      }
      const a1now = (await t.db.query('SELECT room_id FROM students WHERE id=$1', [A1])).rows[0];
      t.eq('Chốt chỉ số hỏng → KHÔNG được chuyển phòng nửa vời', a1now.room_id, RA, `A1 vẫn ở phòng ${a1now.room_id === RA ? 'cũ ✔' : 'MỚI ✘'}`);

      const same = await t.api('POST', `/api/students/${A1}/transfer`, T, { room_id: RA, date: '2026-07-20' });
      t.ok('Chuyển vào CHÍNH phòng đang ở → phải CHẶN', same.status === 400, `HTTP ${same.status} — ${same.json && same.json.error}`);

      // ===== TRẢ PHÒNG giữa tháng có chốt chỉ số
      await clean(t.db);
      const RC = await mkRoom('_C');
      const C1 = await mkStu('_C1', RC), C2 = await mkStu('_C2', RC);
      for (const id of [C1, C2]) await stay(id, RC);
      await meter(RC, 300);
      await t.api('POST', '/api/invoices/generate', T, { month: M });

      const co = await t.api('POST', `/api/students/${C2}/checkout`, T, { date: '2026-07-15', reason: 'personal', meter_reading: 100 });
      t.ok('Trả phòng kèm chốt chỉ số → OK', co.status === 200, `HTTP ${co.status}`);
      t.ok('Trả phòng → TỰ tính lại phiếu cho bạn cùng phòng ở lại',
        co.json && (co.json.recalced_roommates || []).includes(C1), 'tính lại cho: ' + JSON.stringify(co.json && co.json.recalced_roommates));

      const e2 = await elec([C1, C2]);
      t.eq('Người trả phòng 15/07 trả đúng nửa chặng 1 = 175.000', e2[C2], 175000, `được ${fmt(e2[C2])}`);
      t.eq('Người ở lại = 175.000 + 700.000 = 875.000', e2[C1], 875000, `được ${fmt(e2[C1])}`);
      t.eq('TỔNG khớp tiền điện phòng', e2[C1] + e2[C2], 300 * UNIT, `tổng ${fmt(e2[C1] + e2[C2])}`);

      // ===== Nhân viên QUÊN nhập chỉ số -> không được gãy
      await clean(t.db);
      const RD = await mkRoom('_D');
      const D1 = await mkStu('_D1', RD), D2 = await mkStu('_D2', RD);
      for (const id of [D1, D2]) await stay(id, RD);
      await meter(RD, 300);
      const co2 = await t.api('POST', `/api/students/${D2}/checkout`, T, { date: '2026-07-15', reason: 'personal' });
      t.ok('Không nhập chỉ số → vẫn trả phòng được (không bắt buộc)', co2.status === 200, `HTTP ${co2.status}`);
      await t.api('POST', '/api/invoices/generate', T, { month: M });
      const e3 = await elec([D1, D2]);
      t.eq('Quên chốt → quay về chia cả tháng theo ngày ở, TỔNG vẫn khớp', e3[D1] + e3[D2], 300 * UNIT, `tổng ${fmt(e3[D1] + e3[D2])}`);
      t.ok('Quên chốt → người ở ít ngày vẫn trả ít hơn', e3[D2] < e3[D1], `rời 15/07 ${fmt(e3[D2])} < ở cả tháng ${fmt(e3[D1])}`);
    } finally {
      await clean(t.db);
      if (oldUnit) await t.db.query(`UPDATE settings SET value=$1 WHERE key='electric_unit'`, [oldUnit.value]);
    }
  },
};
