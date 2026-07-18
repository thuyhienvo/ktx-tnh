// === app-requests-checkin.js — tach tu app.js (CHANG 4 refactor). Classic script, GIU global scope cho onclick. ===
// KHONG doi thu tu nap trong index.html; boot()/chong-bam/click-listener nam o app-portals-boot.js (cuoi).
async function viewRequests() {
  const view = ST.view;
  el('content').innerHTML = '<div class="spinner"></div>';
  let apps = [], damage = [], couts = [], vios = [], vstats = null;
  try { [apps, damage, couts, vios, vstats] = await Promise.all([API.applications(), API.damageAll(), API.checkoutReqs(), API.violations(), API.violationStats().catch(() => null)]); }
  catch (e) { return toast(e.message, 'err'); }
  Object.assign(ST, { applications: apps, damage, couts, vstats }); updateNavBadges();
  const threshold = (vstats && vstats.threshold) || 3;

  // 5 trang nhóm "Tiếp nhận & hỗ trợ" dùng CHUNG một kiểu đầu panel: tiêu đề danh sách + số lượng + nút.
  // Không lặp lại tiêu đề/mô tả đã có ở thanh trên.
  let body = '', hd = '', actions = '', note = '', banner = '';
  if (view === 'reg') {
    hd = `${IC.filePen} Đơn đăng ký (${apps.length})`;
    actions = `<button class="btn sm pri" onclick="appForm()">${IC.plus} Tạo đơn đăng ký</button>`;
    note = `${IC.info} Mọi học viên đều vào qua đơn đăng ký rồi duyệt. Học viên tự đăng ký tại trang công khai, hoặc admin tạo đơn hộ tại đây.`;
    body = (apps.length ? `<div class="table-wrap"><table><thead><tr><th>Ngày gửi</th><th>Họ tên</th><th>SĐT</th><th>GT</th><th>Hình thức</th><th>Nguyện vọng</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${apps.map(a => `<tr>
        <td>${fmtDate(String(a.created_at).slice(0, 10))}</td>
        <td><strong>${esc(a.name)}</strong>${a.class_name ? `<div class="muted" style="font-size:11px">${esc(a.class_name)}</div>` : ''}${a.facility_name ? `<div class="sub2">${IC.building} ${esc(a.facility_name)}</div>` : ''}</td>
        <td>${esc(a.phone)}</td><td>${genderLabel(a.gender)}</td>
        <td class="muted" style="font-size:12px">${RENTAL_LABEL[a.rental_type] || 'Thuê ghép'}</td>
        <td class="muted" style="font-size:12px">${esc(a.pref || '')}${a.wants_washing ? `<div>${IC.washer} Máy giặt</div>` : ''}${a.wants_parking || a.plate ? `<div>${IC.bike} Gửi xe${a.plate ? ' · ' + esc(a.plate) : ''}</div>` : ''}${a.note ? `<div>${esc(a.note)}</div>` : ''}${noteLine(a.admin_note)}</td>
        <td>${a.status === 'pending' ? '<span class="badge amber">Chờ duyệt</span>' : a.status === 'approved' ? '<span class="badge green">Đã thêm</span>' : '<span class="badge gray">Từ chối</span>'}</td>
        <td class="num"><div class="rowbtns" style="justify-content:flex-end">
          ${a.status === 'pending' ? `<button class="btn sm green" onclick='approveForm(${JSON.stringify(a).replace(/'/g, "&#39;")})'>${IC.plus} Thêm vào phòng</button><button class="btn sm" onclick="rejectApp(${a.id})">Từ chối</button>` : ''}
          <button class="btn sm ghost" title="Ghi chú" onclick="noteForm('app', ${a.id})">${IC.filePen}</button>
          <button class="btn sm ghost" onclick="delApp(${a.id})">${IC.trash}</button>
        </div></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">Chưa có đơn đăng ký nào.</div>');
  } else if (view === 'checkout') {
    hd = `${IC.logOut} Đơn trả phòng (${couts.length})`;
    body = couts.length ? `<div class="table-wrap"><table><thead><tr><th>Ngày gửi</th><th>Học viên</th><th>Phòng</th><th>Ngày muốn trả</th><th>Lý do</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${couts.map(c => `<tr>
        <td>${fmtDate(String(c.created_at).slice(0, 10))}</td>
        <td>${esc(c.student_name || '—')}</td><td>${esc(c.room_name || '—')}</td>
        <td>${fmtDate(c.desired_date)}</td>
        <td>${REASON_LABEL[c.reason] || 'Khác'}${c.note ? `<div class="muted" style="font-size:12px">${esc(c.note)}</div>` : ''}${noteLine(c.admin_note)}</td>
        <td>${c.status === 'done' ? '<span class="badge green">Đã trả phòng</span>' : c.status === 'rejected' ? '<span class="badge gray">Từ chối</span>' : '<span class="badge amber">Chờ duyệt</span>'}</td>
        <td class="num"><div class="rowbtns" style="justify-content:flex-end">
          ${c.status === 'pending' ? `<button class="btn sm danger" onclick="confirmCout(${c.id})">Xác nhận trả phòng</button><button class="btn sm" onclick="rejectCout(${c.id})">Từ chối</button>` : ''}
          <button class="btn sm ghost" title="Ghi chú" onclick="noteForm('cout', ${c.id})">${IC.filePen}</button>
        </div></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">Chưa có đơn trả phòng.</div>';
  } else if (view === 'repair') {
    // Chỉ báo hư hỏng cơ sở vật chất (category=damage) → duyệt & chuyển bảo trì
    const ds = damage.filter(d => (d.category || 'damage') === 'damage');
    const tbl = ds.length ? `<div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Học viên</th><th>Phòng</th><th>Nội dung</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${ds.map(d => `<tr>
        <td>${fmtDate(String(d.created_at).slice(0, 10))}</td>
        <td>${esc(d.student_name || '—')}</td><td>${esc(d.room_name || '—')}</td>
        <td><strong>${esc(d.title)}</strong>${d.description ? `<div class="muted" style="font-size:12px">${esc(d.description)}</div>` : ''}${noteLine(d.admin_note)}</td>
        <td>${d.status === 'done' ? '<span class="badge green">Đã xử lý</span>'
          : d.status === 'blocked' ? `<span class="badge red">Bảo trì: chưa xử lý được</span>${d.admin_note ? `<div style="font-size:11px;color:var(--red-ink)">Lý do: ${esc(d.admin_note)}</div>` : ''}`
          : d.assigned_at ? `<span class="badge blue">${IC.wrench} Đã chuyển bảo trì</span>`
          : d.status === 'processing' ? '<span class="badge blue">Đang xử lý</span>' : '<span class="badge amber">Mới</span>'}</td>
        <td class="num"><div class="rowbtns" style="justify-content:flex-end">
          ${!d.assigned_at && d.status !== 'done' ? `<button class="btn sm pri" onclick="assignMaint(${d.id})">${IC.wrench} Duyệt & chuyển bảo trì</button>` : ''}
          <button class="btn sm ghost" title="Ghi chú" onclick="noteForm('damage', ${d.id})">${IC.filePen}</button>
        </div></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">Chưa có báo hư hỏng cơ sở vật chất nào.</div>';
    hd = `${IC.wrench} Báo hư hỏng (${ds.length})`;
    note = `${IC.info} Duyệt & chuyển bộ phận bảo trì xử lý.`;
    body = tbl;
  } else if (view === 'violations') {
    const vioRows = vios.map(v => `<tr>
      <td>${fmtDate(v.date)}</td>
      <td><a href="#" onclick="studentDetail(${v.student_id});return false"><strong>${esc(v.student_name)}</strong></a>${v.student_code ? `<div class="muted" style="font-size:11px">${esc(v.student_code)}</div>` : ''}${v.room_name ? `<div class="muted" style="font-size:11px">${esc(v.room_name)}</div>` : ''}</td>
      <td>${esc(v.type_name)}${v.note ? `<div class="muted" style="font-size:12px">${esc(v.note)}</div>` : ''}</td>
      <td>${vioSevBadge(v.severity)}</td>
      <td class="num"><span class="badge ${v.level >= threshold ? 'red' : 'gray'}">Lần ${v.level}</span></td>
      <td>${v.notified_school ? '<span class="badge green">Đã báo</span>' : (v.level >= threshold ? '<span class="badge amber">Cần báo</span>' : '<span class="muted">—</span>')}</td>
      <td class="num"><div class="rowbtns" style="justify-content:flex-end">
        ${v.level >= threshold && !v.notified_school ? `<button class="btn sm" onclick="notifySchool(${v.student_id})">${IC.inbox} Gửi mail</button>` : ''}
        <button class="btn sm ghost" onclick="delViolation(${v.id})">${IC.trash}</button>
      </div></td></tr>`).join('');
    hd = `${IC.alert} Danh sách vi phạm (${vios.length})`;
    actions = `<button class="btn sm" onclick="violationStatsModal()">${IC.trendingUp} Thống kê</button>
      <button class="btn sm pri" onclick="violationForm()">${IC.plus} Ghi nhận vi phạm</button>`;
    banner = (vstats && vstats.needMail) ? `<div class="hint" style="background:var(--red-bg);border-color:#e3b8ad;color:var(--red-ink)">${IC.alert} <strong>${vstats.needMail} học viên</strong> vi phạm ≥ ${threshold} lần cần báo nhà trường. Cấu hình SMTP trong <a href="#" onclick="adminGo('settings');return false">Cài đặt</a> để gửi email tự động, hoặc bấm <strong>Gửi mail</strong> ở từng dòng.</div>` : '';
    body = vios.length ? `<div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Học viên</th><th>Loại vi phạm</th><th>Mức độ</th><th class="num">Lần</th><th>Nhà trường</th><th></th></tr></thead><tbody>${vioRows}</tbody></table></div>` : '<div class="empty">Chưa ghi nhận vi phạm nào. Bấm <strong>Ghi nhận vi phạm</strong> hoặc mở chi tiết học viên.</div>';
  } else {
    // Hộp thư góp ý: học viên báo vi phạm / cần hỗ trợ khác (category violation, other)
    const fb = damage.filter(d => ['violation', 'other'].includes(d.category));
    const tbl = fb.length ? `<div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Loại</th><th>Học viên</th><th>Phòng</th><th>Nội dung</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${fb.map(d => `<tr>
        <td>${fmtDate(String(d.created_at).slice(0, 10))}</td>
        <td>${supCatBadge(d.category)}</td>
        <td>${esc(d.student_name || '—')}</td><td>${esc(d.room_name || '—')}</td>
        <td><strong>${esc(d.title)}</strong>${d.description ? `<div class="muted" style="font-size:12px">${esc(d.description)}</div>` : ''}${noteLine(d.admin_note)}</td>
        <td>${d.status === 'done' ? '<span class="badge green">Đã xử lý</span>' : d.status === 'processing' ? '<span class="badge blue">Đang xử lý</span>' : '<span class="badge amber">Mới</span>'}</td>
        <td class="num"><div class="rowbtns" style="justify-content:flex-end">
          ${d.status === 'new' ? `<button class="btn sm" onclick="setDamage(${d.id},'processing')">Đang xử lý</button>` : ''}
          ${d.status !== 'done' ? `<button class="btn sm green" onclick="setDamage(${d.id},'done')">${IC.check} Xong</button>` : `<button class="btn sm" onclick="setDamage(${d.id},'new')">Mở lại</button>`}
          <button class="btn sm ghost" title="Ghi chú" onclick="noteForm('damage', ${d.id})">${IC.filePen}</button>
        </div></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">Chưa có góp ý / yêu cầu hỗ trợ nào.</div>';
    hd = `${IC.inbox} Góp ý / yêu cầu hỗ trợ (${fb.length})`;
    body = tbl;
  }
  el('content').innerHTML = `${banner}<div class="panel"><div class="hd"><h2>${hd}</h2>${actions ? `<div class="toolbar">${actions}</div>` : ''}</div>${note ? `<div class="pad muted" style="font-size:12.5px">${note}</div>` : ''}${body}</div>`;
}
/* ---- Ghi chú xử lý cho đơn hỗ trợ ---- */
function noteForm(type, id) {
  const cur = (type === 'app' ? (ST.applications.find(a => a.id === id) || {}).admin_note
    : type === 'cout' ? (ST.couts.find(c => c.id === id) || {}).admin_note
      : (ST.damage.find(d => d.id === id) || {}).admin_note) || '';
  openModal(`
    <div class="mh"><h3>${IC.filePen} Ghi chú xử lý</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb"><div class="field"><label>Ghi chú nội bộ <span class="opt">(chỉ quản lý thấy)</span></label><textarea id="nf_note" rows="4" placeholder="VD: đã gọi điện, hẹn xử lý...">${esc(cur || '')}</textarea></div></div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn pri" onclick="saveNote('${type}', ${id})">Lưu ghi chú</button></div>`);
  setTimeout(() => el('nf_note').focus(), 50);
}
async function saveNote(type, id) {
  const note = el('nf_note').value.trim();
  if (type === 'app') await guard(() => API.setAppNote(id, note));
  else if (type === 'cout') await guard(() => API.setCoutNote(id, note));
  else { const d = ST.damage.find(x => x.id === id) || {}; await guard(() => API.updateDamage(id, { status: d.status || 'new', admin_note: note })); }
  await refreshCache(); closeModal(); toast('Đã lưu ghi chú'); viewRequests();
}
const noteLine = n => n ? `<div class="sub2" style="color:var(--brand-d);white-space:pre-wrap;margin-top:3px">${IC.filePen} ${esc(n)}</div>` : '';

/* ---- Vi phạm / nhắc nhở ---- */
function violationForm(studentId) {
  const students = ST.students.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
  const sOpts = students.map(s => `<option value="${s.id}" ${studentId === s.id ? 'selected' : ''}>${esc(s.name)}${s.code ? ' (' + esc(s.code) + ')' : ''}</option>`).join('');
  const types = (ST.vtypes || []).filter(t => t.active !== false);
  const tOpts = types.map(t => `<option value="${t.id}">${esc(t.name)} — ${VIO_SEV[t.severity] ? VIO_SEV[t.severity][0] : ''}</option>`).join('');
  const thr = (ST.settings && ST.settings.violation_mail_threshold) || 3;
  openModal(`
    <div class="mh"><h3>${IC.alert} Ghi nhận vi phạm</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="field"><label>Học viên *</label><select id="vf_stu" ${studentId ? 'disabled' : ''}>${sOpts}</select></div>
      <div class="grid2">
        <div class="field"><label>Loại vi phạm *</label><select id="vf_type">${tOpts || '<option value="">(Chưa có loại — thêm trong Cài đặt)</option>'}</select></div>
        <div class="field"><label>Ngày</label><input id="vf_date" type="date" value="${today()}"></div>
      </div>
      <div class="field"><label>Ghi chú / diễn giải</label><textarea id="vf_note" rows="2" placeholder="Mô tả cụ thể sự việc..."></textarea></div>
      <div class="hint">${IC.info} Khi học viên vi phạm đủ <strong>${thr} lần</strong>, hệ thống sẽ gửi email cho nhà trường (nếu đã cấu hình SMTP trong Cài đặt).</div>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn pri" onclick="saveViolation(${studentId || 0})">Lưu vi phạm</button></div>`);
}
async function saveViolation(studentId) {
  const sid = studentId || +el('vf_stu').value;
  const type_id = +el('vf_type').value || null;
  if (!sid) return toast('Chọn học viên', 'err');
  if (!type_id) return toast('Chọn loại vi phạm (thêm trong Cài đặt nếu chưa có)', 'err');
  const r = await guard(() => API.createViolation({ student_id: sid, type_id, date: el('vf_date').value, note: el('vf_note').value.trim() }));
  await refreshCache(); closeModal();
  if (r.mail && r.mail.queued) toast(`Đã ghi vi phạm lần ${r.level} · đang gửi mail nhà trường…`);
  else toast(`Đã ghi nhận vi phạm lần ${r.level}`);
  studentDetailRefresh(sid);
}
async function delViolation(id, studentId) {
  if (!confirm('Xóa vi phạm này?')) return;
  await guard(() => API.deleteViolation(id)); await refreshCache(); toast('Đã xóa vi phạm');
  if (studentId && el('overlay').classList.contains('show')) studentDetail(studentId);
  else adminGo(ST.view);
}
async function notifySchool(studentId) {
  if (!confirm('Gửi email thông báo vi phạm cho nhà trường?')) return;
  const r = await guard(() => API.notifyViolation(studentId));
  await refreshCache();
  if (r.mail && r.mail.sent) toast('Đã gửi email cho nhà trường');
  else toast('Chưa gửi được email: ' + ((r.mail && r.mail.reason) || 'lỗi'), 'err');
  if (el('overlay').classList.contains('show')) studentDetail(studentId); else adminGo(ST.view);
}
async function violationStatsModal() {
  const st = await guard(() => API.violationStats(curMonth().slice(0, 4)));
  const sev = k => (st.bySeverity.find(x => x.severity === k) || { c: 0 }).c;
  openModal(`
    <div class="mh"><h3>${IC.trendingUp} Thống kê vi phạm</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="kpis" style="margin-bottom:16px">
        <div class="kpi"><span class="ic ic-gray">${IC.alert}</span><div><div class="v">${st.total}</div><div class="l">Tổng lượt vi phạm</div></div></div>
        <div class="kpi"><span class="ic ic-red">${IC.inbox}</span><div><div class="v">${st.needMail}</div><div class="l">HV cần báo nhà trường (≥${st.threshold})</div></div></div>
        <div class="kpi"><span class="ic ic-amber">${IC.flag}</span><div><div class="v">${sev('severe')}</div><div class="l">Vi phạm nghiêm trọng</div></div></div>
      </div>
      <h4 style="margin:6px 0 8px">Học viên vi phạm nhiều nhất</h4>
      ${st.byStudent.length ? `<div class="table-wrap"><table><thead><tr><th>Học viên</th><th>Phòng</th><th class="num">Số lần</th><th>Lần cuối</th><th>Nhà trường</th></tr></thead><tbody>
        ${st.byStudent.slice(0, 20).map(x => `<tr><td><a href="#" onclick="closeModal();studentDetail(${x.id});return false"><strong>${esc(x.name)}</strong></a>${x.code ? `<div class="muted" style="font-size:11px">${esc(x.code)}</div>` : ''}</td><td>${esc(x.room_name || '—')}</td><td class="num"><span class="badge ${x.cnt >= st.threshold ? 'red' : 'gray'}">${x.cnt}</span></td><td>${fmtDate(x.last_date)}</td><td>${x.notified ? '<span class="badge green">Đã báo</span>' : (x.cnt >= st.threshold ? '<span class="badge amber">Cần báo</span>' : '—')}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">Chưa có dữ liệu.</p>'}
      <h4 style="margin:16px 0 8px">Theo loại vi phạm</h4>
      ${st.byType.length ? `<div class="table-wrap"><table><thead><tr><th>Loại vi phạm</th><th class="num">Số lượt</th></tr></thead><tbody>
        ${st.byType.map(x => `<tr><td>${esc(x.type_name || '—')}</td><td class="num">${x.c}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">—</p>'}
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Đóng</button></div>`, true);
}

function approveForm(a) {
  openModal(`
    <div class="mh"><h3>${IC.plus} Thêm vào phòng: ${esc(a.name)}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <p class="muted">${esc(a.phone)} · ${genderLabel(a.gender)} · ${RENTAL_LABEL[a.rental_type] || 'Thuê ghép'}${a.pref ? ' · NV: ' + esc(a.pref) : ''}</p>
      ${a.wants_washing || a.wants_parking || a.plate ? `<div class="hint">Dịch vụ đăng ký: ${a.wants_washing ? `${IC.washer} Máy giặt ` : ''}${a.wants_parking || a.plate ? `${IC.bike} Gửi xe${a.plate ? ' (' + esc(a.plate) + ')' : ''}` : ''} — sẽ tự thêm khi duyệt.</div>` : ''}
      <div class="grid2">
        <div class="field"><label>Xếp phòng</label><select id="ap_room">${roomOptions('', a.gender)}</select></div>
        <div class="field"><label>Ngày vào</label><input id="ap_date" type="date" value="${today()}"></div>
      </div>
      <div style="background:var(--bg2);padding:12px;border-radius:10px;margin-bottom:12px">
        <div style="font-weight:600;font-size:13px;margin-bottom:10px">${IC.fileText} Hợp đồng thuê</div>
        <div class="grid2">
          <div class="field" style="margin:0 0 12px"><label>Số HĐ</label>
            <div class="flex" style="gap:6px"><input id="ap_cno" placeholder="03/2026/HDKTX-${legalEntity(a.gender)}" style="flex:1">
            <button type="button" class="btn sm" onclick="suggestApCno('${a.gender}')" title="Tạo số HĐ tự động">${IC.zap}</button></div></div>
          <div class="field" style="margin:0 0 12px"><label>Ngày ký HĐ</label><input id="ap_cdate" type="date" value="${today()}"></div>
        </div>
        <div class="field" style="margin:0"><label>Tình trạng HĐ</label><select id="ap_cstatus">
          ${['done', 'scanned', 'unsigned', 'none', 'handover'].map(k => `<option value="${k}">${CONTRACT_LABEL[k]}</option>`).join('')}
        </select></div>
      </div>
      <div style="background:var(--bg2);padding:12px;border-radius:10px;margin-bottom:12px">
        <label class="check"><input type="checkbox" id="ap_dep" checked onchange="el('ap_depamt').disabled=!this.checked"> ${IC.lock} Đã đóng cọc</label>
        <div class="field" style="margin:10px 0 0"><label>Số tiền cọc</label><input id="ap_depamt" type="number" min="0" value="${esc(ST.settings.deposit_fee)}"></div>
      </div>
      <label class="check" style="margin-top:8px"><input type="checkbox" id="ap_login" checked onchange="el('apLogin').style.display=this.checked?'block':'none'"> ${IC.key} Tạo tài khoản đăng nhập cho học viên</label>
      <div id="apLogin" style="background:var(--bg2);padding:12px;border-radius:10px;margin-top:8px">
        <div class="grid2">
          <div class="field" style="margin:0"><label>Tên đăng nhập <span class="opt">(trống = SĐT)</span></label><input id="ap_user" value="${esc(a.phone || '')}"></div>
          <div class="field" style="margin:0"><label>Mật khẩu</label><input id="ap_pass" type="text" value="123456"></div>
        </div>
      </div>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn pri" onclick="doApprove(${a.id})">Xác nhận thêm</button></div>`);
}
async function doApprove(id) {
  const body = {
    room_id: el('ap_room').value || null, check_in_date: el('ap_date').value,
    deposit_paid: el('ap_dep').checked, deposit_amount: +el('ap_depamt').value || 0,
    contract_no: el('ap_cno').value.trim(), contract_date: el('ap_cdate').value || null, contract_status: el('ap_cstatus').value,
  };
  if (el('ap_login').checked) { body.create_login = true; body.login_username = el('ap_user').value.trim(); body.login_password = el('ap_pass').value.trim(); }
  const r = await guard(() => withDuplicateGuide(() => withOverloadConfirm(ok => API.approveApplication(id, { ...body, confirm_overload: ok }))));
  if (r === null) return; // đã có hồ sơ / người dùng huỷ — modal kia đã chỉ đường
  if (r === null) return; // hủy ở hộp xác nhận quá tải
  await refreshCache(); closeModal();
  if (r.account) alert(`Đã thêm học viên & tạo tài khoản:\n\nTên đăng nhập: ${r.account.username}\nMật khẩu: ${r.account.password}\n\nGửi thông tin này cho học viên để đăng nhập.`);
  else toast('Đã thêm học viên vào phòng');
  viewRequests();
}
async function rejectApp(id) { if (!confirm('Từ chối đơn này?')) return; await guard(() => API.rejectApplication(id)); toast('Đã từ chối'); viewRequests(); }
async function delApp(id) { if (!confirm('Xóa đơn này?')) return; await guard(() => API.deleteApplication(id)); toast('Đã xóa'); viewRequests(); }
async function setDamage(id, status) { await guard(() => API.updateDamage(id, { status })); toast('Đã cập nhật'); viewRequests(); }
async function assignMaint(id) {
  if (!confirm('Duyệt báo hư hỏng này và chuyển cho bộ phận bảo trì xử lý?')) return;
  await guard(() => API.assignMaintenance(id));
  toast('Đã chuyển cho bộ phận bảo trì'); viewRequests();
}
async function confirmCout(id) { if (!confirm('Xác nhận trả phòng cho học viên này?')) return; await guard(() => API.confirmCheckoutReq(id, {})); await refreshCache(); toast('Đã trả phòng'); viewRequests(); }
async function rejectCout(id) { if (!confirm('Từ chối đơn trả phòng?')) return; await guard(() => API.rejectCheckoutReq(id)); toast('Đã từ chối'); viewRequests(); }

/* ---------- CHECK-IN / OUT ---------- */
function checkInForm(id) {
  const s = studentById(id);
  openModal(`
    <div class="mh"><h3>${IC.key} Check-in: ${esc(s.name)}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="grid2">
        <div class="field"><label>Ngày vào</label><input id="c_date" type="date" value="${today()}"></div>
        <div class="field"><label>Phòng</label><select id="c_room">${roomOptions(s.room_id, s.gender)}</select></div>
      </div>
      <div class="field"><label>Ghi chú</label><input id="c_note" placeholder="VD: quay lại ở"></div>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn green" onclick="doCheckIn(${id})">Xác nhận check-in</button></div>`);
}
async function doCheckIn(id) {
  const r = await guard(() => withOverloadConfirm(ok =>
    API.checkIn(id, { date: el('c_date').value, room_id: el('c_room').value || null, note: el('c_note').value.trim(), confirm_overload: ok })));
  if (r === null) return;
  await refreshCache(); closeModal(); toast('Đã check-in'); adminGo(ST.view);
}
function checkOutForm(id) {
  const s = studentById(id);
  openModal(`
    <div class="mh"><h3>${IC.doorOpen} Check-out: ${esc(s.name)}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="grid2">
        <div class="field"><label>Ngày báo trả phòng</label><input id="c_notice" type="date" value="${today()}"></div>
        <div class="field"><label>Ngày rời thực tế</label><input id="c_date" type="date" value="${today()}"></div>
      </div>
      <div class="field"><label>Lý do trả phòng</label><select id="c_reason">
        ${CHECKOUT_REASONS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
      </select></div>
      <div class="field"><label>Ghi chú</label><input id="c_note" placeholder="VD: hết hạn ở, chuyển đi..."></div>
      ${s.room_id ? meterField('c_meter', s.room_name, 'rời phòng') : ''}
      <div class="hint">${IC.info} App sẽ tự xét điều kiện hoàn cọc dựa trên ngày báo và lý do.</div>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn danger" onclick="doCheckOut(${id})">Xác nhận check-out</button></div>`);
}
async function doCheckOut(id) {
  const s = studentById(id);
  const meter = el('c_meter') ? el('c_meter').value.trim() : '';
  const r = await guard(() => API.checkOut(id, { date: el('c_date').value, notice_date: el('c_notice').value, reason: el('c_reason').value, note: el('c_note').value.trim(), meter_reading: meter || undefined }));
  await refreshCache(); closeModal();
  const nRoom = r.recalced_roommates ? r.recalced_roommates.length : 0;
  toast(r.recalced
    ? `Đã check-out · phiếu tháng tính lại ${r.recalced.days_stayed} ngày ở${nRoom ? ` · ${nRoom} bạn cùng phòng cũng được tính lại tiền điện` : ''}`
    : 'Đã check-out');
  if (s && s.deposit_status === 'held') depositSettlePrompt(id, r.refund);
  else adminGo(ST.view);
}
function depositSettlePrompt(id, refund) {
  openModal(`
    <div class="mh"><h3>${IC.lock} Xử lý tiền cọc</h3><button class="x" onclick="closeModal();adminGo(ST.view)">×</button></div>
    <div class="mb">
      <div class="hint" style="background:${refund.eligible ? '#dcfce7' : '#fee2e2'};border-color:${refund.eligible ? '#86efac' : '#fca5a5'};color:${refund.eligible ? '#15803d' : '#b91c1c'}">
        ${refund.eligible ? IC.checkCircle+' Đủ điều kiện hoàn cọc' : IC.alert+' Chưa đủ điều kiện hoàn cọc'} — ${esc(refund.reason)}
      </div>
      <p>Bạn muốn xử lý tiền cọc thế nào?</p>
    </div>
    <div class="mf">
      <button class="btn" onclick="closeModal();adminGo(ST.view)">Để sau</button>
      <button class="btn danger" onclick="settleDepositAndClose(${id},'forfeit')">Không hoàn (giữ cọc)</button>
      <button class="btn green" onclick="refundForm(${id})">Hoàn cọc (nhập STK)</button>
    </div>`);
}
async function settleDepositAndClose(id, action) {
  await guard(() => API.settleDeposit(id, { action }));
  await refreshCache(); closeModal(); toast(action === 'refund' ? 'Đã hoàn cọc' : 'Đã giữ cọc'); adminGo(ST.view);
}
let logFilter = 'all';
async function viewCheckin() {
  el('topActions').innerHTML = `<button class="btn green" onclick="quickPick('in')"><span class="dot-svg dot-green">${IC.dot}</span> Check-in nhanh</button><button class="btn danger" onclick="quickPick('out')"><span class="dot-svg" style="color:var(--red)">${IC.dot}</span> Check-out nhanh</button>`;
  el('content').innerHTML = '<div class="spinner"></div>';
  let logs = await guard(() => API.logs(logFilter === 'all' ? null : logFilter));
  el('content').innerHTML = `
    <div class="pill-row">
      <button class="btn sm ${logFilter === 'all' ? 'pri' : ''}" onclick="logFilter='all';viewCheckin()">Tất cả</button>
      <button class="btn sm ${logFilter === 'in' ? 'pri' : ''}" onclick="logFilter='in';viewCheckin()"><span class="dot-svg dot-green">${IC.dot}</span> Check-in</button>
      <button class="btn sm ${logFilter === 'out' ? 'pri' : ''}" onclick="logFilter='out';viewCheckin()"><span class="dot-svg" style="color:var(--red)">${IC.dot}</span> Check-out</button>
    </div>
    <div class="panel"><div class="hd"><h2>Lịch sử ra / vào (${logs.length})</h2></div><div class="table-wrap">${logsTable(logs)}</div></div>`;
}
function quickPick(type) {
  // Check-out nhanh: chỉ người ĐANG THỰC SỰ Ở (isOccupying — tính theo ngày). Trước đây dùng cột tĩnh
  // status==='in' nên HV "sắp vào" (status='in' nhưng chưa tới ngày nhận phòng) lọt vào pool check-out.
  const pool = type === 'in' ? ST.students.filter(s => s.status !== 'in') : ST.students.filter(isOccupying);
  if (!pool.length) return toast(type === 'in' ? 'Không có học viên nào đang ở ngoài' : 'Không có học viên nào đang ở', 'err');
  openModal(`
    <div class="mh"><h3>${type === 'in' ? IC.check+' Check-in nhanh' : IC.undo+' Check-out nhanh'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb"><div class="field"><label>Chọn học viên</label>
      <select id="q_stu">${pool.map(s => `<option value="${s.id}">${esc(s.name)} ${s.code ? '(' + esc(s.code) + ')' : ''}</option>`).join('')}</select></div></div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn pri" onclick="const id=+el('q_stu').value;closeModal();${type === 'in' ? 'checkInForm' : 'checkOutForm'}(id)">Tiếp tục</button></div>`);
}

/* ---------- TIỀN PHÒNG / HÓA ĐƠN ---------- */
let invMonth = curMonth(), invFilter = 'all', invSearch = '';
