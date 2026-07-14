/* ================= ĐIỀU PHỐI CHÍNH ================= */
function boot() {
  if (location.pathname.replace(/\/$/, '') === '/dang-ky') return renderPublicRegister();
  const user = Auth.user; // hint hiển thị; nguồn xác thực thật là cookie httpOnly
  if (!user) return renderLogin();
  if (user.must_change_password) return renderForceChangePw();
  if (user.role === 'admin' || user.role === 'staff') renderAdmin();
  else if (user.role === 'maintenance') renderMaintenance();
  else renderStudent();
}

/* ================= TRANG ĐĂNG KÝ CÔNG KHAI ================= */
async function renderPublicRegister() {
  el('app').innerHTML = `<div class="intro-loading"><div class="spinner"></div></div>`;
  let info = {};
  try { info = await API.publicInfo(); } catch (e) {}
  window._pubCccd = {};
  const dorm = esc(info.dorm_name || 'Ký túc xá Học viên');
  const imgCard = (key, def) => { const label = esc(info['imgcap_' + key] || def); return `<figure class="ph-img"><img src="/api/public/image/${key}" alt="${label}" loading="lazy" onerror="this.remove()"><span class="ph-ico">${IC.building}</span><figcaption>${label}</figcaption></figure>`; };
  const amen = (ico, label) => `<div class="amen-item"><span class="amen-ic">${ico}</span><span>${label}</span></div>`;
  const priceRow = (label, val, unit, note) => `<tr><td>${label}${note ? `<div class="price-sub">${note}</div>` : ''}</td><td class="num"><strong>${money(val)}</strong><span class="muted"> ${unit}</span></td></tr>`;
  const priceRowOpt = (label, val, unit) => `<tr><td>${label} <span class="price-opt">tùy chọn</span><div class="price-sub">Chỉ tính khi đăng ký sử dụng</div></td><td class="num"><strong>${money(val)}</strong><span class="muted"> ${unit}</span></td></tr>`;
  const T = (k, def) => esc(info[k] || def); // nội dung trang giới thiệu (admin chỉnh trong Cài đặt)
  el('app').innerHTML = `
  <div class="intro">
    <header class="intro-hero">
      <figure class="intro-hero-bg ph-img"><img src="/api/public/image/hero" alt="" onerror="this.remove()"><span class="ph-ico">${IC.building}</span></figure>
      <div class="intro-hero-in">
        <div class="intro-brand">${IC.home} <span>${dorm}</span></div>
        <h1>${T('intro_hero_title', 'Không gian nội trú\nan tâm & nề nếp').replace(/\n/g, '<br>')}</h1>
        <p>${info.address ? esc(info.address) + ' — ' : ''}${T('intro_hero_desc', 'chỗ ở tiện nghi, kỷ luật, đồng hành cùng học viên trên hành trình sang Nhật.')}</p>
        <div class="intro-stats">
          <div><b>${info.room_count != null ? info.room_count : '—'}</b><span>Phòng ở</span></div>
          <div><b>${info.bed_free != null ? info.bed_free : '—'}</b><span>Giường trống</span></div>
          <div><b>${money(info.room_fee).replace(' đ', '')}<small> đ</small></b><span>Thuê ghép / tháng</span></div>
        </div>
        <div class="intro-cta">
          <a class="btn pri lg" href="#dangky">${IC.filePen} Đăng ký nội trú</a>
        </div>
      </div>
    </header>

    <section class="intro-sec">
      <div class="intro-head"><span class="eyebrow">${T('intro_about_eyebrow', 'Về khu nội trú')}</span><h2>${T('intro_about_title', 'Khuôn viên ngăn nắp, an ninh, gần trường')}</h2>
        <p>${T('intro_about_desc', 'Khu nội trú bố trí gọn gàng với khu tự học, sinh hoạt chung và bảo vệ 24/7 — nơi học viên rèn nếp sống kỷ luật kiểu Nhật.')}</p></div>
      <div class="intro-gallery">
        ${imgCard('khuon-vien-1', 'Khuôn viên')}
        ${imgCard('khuon-vien-2', 'Sảnh sinh hoạt chung')}
        ${imgCard('khuon-vien-3', 'Khu tự học')}
      </div>
    </section>

    <section class="intro-sec alt">
      <div class="intro-head"><span class="eyebrow">${T('intro_rooms_eyebrow', 'Phòng ở')}</span><h2>${T('intro_rooms_title', 'Phòng ở tiện nghi, sạch sẽ')}</h2>
        <p>${T('intro_rooms_desc', 'Phòng ghép đầy đủ nội thất: giường tầng, tủ locker riêng, máy lạnh, kệ đồ — vệ sinh định kỳ.')}</p></div>
      <div class="intro-gallery">
        ${imgCard('phong-1', 'Phòng ghép')}
        ${imgCard('phong-2', 'Nội thất phòng')}
        ${imgCard('phong-3', 'Khu vệ sinh')}
      </div>
    </section>

    <section class="intro-sec">
      <div class="intro-head"><span class="eyebrow">Tiện ích</span><h2>${T('intro_amenities_title', 'Tiện ích & dịch vụ')}</h2></div>
      <div class="amen-grid">
        ${amen(IC.bed, 'Giường tầng · tủ locker riêng')}
        ${amen(IC.wifi, 'Wifi tốc độ cao')}
        ${amen(IC.washer, 'Máy giặt chung')}
        ${amen(IC.bike, 'Bãi giữ xe máy')}
        ${amen(IC.shield, 'An ninh, bảo vệ 24/7')}
        ${amen(IC.users, 'Nam · Nữ riêng tầng')}
        ${amen(IC.building, 'Khu tự học · sinh hoạt chung')}
        ${amen(IC.sparkles, 'Vệ sinh phòng định kỳ')}
      </div>
    </section>

    <section class="intro-sec alt">
      <div class="intro-head"><span class="eyebrow">Chi phí</span><h2>${T('intro_price_title', 'Bảng giá thuê phòng ở ghép')}</h2>
        <p>${T('intro_price_desc', 'Minh bạch theo từng khoản. Tiền điện tính theo công-tơ, chia đều số người ở phòng.')}</p></div>
      <div class="intro-price">
        <div class="price-form-tag">${IC.users} Hình thức: <strong>Thuê phòng ở ghép</strong> — nhiều học viên ở chung một phòng, chia sẻ chi phí</div>
        <table><tbody>
          <tr class="price-grp"><td colspan="2">${IC.calendar} Chi phí hằng tháng</td></tr>
          ${priceRow('Tiền phòng', info.room_fee, '/người/tháng')}
          ${priceRow('Tiền điện', info.electric_unit, '/kWh', 'Theo công-tơ, chia đều số người ở phòng')}
          ${priceRow('Tiền nước', info.water_fee, '/người/tháng')}
          ${priceRow('Dịch vụ chung', info.service_fee, '/người/tháng', 'Wifi, rác, an ninh 24/7')}
          ${priceRowOpt('Máy giặt', info.washing_fee, '/tháng')}
          ${priceRowOpt('Gửi xe máy', info.parking_fee, '/xe/tháng')}
          <tr class="price-grp"><td colspan="2">${IC.lock} Đóng một lần khi nhận phòng</td></tr>
          <tr class="price-hi"><td><strong>Tiền cọc</strong><div class="price-sub">${IC.checkCircle} Được hoàn lại khi trả phòng đúng quy định</div></td><td class="num"><strong>${money(info.deposit_fee)}</strong></td></tr>
        </tbody></table>
        <div class="price-callout">${IC.info} <strong>Khi nhận phòng, bạn đóng:</strong> tiền cọc <strong>${money(info.deposit_fee)}</strong> (được hoàn lại khi trả phòng) <strong>+ chi phí tháng đầu</strong> (tiền phòng, điện, nước, dịch vụ). Máy giặt và gửi xe chỉ tính khi bạn đăng ký sử dụng.</div>
        ${info.hotline ? `<a class="price-hotline" href="tel:${esc(String(info.hotline).replace(/\s/g, ''))}">${IC.phone}<span>Còn thắc mắc về chi phí? Gọi hotline <strong>${esc(info.hotline)}</strong></span></a>` : ''}
      </div>
    </section>

    <section class="intro-sec" id="dangky">
      <div class="intro-head"><span class="eyebrow">Đăng ký</span><h2>Đăng ký ở nội trú</h2>
        <p>Điền thông tin bên dưới, ban quản lý sẽ liên hệ xếp phòng cho bạn — không cần tài khoản.</p></div>
      <div class="intro-form"><div id="pubBody"><div class="spinner"></div></div></div>
    </section>

    <section class="intro-sec alt">
      <div class="intro-head"><span class="eyebrow">Liên hệ</span><h2>${T('intro_contact_title', 'Liên hệ & đường đến')}</h2>
        <p>${T('intro_contact_desc', 'Ghé thăm hoặc gọi cho ban quản lý để được tư vấn xếp phòng.')}</p></div>
      <div class="intro-contact">
        <div class="contact-info">
          ${info.address ? `<div class="ci-row">${IC.mapPin}<div><b>Địa chỉ</b><span>${esc(info.address)}</span></div></div>` : ''}
          ${info.hotline ? `<a class="ci-row" href="tel:${esc(String(info.hotline).replace(/\s/g, ''))}">${IC.phone}<div><b>Hotline</b><span>${esc(info.hotline)}</span></div></a>` : ''}
          <div class="ci-row">${IC.home}<div><b>${dorm}</b><span>Ban quản lý khu nội trú</span></div></div>
        </div>
        ${info.address ? `<div class="contact-map"><iframe title="Bản đồ" src="https://www.google.com/maps?q=${encodeURIComponent(info.address)}&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>` : ''}
      </div>
    </section>

    <footer class="intro-foot">${dorm}${info.hotline ? ` · Hotline: ${esc(info.hotline)}` : ''}${info.address ? ` · ${esc(info.address)}` : ''}</footer>
  </div>`;
  el('pubBody').innerHTML = `
    <form id="applyForm">
      <div class="grid2">
        <div class="field"><label>Họ tên *</label><input id="a_name" required></div>
        <div class="field"><label>Số điện thoại *</label><input id="a_phone" required></div>
      </div>
      ${info.facilities && info.facilities.length ? `<div class="field"><label>Cơ sở đăng ký *</label><select id="a_facility">${info.facilities.map(f => `<option value="${f.id}">${esc(f.name)}${f.address ? ' — ' + esc(f.address) : ''}</option>`).join('')}</select></div>` : ''}
      <div class="grid2">
        <div class="field"><label>Giới tính *</label><select id="a_gender"><option value="female">Nữ</option><option value="male">Nam</option></select></div>
        <div class="field"><label>Ngày sinh</label><input id="a_birth"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Mã học viên</label><input id="a_code"></div>
        <div class="field"><label>Lớp</label><input id="a_class"></div>
      </div>
      <div class="field"><label>Hình thức thuê</label><select id="a_rental"><option value="ghep">Thuê ghép (ở chung)</option><option value="phong">Thuê nguyên phòng</option></select></div>
      <div class="field"><label>Dịch vụ đăng ký thêm</label>
        <label class="check"><input type="checkbox" id="a_wash"> ${IC.washer} Máy giặt (${money(info.washing_fee)}/tháng)</label>
        <label class="check" style="margin-top:8px"><input type="checkbox" id="a_park" onchange="el('plateBox').style.display=this.checked?'block':'none'"> ${IC.bike} Gửi xe (${money(info.parking_fee)}/xe/tháng)</label>
        <div id="plateBox" style="display:none;margin-top:8px"><input id="a_plate" placeholder="Biển số xe (VD: 63-B4 508.58)"></div>
      </div>
      <div class="field"><label>Ảnh CCCD (2 mặt)</label>
        <div class="grid2">
          <div><div class="muted" style="font-size:12px;margin-bottom:4px">Mặt trước</div>
            <input type="file" id="a_cccd_front" accept="image/*" onchange="pubCccd(this,'front')"><div id="cccdFrontPrev" style="margin-top:6px"></div></div>
          <div><div class="muted" style="font-size:12px;margin-bottom:4px">Mặt sau</div>
            <input type="file" id="a_cccd_back" accept="image/*" onchange="pubCccd(this,'back')"><div id="cccdBackPrev" style="margin-top:6px"></div></div>
        </div>
      </div>
      <div class="field"><label>Ghi chú</label><textarea id="a_note" rows="2"></textarea></div>
      <button class="btn pri lg" type="submit">Gửi đăng ký</button>
    </form>`;
  attachDate(el('a_birth'), '');
  el('applyForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true; btn.textContent = 'Đang gửi...';
    const body = {
      name: el('a_name').value.trim(), phone: el('a_phone').value.trim(), gender: el('a_gender').value,
      birth_date: el('a_birth').dataset.iso || null, code: el('a_code').value.trim(), class_name: el('a_class').value.trim(),
      rental_type: el('a_rental').value, note: el('a_note').value.trim(),
      facility_id: el('a_facility') ? +el('a_facility').value : null,
      wants_washing: el('a_wash').checked, wants_parking: el('a_park').checked, plate: el('a_plate').value.trim(),
      cccd_front: window._pubCccd.front || null, cccd_back: window._pubCccd.back || null,
    };
    try {
      await API.publicApply(body);
      el('pubBody').innerHTML = `<div style="text-align:center;padding:20px">
        <div style="font-size:48px">${IC.checkCircle}</div>
        <h2 style="margin:12px 0 6px">Đã gửi đăng ký!</h2>
        <p class="muted">Cảm ơn ${esc(body.name)}. Quản lý ký túc xá sẽ liên hệ với bạn qua số <strong>${esc(body.phone)}</strong> để xếp phòng.</p>
      </div>`;
    } catch (err) { toast(err.message, 'err'); btn.disabled = false; btn.textContent = 'Gửi đăng ký'; }
  });
}
function pubCccd(input, side) {
  const f = input.files[0]; if (!f) return;
  if (f.size > 6 * 1024 * 1024) { input.value = ''; return toast('Ảnh quá lớn (tối đa 6MB)', 'err'); }
  const r = new FileReader();
  r.onload = () => { window._pubCccd[side] = r.result; el(side === 'front' ? 'cccdFrontPrev' : 'cccdBackPrev').innerHTML = `<img src="${r.result}" style="max-width:100%;max-height:130px;border-radius:8px;border:1px solid var(--line)">`; };
  r.readAsDataURL(f);
}

/* ================= ĐĂNG NHẬP ================= */
async function renderLogin() {
  el('app').innerHTML = `
    <div class="auth">
      <div class="auth-left">
        <div class="auth-brand">
          <span class="auth-logo">${IC.home}</span>
          <div>
            <div class="ab-title">KHU NỘI TRÚ ESUHAI</div>
            <div class="ab-sub">Hệ thống quản lý nội trú</div>
          </div>
        </div>
        <div class="auth-hero">
          <h1>Ở an tâm,<br>quen dần nếp Nhật.</h1>
          <p>Một chỗ ở yên tâm, sinh hoạt ngăn nắp — để nếp sống và sự kỷ luật của người Nhật dần thành thói quen.</p>
          <a class="auth-hero-link" href="/dang-ky">${IC.building} Xem giới thiệu khu nội trú →</a>
        </div>
      </div>
      <div class="auth-right">
        <div class="auth-form">
          <div class="auth-tabs">
            <button class="auth-tab active" data-t="admin" onclick="loginTab('admin')">${IC.shield} Ban quản lý</button>
            <button class="auth-tab" data-t="student" onclick="loginTab('student')">${IC.graduation} Học viên</button>
          </div>
          <h2>Đăng nhập</h2>
          <p class="sub" id="lgSub">Đăng nhập hệ thống quản lý ký túc xá.</p>
          <form id="loginForm">
            <div class="field"><label>Tài khoản</label><input id="lg_user" autocomplete="username" placeholder="Tên đăng nhập" autofocus></div>
            <div class="field"><label>Mật khẩu</label><input id="lg_pass" type="password" autocomplete="current-password" placeholder="Mật khẩu"></div>
            <button class="btn pri lg auth-btn" type="submit">Đăng nhập →</button>
          </form>
          <div id="lgStudentExtra" style="display:none">
            <div class="auth-or"><span>Chưa có tài khoản?</span></div>
            <a class="auth-card" href="/dang-ky">
              <span class="ac-ico">${IC.graduation}</span>
              <div><b>Xem giới thiệu &amp; đăng ký nội trú</b><small>Xem phòng ở, tiện ích, bảng giá và đăng ký — không cần tài khoản</small></div>
              <span class="ac-arrow">→</span>
            </a>
          </div>
        </div>
      </div>
    </div>`;
  el('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true; btn.textContent = 'Đang vào...';
    try {
      const r = await API.login(el('lg_user').value.trim(), el('lg_pass').value);
      Auth.user = r.user; // cookie phiên do server đặt; đây chỉ là thông tin hiển thị
      if (r.user.must_change_password) return renderForceChangePw();
      boot();
    } catch (err) { toast(err.message, 'err'); btn.disabled = false; btn.textContent = 'Đăng nhập →'; }
  });
}
function loginTab(t) {
  document.querySelectorAll('.auth-tab').forEach(b => b.classList.toggle('active', b.dataset.t === t));
  el('lgSub').textContent = t === 'student' ? 'Đăng nhập tài khoản học viên (do quản lý cấp).' : 'Đăng nhập hệ thống quản lý ký túc xá.';
  el('lgStudentExtra').style.display = t === 'student' ? '' : 'none';
}

// Bắt buộc đổi mật khẩu (tài khoản admin khởi tạo lần đầu)
function renderForceChangePw() {
  const u = Auth.user || {};
  el('app').innerHTML = `
    <div class="auth">
      <div class="auth-left">
        <div class="auth-brand"><span class="auth-logo">${IC.home}</span>
          <div><div class="ab-title">KHU NỘI TRÚ ESUHAI</div><div class="ab-sub">Bảo mật tài khoản</div></div></div>
        <div class="auth-hero">
          <h1>Đặt mật khẩu<br>của riêng bạn.</h1>
          <p>Đây là lần đăng nhập đầu tiên bằng mật khẩu khởi tạo. Vì an toàn, vui lòng đổi sang mật khẩu mới trước khi sử dụng hệ thống.</p>
        </div>
      </div>
      <div class="auth-right">
        <div class="auth-form">
          <h2>Đổi mật khẩu</h2>
          <p class="sub">Xin chào <strong>${esc(u.full_name || u.username || '')}</strong> — hãy tạo mật khẩu mới (tối thiểu 6 ký tự).</p>
          <form id="fcpForm">
            <div class="field"><label>Mật khẩu hiện tại</label><input id="fcp_old" type="password" autocomplete="current-password" placeholder="Mật khẩu khởi tạo" autofocus></div>
            <div class="field"><label>Mật khẩu mới</label><input id="fcp_new" type="password" autocomplete="new-password" placeholder="Tối thiểu 6 ký tự"></div>
            <div class="field"><label>Nhập lại mật khẩu mới</label><input id="fcp_new2" type="password" autocomplete="new-password" placeholder="Nhập lại"></div>
            <button class="btn pri lg auth-btn" type="submit">Cập nhật mật khẩu →</button>
          </form>
          <div class="auth-or"><span>hoặc</span></div>
          <button class="btn" style="width:100%" onclick="Auth.logout()">${IC.logOut} Đăng xuất</button>
        </div>
      </div>
    </div>`;
  el('fcpForm').addEventListener('submit', async e => {
    e.preventDefault();
    const oldP = el('fcp_old').value, n1 = el('fcp_new').value, n2 = el('fcp_new2').value;
    if (n1.length < 6) return toast('Mật khẩu mới tối thiểu 6 ký tự', 'err');
    if (n1 !== n2) return toast('Hai mật khẩu mới không khớp', 'err');
    const btn = e.submitter; btn.disabled = true; btn.textContent = 'Đang cập nhật...';
    try {
      await API.changePassword(oldP, n1);
      Auth.user = { ...Auth.user, must_change_password: false };
      toast('Đã đổi mật khẩu, chào mừng bạn!');
      boot();
    } catch (err) { toast(err.message, 'err'); btn.disabled = false; btn.textContent = 'Cập nhật mật khẩu →'; }
  });
}

/* ================================================================= */
/* ==============          GIAO DIỆN QUẢN LÝ          =============== */
/* ================================================================= */
const AdminTitles = {
  exec: ['Điều hành', 'Báo cáo lãnh đạo — KPI & biểu đồ'],
  dashboard: ['Tổng quan', 'Bảng điều khiển ký túc xá'],
  students: ['Học viên', 'Hồ sơ, hợp đồng, tạm trú'],
  rooms: ['Phòng', 'Danh sách phòng theo tầng / hạng / giới tính'],
  vehicles: ['Xe', 'Danh sách xe học viên gửi'],
  washing: ['Máy giặt', 'Học viên đăng ký dùng máy giặt'],
  checkin: ['Check-in / Check-out', 'Lịch sử ra / vào ký túc xá'],
  invoices: ['Tiền phòng', 'Hóa đơn hàng tháng, điện nước, cọc'],
  revenue: ['Dự báo doanh thu', 'Dự báo từ phiếu báo tiền phòng · đối chiếu Bravo (thu thật do Bravo quản lý)'],
  reg: ['Đăng ký ở nội trú', 'Duyệt đơn đăng ký vào ở'],
  checkout: ['Đăng ký trả phòng', 'Duyệt đơn xin trả phòng'],
  repair: ['Báo hư hỏng CSVC', 'Hư hỏng cơ sở vật chất → chuyển bảo trì'],
  violations: ['Quản lý vi phạm', 'Ghi nhận & theo dõi vi phạm học viên'],
  feedback: ['Hộp thư hỗ trợ / góp ý', 'Học viên báo vi phạm · cần hỗ trợ khác'],
  requests: ['Đăng ký ở nội trú', 'Duyệt đơn đăng ký vào ở'],
  audit: ['Lịch sử hệ thống', 'Lịch sử thao tác của quản lý & nhân viên'],
  settings: ['Cài đặt', 'Đơn giá, hạng phòng, cơ sở'],
};
const ADMIN_ONLY_VIEWS = ['exec', 'revenue', 'audit', 'settings'];
let ST = { view: 'dashboard', rooms: [], students: [], facilities: [], settings: {}, applications: [], damage: [], couts: [], logs: [], assets: [], vtypes: [] };

const G = { male: 'Nam', female: 'Nữ' };
const genderLabel = g => G[g] || g;
const legalEntity = g => g === 'female' ? (ST.settings.legal_female || 'E2') : (ST.settings.legal_male || 'S2');
const HANGS = ['A', 'B', 'C', 'D'];
// Công suất phòng (số giường) theo hạng
const HANG_CAP = { A: 5, B: 4, C: 4, D: 3 };
// Loại phòng: shared=cho thuê ghép · whole=thuê nguyên phòng · security=an ninh · staff=nhân viên công tác
const ROOM_TYPE = { shared: ['Cho thuê ghép', 'green'], whole: ['Thuê nguyên phòng', 'blue'], security: ['Phòng an ninh', 'amber'], staff: ['Nhân viên công tác', 'amber'] };
const roomType = r => (ROOM_TYPE[r.room_type] ? r.room_type : 'shared');
const roomIsShared = r => roomType(r) === 'shared';          // chỉ phòng ghép mới tính giường trống
const roomForRent = r => ['shared', 'whole'].includes(roomType(r)); // thuộc quỹ cho thuê (có doanh thu)
const roomTypeBadge = r => { const [l, c] = ROOM_TYPE[roomType(r)]; return `<span class="badge ${c}">${l}</span>`; };
// Giường trống chỉ đến từ phòng CHO THUÊ GHÉP còn slot (bỏ nguyên phòng / an ninh / nhân viên)
const availBedsOf = rooms => rooms.filter(roomIsShared).reduce((a, r) => a + Math.max(0, (+r.capacity || 0) - (+r.occupancy || 0)), 0);
const rentCapOf = rooms => rooms.filter(roomForRent).reduce((a, r) => a + (+r.capacity || 0), 0);
const RENTAL_LABEL = { ghep: 'Thuê ghép', phong: 'Thuê nguyên phòng' };
const RESI = { registered: ['Đã đăng ký', 'green'], processing: ['Đang xử lý', 'amber'], unregistered: ['Chưa đăng ký', 'gray'] };
const resiBadge = st => { const [l, c] = RESI[st] || RESI.unregistered; return `<span class="badge ${c}">${l}</span>`; };
const CONTRACT_LABEL = { done: 'Đã hoàn tất', scanned: 'Đã scan HĐ', unsigned: 'Chưa ký HĐ', none: 'Không ký HĐ', handover: 'Đã ký phiếu bàn giao' };
const CONTRACT_BADGE = { done: 'green', scanned: 'blue', unsigned: 'amber', none: 'gray', handover: 'blue' };
const CHECKOUT_REASONS = [['departure', 'Xuất cảnh (đi Nhật)'], ['personal', 'Cá nhân'], ['facility', 'Cơ sở vật chất'], ['dropout', 'Nghỉ học'], ['reserve', 'Bảo lưu'], ['other', 'Khác']];
const REASON_LABEL = { departure: 'Xuất cảnh', personal: 'Cá nhân', facility: 'Cơ sở vật chất', dropout: 'Nghỉ học', reserve: 'Bảo lưu', other: 'Khác', normal: 'Khác', urgent_visa: 'Xuất cảnh' };
const VIO_SEV = { minor: ['Nhẹ', 'gray'], major: ['Nặng', 'amber'], severe: ['Nghiêm trọng', 'red'] };
const INTRO_FIELDS = [
  ['intro_hero_title', 'Tiêu đề lớn (hero) — Enter để xuống dòng', 'ta'],
  ['intro_hero_desc', 'Mô tả dưới tiêu đề (địa chỉ tự thêm phía trước)', 'ta'],
  ['intro_about_eyebrow', 'Mục "Về khu nội trú" — nhãn nhỏ', 'in'],
  ['intro_about_title', 'Mục "Về khu nội trú" — tiêu đề', 'in'],
  ['intro_about_desc', 'Mục "Về khu nội trú" — mô tả', 'ta'],
  ['intro_rooms_eyebrow', 'Mục "Phòng ở" — nhãn nhỏ', 'in'],
  ['intro_rooms_title', 'Mục "Phòng ở" — tiêu đề', 'in'],
  ['intro_rooms_desc', 'Mục "Phòng ở" — mô tả', 'ta'],
  ['intro_amenities_title', 'Mục "Tiện ích" — tiêu đề', 'in'],
  ['intro_price_title', 'Mục "Bảng giá" — tiêu đề', 'in'],
  ['intro_price_desc', 'Mục "Bảng giá" — mô tả', 'ta'],
  ['intro_contact_title', 'Mục "Liên hệ" — tiêu đề', 'in'],
  ['intro_contact_desc', 'Mục "Liên hệ" — mô tả', 'ta'],
];
const INTRO_MEDIA = [
  ['hero', 'Ảnh nền đầu trang (toàn cảnh)'],
  ['khuon-vien-1', 'Khuôn viên'],
  ['khuon-vien-2', 'Sảnh sinh hoạt chung'],
  ['khuon-vien-3', 'Khu tự học'],
  ['phong-1', 'Phòng ghép'],
  ['phong-2', 'Nội thất phòng'],
  ['phong-3', 'Khu vệ sinh'],
];
const vioSevBadge = sev => { const [l, c] = VIO_SEV[sev] || VIO_SEV.minor; return `<span class="badge ${c}">${l}</span>`; };

// Trạng thái tự tính theo ngày
function liveStatus(s) {
  const t = today(), ci = s.check_in_date && s.check_in_date.slice(0, 10), co = s.check_out_date && s.check_out_date.slice(0, 10);
  if (co && co <= t) return 'left';
  if (ci && ci > t) return 'upcoming';
  if (co && co > t) return 'leaving';
  return 'staying';
}
const STATUS_INFO = {
  upcoming: ['Sắp vào', 'blue'], staying: ['Đang ở', 'green'], leaving: ['Sắp trả', 'amber'], left: ['Đã trả', 'gray'],
};
const statusBadge = s => { const [l, c] = STATUS_INFO[liveStatus(s)]; return `<span class="badge ${c}">${l}</span>`; };
const isOccupying = s => ['staying', 'leaving'].includes(liveStatus(s));

// ---- Rule hợp đồng thuê ghép (điểm 5 — Sếp) ----
const DAY_MS = 86400000;
function stayDays(s) { // số ngày đã vào ở tính đến hôm nay
  const ci = s.check_in_date && s.check_in_date.slice(0, 10); if (!ci) return 0;
  return Math.floor((Date.parse(today()) - Date.parse(ci)) / DAY_MS);
}
// Thuê ghép ngắn hạn: có ngày trả & ở < 2 tháng → chỉ cần phiếu bàn giao, không cần HĐ
function isShortTermGhep(s) {
  if (s.rental_type !== 'ghep' || !s.check_out_date || !s.check_in_date) return false;
  const d = (Date.parse(s.check_out_date.slice(0, 10)) - Date.parse(s.check_in_date.slice(0, 10))) / DAY_MS;
  return d > 0 && d < 60;
}
const contractSigned = s => ['done', 'scanned'].includes(s.contract_status);
// HV ở phòng an ninh / nhân viên công tác (không cho thuê) → không cần ký HĐ ghép
const studentRoomShared = s => { if (!s.room_id) return true; const r = roomById(s.room_id); return r ? roomIsShared(r) : true; };
// Thuê ghép dài hạn đang ở trong phòng cho thuê ghép → bắt buộc ký HĐ
const contractRequired = s => isOccupying(s) && s.rental_type === 'ghep' && !isShortTermGhep(s) && studentRoomShared(s);
// Báo động: bắt buộc HĐ, đã vào ở > 7 ngày mà vẫn chưa ký
const contractOverdue = s => contractRequired(s) && !contractSigned(s) && stayDays(s) > 7;
// Ngắn hạn nhưng chưa ký phiếu bàn giao
const handoverPending = s => isOccupying(s) && isShortTermGhep(s) && !['handover', 'done', 'scanned'].includes(s.contract_status);

// ---- Sắp xuất cảnh — điều phối phòng (giường sắp trống) ----
// Lấy ngày xuất cảnh: ưu tiên ngày dự kiến (Kaizen) + lịch trả phòng do xuất cảnh; chọn ngày TƯƠNG LAI gần nhất.
function nextDepartureDate(s) {
  const t = today();
  const cands = [s.expected_departure, (['departure', 'urgent_visa'].includes(s.checkout_reason) ? s.check_out_date : null)]
    .filter(Boolean).map(d => String(d).slice(0, 10)).filter(d => d >= t).sort();
  return cands[0] || '';
}
const willDepartSoon = s => isOccupying(s) && !!nextDepartureDate(s);

function renderAdmin() {
  const isAdmin = Auth.user.role === 'admin';
  el('app').innerHTML = `
    <div class="app">
      <aside class="side">
        <div class="logo">${IC.home} <span>Nội trú Esuhai</span></div>
        <nav id="nav">
          <div class="grp">Quản lý</div>
          ${isAdmin ? `<button data-v="exec"><span class="ico">${IC.gauge}</span><span class="lbl">Điều hành</span></button>` : ''}
          <button data-v="dashboard"><span class="ico">${IC.dashboard}</span><span class="lbl">Tổng quan</span></button>
          <button data-v="students"><span class="ico">${IC.users}</span><span class="lbl">Học viên</span></button>
          <button data-v="rooms"><span class="ico">${IC.doorOpen}</span><span class="lbl">Phòng</span></button>
          <button data-v="vehicles"><span class="ico">${IC.bike}</span><span class="lbl">Xe</span></button>
          <button data-v="washing"><span class="ico">${IC.washer}</span><span class="lbl">Máy giặt</span></button>
          <div class="grp">Vận hành</div>
          <button data-v="checkin"><span class="ico">${IC.key}</span><span class="lbl">Check-in / out</span></button>
          <button data-v="invoices"><span class="ico">${IC.wallet}</span><span class="lbl">Tiền phòng</span></button>
          ${isAdmin ? `<button data-v="revenue"><span class="ico">${IC.trendingUp}</span><span class="lbl">Dự báo doanh thu</span></button>` : ''}
          <div class="grp">Tiếp nhận & Hỗ trợ</div>
          <button data-v="reg"><span class="ico">${IC.filePen}</span><span class="lbl">Đăng ký ở nội trú</span><span class="cnt" id="navReg" style="display:none"></span></button>
          <button data-v="checkout"><span class="ico">${IC.logOut}</span><span class="lbl">Đăng ký trả phòng</span><span class="cnt" id="navCheckout" style="display:none"></span></button>
          <button data-v="repair"><span class="ico">${IC.wrench}</span><span class="lbl">Báo hư hỏng CSVC</span><span class="cnt" id="navRepair" style="display:none"></span></button>
          <button data-v="violations"><span class="ico">${IC.alert}</span><span class="lbl">Quản lý vi phạm</span><span class="cnt" id="navViol" style="display:none"></span></button>
          <button data-v="feedback"><span class="ico">${IC.inbox}</span><span class="lbl">Hộp thư hỗ trợ/góp ý</span><span class="cnt" id="navFeed" style="display:none"></span></button>
          ${isAdmin ? `<div class="grp">Hệ thống</div>
          <button data-v="audit"><span class="ico">${IC.history}</span><span class="lbl">Lịch sử</span></button>
          <button data-v="settings"><span class="ico">${IC.settings}</span><span class="lbl">Cài đặt</span></button>` : ''}
        </nav>
        <div class="foot">
          <div class="u">${esc(Auth.user.full_name || Auth.user.username)}</div>
          <div class="r muted" style="font-size:11px">${isAdmin ? 'Quản trị viên' : 'Nhân viên'}</div>
          <button onclick="changePwd()">${IC.key} Đổi mật khẩu</button>
          <button onclick="Auth.logout()">${IC.undo} Đăng xuất</button>
        </div>
      </aside>
      <div class="side-backdrop" id="sideBackdrop" onclick="toggleSide()"></div>
      <div class="main">
        <div class="top">
          <button class="hamburger" onclick="toggleSide()" aria-label="Menu">${IC.menu}</button>
          <div style="flex:1;min-width:0"><h1 id="pgTitle">Tổng quan</h1><div class="sub" id="pgSub"></div></div>
          <div class="flex" style="gap:10px">
            <button class="notif-bell" id="notifBell" title="Thông báo" onclick="toggleNotif(event)">${IC.bell}<span class="notif-dot" id="notifDot" style="display:none"></span></button>
            <div class="toolbar" id="topActions"></div>
          </div>
        </div>
        <div class="content" id="content"><div class="spinner"></div></div>
      </div>
    </div>`;
  document.querySelectorAll('#nav button').forEach(b => b.addEventListener('click', () => adminGo(b.dataset.v)));
  startTableResize();
  const qp = new URLSearchParams(location.search);
  const startView = qp.get('view');
  const views = ['exec', 'dashboard', 'students', 'rooms', 'vehicles', 'washing', 'checkin', 'invoices', 'revenue', 'reg', 'checkout', 'repair', 'violations', 'feedback', 'requests', 'audit', 'settings'];
  refreshCache().then(() => adminGo(views.includes(startView) ? startView : 'dashboard')).catch(e => toast(e.message, 'err'));
}

async function refreshCache() {
  const [rooms, students, facilities, settings, applications, damage, couts, logs, assets, vtypes, vstats] = await Promise.all([
    API.rooms(), API.students(), API.facilities(), API.settings(),
    API.applications().catch(() => []), API.damageAll().catch(() => []), API.checkoutReqs().catch(() => []), API.logs().catch(() => []), API.assets().catch(() => []),
    API.violationTypes().catch(() => []), API.violationStats().catch(() => ({ byStudent: [], needMail: 0, threshold: 3 })),
  ]);
  Object.assign(ST, { rooms, students, facilities, settings, applications, damage, couts, logs, assets, vtypes, vstats });
  updateNavBadges();
}
function updateNavBadges() {
  const dmg = ST.damage || [];
  const setBadge = (id, n) => { const b = el(id); if (b) { b.textContent = n; b.style.display = n ? '' : 'none'; } };
  setBadge('navReg', ST.applications.filter(a => a.status === 'pending').length);
  setBadge('navCheckout', ST.couts.filter(c => c.status === 'pending').length);
  setBadge('navRepair', dmg.filter(d => (d.category || 'damage') === 'damage' && d.status !== 'done').length);
  setBadge('navViol', (ST.vstats && ST.vstats.needMail) || 0);
  setBadge('navFeed', dmg.filter(d => ['violation', 'other'].includes(d.category) && d.status !== 'done').length);
  updateNotif();
}
/* ---- Trung tâm thông báo (chuông) ---- */
function notifItems() {
  const items = [];
  const pApps = ST.applications.filter(a => a.status === 'pending').length;
  const pDmg = ST.damage.filter(d => d.status !== 'done').length;
  const pCout = ST.couts.filter(c => c.status === 'pending').length;
  const needMail = (ST.vstats && ST.vstats.needMail) || 0;
  const refund = ST.students.filter(s => liveStatus(s) === 'left' && s.deposit_status === 'held').length;
  if (pApps) items.push({ n: pApps, ic: IC.filePen, tx: `${pApps} đơn đăng ký chờ duyệt`, act: `adminGo('reg')` });
  if (pDmg) items.push({ n: pDmg, ic: IC.wrench, tx: `${pDmg} báo hư hỏng chưa xử lý`, act: `adminGo('repair')` });
  if (pCout) items.push({ n: pCout, ic: IC.logOut, tx: `${pCout} đơn xin trả phòng`, act: `adminGo('checkout')` });
  if (needMail) items.push({ n: needMail, ic: IC.alert, tx: `${needMail} học viên vi phạm cần báo nhà trường`, act: `adminGo('violations')` });
  if (refund) items.push({ n: refund, ic: IC.handCoins, tx: `${refund} khoản cọc chờ hoàn (đã trả phòng)`, act: `quyCoc()` });
  return items;
}
function updateNotif() {
  const total = notifItems().reduce((a, i) => a + i.n, 0);
  const d = el('notifDot'); if (d) { d.textContent = total > 99 ? '99+' : total; d.style.display = total ? '' : 'none'; }
}
function toggleNotif(e) {
  if (e) e.stopPropagation();
  const old = el('notifPanel'); if (old) { old.remove(); document.removeEventListener('mousedown', _notifOutside, true); return; }
  const items = notifItems();
  const p = document.createElement('div'); p.className = 'notif-panel'; p.id = 'notifPanel';
  p.innerHTML = `<div class="notif-hd">${IC.bell} Thông báo — cần xử lý</div>${items.length ? items.map(i => `<button class="notif-item" onclick="el('notifPanel').remove();${i.act}">${i.ic}<span>${i.tx}</span></button>`).join('') : `<div class="notif-empty">${IC.checkCircle} Không có việc cần xử lý</div>`}`;
  document.body.appendChild(p);
  const r = el('notifBell').getBoundingClientRect();
  p.style.top = (r.bottom + 8) + 'px';
  p.style.right = Math.max(10, window.innerWidth - r.right) + 'px';
  setTimeout(() => document.addEventListener('mousedown', _notifOutside, true), 0);
}
function _notifOutside(e) {
  const p = el('notifPanel');
  if (p && !p.contains(e.target) && !e.target.closest('#notifBell')) { p.remove(); document.removeEventListener('mousedown', _notifOutside, true); }
}
/* ---- Menu trượt trên mobile ---- */
function toggleSide() {
  const s = document.querySelector('.side'), b = el('sideBackdrop');
  const open = s && s.classList.toggle('open');
  if (b) b.classList.toggle('show', !!open);
}
function closeSide() {
  const s = document.querySelector('.side'), b = el('sideBackdrop');
  if (s) s.classList.remove('open'); if (b) b.classList.remove('show');
}
function adminGo(view) {
  if (view === 'requests') view = 'reg'; // alias cũ → trang Đăng ký ở nội trú
  // Chặn nhân viên (staff) truy cập các mục dành riêng quản trị (kể cả deep-link)
  if (ADMIN_ONLY_VIEWS.includes(view) && Auth.user.role !== 'admin') view = 'dashboard';
  ST.view = view; closeSide();
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.v === view));
  el('pgTitle').textContent = AdminTitles[view][0];
  el('pgSub').textContent = AdminTitles[view][1];
  el('topActions').innerHTML = '';
  ({ exec: viewExec, dashboard: viewDashboard, students: viewStudents, rooms: viewRooms, vehicles: viewVehicles, washing: viewWashing, checkin: viewCheckin, invoices: viewInvoices, revenue: viewRevenue, reg: viewRequests, checkout: viewRequests, repair: viewRequests, violations: viewRequests, feedback: viewRequests, audit: viewAudit, settings: viewSettings }[view])();
}
const roomById = id => ST.rooms.find(r => r.id === id);
const studentById = id => ST.students.find(s => s.id === id);
const facilityName = id => { const f = ST.facilities.find(x => x.id === id); return f ? f.name : '—'; };

/* ---------- ĐIỀU HÀNH (DASHBOARD LÃNH ĐẠO) ---------- */
// Biểu đồ cột: tổng (xám) + đã thu (vàng) chồng lên
function svgBars(rows) {
  const W = 720, H = 240, pt = 16, pb = 30, pl = 6, pr = 6;
  const n = rows.length || 1;
  const max = Math.max(1, ...rows.map(r => r.total));
  const cw = (W - pl - pr) / n, bw = Math.min(34, cw * 0.5), ch = H - pt - pb;
  const yOf = v => pt + ch - (v / max) * ch;
  const g = rows.map((r, i) => {
    const x = pl + cw * i + (cw - bw) / 2, yt = yOf(r.total), yp = yOf(r.paid);
    return `<g><rect x="${x}" y="${yt}" width="${bw}" height="${(pt + ch - yt).toFixed(1)}" rx="3" fill="var(--line2)"><title>${monthLabel(r.month)} · Tổng ${money(r.total)}</title></rect>` +
      `<rect x="${x}" y="${yp}" width="${bw}" height="${(pt + ch - yp).toFixed(1)}" rx="3" fill="var(--brand)"><title>${monthLabel(r.month)} · Dự báo ${money(r.paid)}</title></rect>` +
      `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 10}" text-anchor="middle" font-size="10.5" fill="var(--muted)">${r.label}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" style="font-family:var(--sans)">${g}</svg>`;
}
// Biểu đồ tròn (donut)
function svgDonut(segs) {
  const total = segs.reduce((a, s) => a + s.value, 0) || 1;
  const R = 78, r = 48, cx = 90, cy = 90;
  let a0 = -Math.PI / 2;
  const p = (ang, rad) => `${(cx + rad * Math.cos(ang)).toFixed(2)} ${(cy + rad * Math.sin(ang)).toFixed(2)}`;
  const arcs = segs.filter(s => s.value > 0).map(s => {
    const a1 = a0 + (s.value / total) * Math.PI * 2, large = (a1 - a0) > Math.PI ? 1 : 0;
    const d = `M${p(a0, R)} A${R} ${R} 0 ${large} 1 ${p(a1, R)} L${p(a1, r)} A${r} ${r} 0 ${large} 0 ${p(a0, r)} Z`;
    a0 = a1;
    return `<path d="${d}" fill="${s.color}"><title>${s.label}: ${money(s.value)} · ${Math.round(s.value / total * 100)}%</title></path>`;
  }).join('');
  return `<svg viewBox="0 0 180 180" width="164" height="164">${arcs}</svg>`;
}
async function viewExec() {
  el('topActions').innerHTML = `<button class="btn" onclick="window.print()">${IC.printer} In / Lưu PDF</button>`;
  el('content').innerHTML = '<div class="spinner"></div>';
  const year = curMonth().slice(0, 4);
  const [rev, revPrev] = await Promise.all([guard(() => API.revenue(year)), API.revenue(String(+year - 1)).catch(() => [])]);
  const sum = (arr, k) => arr.reduce((a, m) => a + (+m[k] || 0), 0);
  const totalYear = sum(rev, 'total'), paidYear = sum(rev, 'paid'), prevYear = sum(revPrev, 'total');
  const collection = totalYear ? Math.round(paidYear / totalYear * 100) : 0;
  // Chỉ so cùng kỳ khi năm trước có dữ liệu đủ ý nghĩa (>=5% năm nay), tránh % ảo
  const yoy = (prevYear > totalYear * 0.05) ? Math.round((totalYear - prevYear) / prevYear * 100) : null;
  const occ = ST.students.filter(isOccupying).length;
  const capacity = rentCapOf(ST.rooms);               // giường thuộc quỹ cho thuê (ghép + nguyên phòng)
  const availBeds = availBedsOf(ST.rooms);            // giường trống: chỉ phòng ghép còn slot
  const occRate = capacity ? Math.round((capacity - availBeds) / capacity * 100) : 0;
  const outstanding = totalYear - paidYear;
  const dep = ST.students.filter(s => s.check_out_date && ['departure', 'urgent_visa'].includes(s.checkout_reason) && String(s.check_out_date).slice(0, 4) === year).length;
  const svcs = [
    ['Tiền phòng', sum(rev, 'room'), 'var(--brand)'], ['Điện', sum(rev, 'electric'), '#5f7ea3'],
    ['Nước', sum(rev, 'water'), '#4f8f63'], ['Dịch vụ', sum(rev, 'service'), '#b5822f'],
    ['Máy giặt', sum(rev, 'washing'), '#9a7bb0'], ['Gửi xe', sum(rev, 'parking'), '#c25545'], ['Khác', sum(rev, 'other'), '#8a8172'],
  ].filter(x => x[1] > 0);
  const svcTotal = svcs.reduce((a, s) => a + s[1], 0) || 1;
  const chartRows = rev.map(m => ({ month: m.month, label: m.month.slice(5), total: +m.total || 0, paid: +m.total || 0 })); // paid=total: chỉ hiển thị tiền phiếu báo (không track thu)
  const female = ST.students.filter(s => isOccupying(s) && s.gender === 'female').length;
  const male = occ - female;
  // --- Vận hành & tuân thủ (điểm 3): máy giặt · hợp đồng · hư hỏng · vi phạm ---
  const occStu = ST.students.filter(isOccupying);
  const signedC = s => ['done', 'scanned'].includes(s.contract_status);
  const cSigned = occStu.filter(signedC).length, cUnsigned = occStu.length - cSigned;
  const cPct = occStu.length ? Math.round(cSigned / occStu.length * 100) : 0;
  const cSignedF = occStu.filter(s => s.gender === 'female' && signedC(s)).length;
  const cSignedM = occStu.filter(s => s.gender === 'male' && signedC(s)).length;
  const cOverdue = occStu.filter(contractOverdue).length;
  const washUsers = occStu.filter(s => s.uses_washing).length;
  const washRev = sum(rev, 'washing');
  const dmg = (ST.damage || []).filter(d => (d.category || 'damage') === 'damage');
  const dmgDone = dmg.filter(d => d.status === 'done').length;
  const dmgBlocked = dmg.filter(d => d.status === 'blocked').length;
  const dmgOpen = Math.max(0, dmg.length - dmgDone - dmgBlocked);
  const dmgPct = dmg.length ? Math.round(dmgDone / dmg.length * 100) : 0;
  const vio = ST.vstats || {};
  const vioTotal = vio.total || 0, vioNeedMail = vio.needMail || 0;
  const sevMap = { light: 'Nhẹ', medium: 'Trung bình', heavy: 'Nặng' };
  const vioSev = (vio.bySeverity || []).map(x => `${sevMap[x.severity] || x.severity}: ${x.c}`).join(' · ');
  const es = (ico, cls, title, main, sub, bar, act) => `<div class="es${act ? ' clickable' : ''}" ${act ? `onclick="${act}"` : ''}><div class="es-h"><span class="es-ic ${cls}">${ico}</span>${title}</div><div class="es-v">${main}</div>${bar != null ? `<div class="es-bar"><div style="width:${bar}%"></div></div>` : ''}<div class="es-sub">${sub}</div></div>`;
  const kpi = (ic, cls, val, label, sub, act) => `<div class="kpi${act ? ' clickable' : ''}" ${act ? `onclick="${act}"` : ''}><span class="ic ${cls}">${ic}</span><div><div class="v">${val}</div><div class="l">${label}${sub ? ` · ${sub}` : ''}</div></div></div>`;

  el('content').innerHTML = `<div id="printArea">
    <div class="print-only" style="margin-bottom:14px"><h2 style="font-family:var(--serif);margin:0">${esc(ST.settings.dorm_name || 'Ký túc xá')} — Báo cáo điều hành ${year}</h2><div class="muted">Xuất ngày ${fmtDate(today())}</div></div>
    <div class="kpis">
      ${kpi(IC.userCheck, 'ic-green', occRate + '%', 'Tỉ lệ lấp đầy', occ + '/' + capacity + ' giường', "stuFilter='in';adminGo('students')")}
      ${kpi(IC.trendingUp, 'ic-brand', money(totalYear), 'Dự báo doanh thu ' + year, yoy != null ? (yoy >= 0 ? '▲' : '▼') + Math.abs(yoy) + '% vs ' + (+year - 1) : '', "adminGo('revenue')")}
      ${kpi(IC.users, 'ic-blue', occ, 'Học viên đang ở', '', "stuFilter='in';adminGo('students')")}
      ${kpi(IC.planeTakeoff, 'ic-gray', dep, 'Xuất cảnh năm ' + year, '', "stuFilter='departure';adminGo('students')")}
    </div>
    <div class="panel"><div class="hd"><h2>${IC.trendingUp} Dự báo doanh thu theo tháng — ${year}</h2><span class="muted" style="font-size:12px">Ước tính từ phiếu báo đã lập (thu thật do Bravo quản lý)</span></div>
    <div class="pad">${chartRows.some(r => r.total) ? svgBars(chartRows) : '<div class="empty">Chưa có phiếu báo năm này.</div>'}</div></div>
    <div class="grid2" style="align-items:start">
      <div class="panel" style="margin:0"><div class="hd"><h2>${IC.pie} Cơ cấu doanh thu dự báo</h2></div><div class="pad" style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
        ${svcs.length ? svgDonut(svcs.map(s => ({ label: s[0], value: s[1], color: s[2] }))) : '<div class="empty">Chưa có dữ liệu.</div>'}
        <div style="flex:1;min-width:170px">${svcs.map(s => `<div class="flex" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><span class="flex" style="gap:8px"><span style="width:11px;height:11px;border-radius:3px;background:${s[2]};display:inline-block"></span>${s[0]}</span><strong>${Math.round(s[1] / svcTotal * 100)}%</strong></div>`).join('')}</div>
      </div></div>
      <div class="panel" style="margin:0"><div class="hd"><h2>${IC.users} Lấp đầy &amp; cơ cấu học viên</h2></div><div class="pad">
        <div style="font-size:40px;font-weight:800;font-variant-numeric:tabular-nums">${occRate}%<span class="muted" style="font-size:15px;font-weight:600"> lấp đầy</span></div>
        <div style="height:12px;border-radius:99px;background:var(--bg2);overflow:hidden;margin:10px 0 18px"><div style="height:100%;width:${occRate}%;background:var(--brand)"></div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div><div class="muted" style="font-size:12.5px">Đang ở</div><div style="font-size:22px;font-weight:800">${occ}</div></div>
          <div><div class="muted" style="font-size:12.5px">Giường trống</div><div style="font-size:22px;font-weight:800">${availBeds}</div></div>
          <div><div class="muted" style="font-size:12.5px">Nữ · ${legalEntity('female')}</div><div style="font-size:19px;font-weight:700">${female}</div></div>
          <div><div class="muted" style="font-size:12.5px">Nam · ${legalEntity('male')}</div><div style="font-size:19px;font-weight:700">${male}</div></div>
        </div>
      </div></div>
    </div>
    <div class="panel"><div class="hd"><h2>${IC.shield} Vận hành &amp; Tuân thủ — ${year}</h2></div><div class="pad">
      <div class="exec-stats">
        ${es(IC.washer, 'ic-blue', 'Máy giặt', `${washUsers}<span> HV đang dùng</span>`, `Doanh thu năm: <strong>${money(washRev)}</strong>`, null, "stuFilter='washing';adminGo('students')")}
        ${es(IC.fileText, 'ic-brand', 'Hợp đồng', `${cSigned}<span> đã ký</span>`, `${cUnsigned} chưa ký · ${legalEntity('female')} ${cSignedF} / ${legalEntity('male')} ${cSignedM}${cOverdue ? ` · <strong style="color:var(--red-ink)">${cOverdue} ghép quá 7 ngày</strong>` : ''}`, cPct, "stuFilter='nocontract';adminGo('students')")}
        ${es(IC.wrench, 'ic-gray', 'Hư hỏng', `${dmg.length}<span> lượt báo</span>`, `Đã xử lý ${dmgDone} · đang xử lý ${dmgOpen} · chưa xử lý được ${dmgBlocked}`, dmgPct, "adminGo('repair')")}
        ${es(IC.alert, 'ic-red', 'Vi phạm', `${vioTotal}<span> lượt</span>`, `${vioNeedMail} HV cần báo trường${vioSev ? ' · ' + vioSev : ''}`, null, "adminGo('violations')")}
      </div>
    </div></div>
  </div>`;
}

/* ---------- TỔNG QUAN ---------- */
// Popup "Đăng ký tạm trú": 3 trạng thái, bấm từng trạng thái xem danh sách
function residencyModal() {
  const occ = ST.students.filter(isOccupying);
  const over = occ.filter(s => s.residency_status === 'unregistered' && stayDays(s) > 7).length;
  const proc = occ.filter(s => s.residency_status === 'processing').length;
  const reg = occ.filter(s => s.residency_status === 'registered').length;
  const row = (ico, label, n, filter, cls) => `<div class="todo ${n ? cls : 'calm'}" ${n ? `onclick="closeModal();stuFilter='${filter}';adminGo('students')"` : ''}><span class="ic">${ico}</span><span class="tx">${label}</span><span class="n">${n}</span></div>`;
  openModal(`
    <div class="mh"><h3>${IC.flag} Đăng ký tạm trú</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="hint">${IC.info} Tình trạng đăng ký tạm trú của học viên đang ở. Bấm từng nhóm để xem danh sách.</div>
      <div class="todo-grid" style="grid-template-columns:1fr;margin-top:10px">
        ${row(IC.alert, 'Chưa đăng ký (đã ở >7 ngày)', over, 'resi_overdue', 'bad')}
        ${row(IC.hourglass, 'Đang xử lý', proc, 'resi_processing', 'warn')}
        ${row(IC.checkCircle, 'Đã có tạm trú', reg, 'resi_registered', 'on')}
      </div>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Đóng</button></div>`);
}
// Popup gộp "Hợp đồng chưa hoàn thiện": 3 loại cần xử lý, bấm từng loại xem danh sách
function contractIssuesModal() {
  const occ = ST.students.filter(isOccupying);
  const nc = occ.filter(s => ['unsigned', 'none'].includes(s.contract_status)).length;
  const ov = occ.filter(contractOverdue).length;
  const ho = occ.filter(handoverPending).length;
  const row = (ico, label, n, filter, cls) => `<div class="todo ${n ? cls : 'calm'}" ${n ? `onclick="closeModal();stuFilter='${filter}';adminGo('students')"` : ''}><span class="ic">${ico}</span><span class="tx">${label}</span><span class="n">${n}</span></div>`;
  openModal(`
    <div class="mh"><h3>${IC.fileText} Hợp đồng chưa hoàn thiện</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="hint">${IC.info} Các nhóm cần hoàn thiện hợp đồng / bàn giao. Bấm từng nhóm để xem danh sách học viên.</div>
      <div class="todo-grid" style="grid-template-columns:1fr;margin-top:10px">
        ${row(IC.fileText, 'Hợp đồng chưa ký', nc, 'nocontract', 'warn')}
        ${row(IC.alert, 'Thuê ghép ở >7 ngày chưa ký HĐ (báo động)', ov, 'contract_overdue', 'bad')}
        ${row(IC.fileText, 'Ngắn hạn chưa ký bàn giao', ho, 'handover_pending', 'warn')}
      </div>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Đóng</button></div>`);
}
async function viewDashboard() {
  const occ = ST.students.filter(isOccupying);
  const inCount = occ.length;
  const upcoming = ST.students.filter(s => liveStatus(s) === 'upcoming').length;
  const leaving = ST.students.filter(s => liveStatus(s) === 'leaving').length;
  const capacity = rentCapOf(ST.rooms);           // tổng giường thuộc quỹ cho thuê (ghép + nguyên phòng)
  const beds = availBedsOf(ST.rooms);             // giường trống: CHỈ phòng cho thuê ghép còn slot
  const fullRooms = ST.rooms.filter(r => roomIsShared(r) && r.occupancy >= r.capacity && r.capacity > 0).length;
  const emptyRooms = ST.rooms.filter(r => roomIsShared(r) && r.occupancy === 0).length;
  const leftThisMonth = ST.students.filter(s => s.check_out_date && s.check_out_date.slice(0, 7) === curMonth()).length;
  const isDeparture = s => s.check_out_date && ['departure', 'urgent_visa'].includes(s.checkout_reason);
  const depMonth = ST.students.filter(s => isDeparture(s) && s.check_out_date.slice(0, 7) === curMonth()).length;
  const depYear = ST.students.filter(s => isDeparture(s) && s.check_out_date.slice(0, 4) === curMonth().slice(0, 4)).length;
  const noResidency = occ.filter(s => s.residency_status !== 'registered').length;
  const resiOverdue = occ.filter(s => s.residency_status === 'unregistered' && stayDays(s) > 7).length; // chưa ĐK tạm trú, đã ở >7 ngày
  const noContract = occ.filter(s => ['unsigned', 'none'].includes(s.contract_status)).length;
  const ghepOverdue = occ.filter(contractOverdue).length; // thuê ghép >7 ngày chưa ký HĐ
  const handoverTodo = occ.filter(handoverPending).length; // ngắn hạn chưa ký bàn giao
  // Gộp 3 loại "hợp đồng chưa hoàn thiện" (đếm không trùng)
  const contractIncomplete = occ.filter(s => ['unsigned', 'none'].includes(s.contract_status) || contractOverdue(s) || handoverPending(s)).length;
  const depExpected = occ.filter(willDepartSoon).length; // dự kiến xuất cảnh (điều phối phòng)
  const totalVehicles = occ.reduce((a, s) => a + (+s.vehicle_count || 0), 0);
  const heldDeposit = ST.students.filter(s => s.deposit_status === 'held').reduce((a, s) => a + (+s.deposit_amount || 0), 0);
  const refundPending = ST.students.filter(s => liveStatus(s) === 'left' && s.deposit_status === 'held').length;
  const needMail = (ST.vstats && ST.vstats.needMail) || 0;
  const logs = ST.logs, apps = ST.applications, damage = ST.damage, couts = ST.couts;
  let invAll = [];
  try { invAll = await API.invoices(); } catch {}
  const pApps = apps.filter(a => a.status === 'pending').length;
  const pDmg = damage.filter(d => d.status !== 'done').length;
  const pCout = couts.filter(c => c.status === 'pending').length;
  // App CHỈ lập phiếu báo tiền phòng — KHÔNG quản lý doanh thu/công nợ (đã có Bravo)
  const billedThisMonth = invAll.filter(i => i.month === curMonth()).reduce((a, i) => a + (+i.total || 0), 0);
  const billStudents = new Set(invAll.filter(i => i.month === curMonth()).map(i => i.student_id));
  const noBill = occ.filter(s => !billStudents.has(s.id)).length; // HV đang ở chưa lập phiếu tháng này

  // act = onclick đầy đủ → mọi ô KPI đều drill-through tới đúng danh sách đằng sau con số
  const kpi = (cls, ico, val, label, act) => `<div class="kpi${act ? ' clickable' : ''}" ${act ? `onclick="${act}"` : ''}><span class="ic ${cls}">${ico}</span><div><div class="v">${val}</div><div class="l">${label}</div></div></div>`;
  // act = biểu thức onclick đầy đủ (đặt đúng bộ lọc / tab rồi mới điều hướng) → bấm vào đúng danh sách cần xử lý
  const todo = (ico, tx, n, act, cls) => `<div class="todo ${n ? cls : 'calm'}" ${act && n ? `onclick="${act}"` : ''}><span class="ic">${ico}</span><span class="tx">${tx}</span><span class="n">${n}</span></div>`;

  const signed = s => ['done', 'scanned'].includes(s.contract_status);
  const zone = g => { const arr = occ.filter(s => s.gender === g); const sg = arr.filter(signed).length; return { sg, un: arr.length - sg, wash: arr.filter(s => s.uses_washing).length, veh: arr.reduce((a, s) => a + (+s.vehicle_count || 0), 0), total: arr.length }; };
  const zE = zone('female'), zS = zone('male');
  const zRow = (name, z, tot) => `<tr ${tot ? 'style="background:#faf6f2"' : ''}><td><strong>${name}</strong></td><td class="num">${z.sg}</td><td class="num">${z.un}</td><td class="num">${z.wash}</td><td class="num">${z.veh}</td><td class="num"><strong>${z.total}</strong></td></tr>`;

  el('content').innerHTML = `
    <div class="kpis">
      ${kpi('ic-green', IC.userCheck, inCount, 'Học viên đang ở', "stuFilter='in';adminGo('students')")}
      ${kpi('ic-blue', IC.bed, `${beds}<span class="muted" style="font-size:15px;font-weight:600"> / ${capacity}</span>`, 'Giường còn trống', "adminGo('rooms')")}
      ${kpi('ic-brand', IC.planeTakeoff, `${depMonth}<span class="muted" style="font-size:15px;font-weight:600"> · năm ${depYear}</span>`, 'Xuất cảnh tháng này', "stuFilter='departure';adminGo('students')")}
      ${kpi('ic-brand', IC.receipt, money(billedThisMonth), 'Phiếu báo tháng này', "adminGo('invoices')")}
      ${kpi('ic-amber', IC.filePen, noBill, 'HV chưa lập phiếu tháng này', "adminGo('invoices')")}
    </div>

    <div class="panel"><div class="hd"><h2>${IC.zap} Cần xử lý</h2></div><div class="pad">
      <div class="todo-grid">
        ${todo(IC.filePen, 'Đơn đăng ký / trả phòng chờ duyệt', pApps + pCout, pApps ? "adminGo('reg')" : "adminGo('checkout')", 'on')}
        ${todo(IC.wrench, 'Hư hỏng chưa xử lý', pDmg, "adminGo('repair')", 'warn')}
        ${todo(IC.flag, 'Đăng ký Tạm Trú', resiOverdue, "residencyModal()", 'warn')}
        ${todo(IC.fileText, 'Hợp đồng chưa hoàn thiện', contractIncomplete, "contractIssuesModal()", 'warn')}
        <div class="todo ${refundPending ? 'bad' : 'calm'}" ${refundPending ? 'onclick="quyCoc()"' : ''}><span class="ic">${IC.handCoins}</span><span class="tx">Hoàn cọc</span><span class="n">${refundPending}</span></div>
        ${todo(IC.lock, 'Chưa đóng cọc', occ.filter(s => s.deposit_status === 'none').length, "stuFilter='nodeposit';adminGo('students')", 'warn')}
        ${todo(IC.planeTakeoff, 'Dự kiến xuất cảnh (điều phối phòng)', depExpected, "stuFilter='departure_expected';adminGo('students')", 'on')}
        <div class="todo ${needMail ? 'bad' : 'calm'}" ${needMail ? `onclick="adminGo('violations')"` : ''}><span class="ic">${IC.alert}</span><span class="tx">Vi phạm cần báo nhà trường</span><span class="n">${needMail}</span></div>
      </div>
    </div></div>

    <div class="grid2" style="align-items:start">
      <div class="panel" style="margin:0"><div class="hd"><h2>${IC.dashboard} Tình hình hôm nay</h2></div><div class="pad">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div style="cursor:pointer" onclick="stuFilter='upcoming';adminGo('students')"><div class="muted" style="font-size:12.5px"><span class="dot-svg dot-blue">${IC.dot}</span> Sắp vào ›</div><div style="font-size:22px;font-weight:800">${upcoming}</div></div>
          <div style="cursor:pointer" onclick="stuFilter='leaving';adminGo('students')"><div class="muted" style="font-size:12.5px"><span class="dot-svg dot-amber">${IC.dot}</span> Sắp trả ›</div><div style="font-size:22px;font-weight:800">${leaving}</div></div>
          <div style="cursor:pointer" onclick="adminGo('vehicles')"><div class="muted" style="font-size:12.5px">${IC.bike} Xe đang gửi ›</div><div style="font-size:22px;font-weight:800">${totalVehicles}</div></div>
          <div style="cursor:pointer" onclick="quyCoc()"><div class="muted" style="font-size:12.5px">${IC.lock} Cọc đang giữ ›</div><div style="font-size:18px;font-weight:800">${money(heldDeposit)}</div></div>
        </div>
        <div class="rowbtns" style="margin-top:18px">
          <button class="btn pri" onclick="studentForm()">${IC.plus} Thêm học viên</button>
          <button class="btn" onclick="adminGo('invoices'); setTimeout(generateForm,60)">${IC.receipt} Tạo hóa đơn</button>
          <button class="btn" onclick="quyCoc()">${IC.lock} Quỹ cọc</button>
        </div>
      </div></div>

      <div class="panel" style="margin:0"><div class="hd"><h2>${IC.fileText} Hợp đồng (${legalEntity('female')} · ${legalEntity('male')})</h2></div>
        <div class="table-wrap"><table><thead><tr><th>Pháp nhân</th><th class="num">Đã ký</th><th class="num">Chưa ký</th><th class="num">${IC.washer}</th><th class="num">${IC.bike}</th><th class="num">Tổng</th></tr></thead><tbody>
          ${zRow(legalEntity('female') + ' · Nữ', zE)}
          ${zRow(legalEntity('male') + ' · Nam', zS)}
          ${zRow('Tổng cộng', { sg: zE.sg + zS.sg, un: zE.un + zS.un, wash: zE.wash + zS.wash, veh: zE.veh + zS.veh, total: zE.total + zS.total }, true)}
        </tbody></table></div>
      </div>
    </div>

    <div class="panel"><div class="hd"><h2>${IC.history} Hoạt động gần đây</h2><button class="btn sm" onclick="adminGo('checkin')">Xem tất cả</button></div>
      <div class="table-wrap">${logsTable(logs.slice(0, 6))}</div></div>`;
}
function logsTable(logs) {
  if (!logs.length) return `<div class="empty">Chưa có hoạt động nào.</div>`;
  return `<table><thead><tr><th>Ngày</th><th>Học viên</th><th>Hoạt động</th><th>Phòng</th><th>Nguồn</th><th>Ghi chú</th></tr></thead><tbody>
    ${logs.map(l => `<tr><td>${fmtDate(l.date)}</td><td>${esc(l.student_name)}</td>
      <td>${l.type === 'in' ? '<span class="badge green">Check-in</span>' : '<span class="badge red">Check-out</span>'}</td>
      <td>${esc(l.room_name || '—')}</td>
      <td>${l.source === 'self' ? '<span class="badge blue">Học viên</span>' : '<span class="badge gray">Quản lý</span>'}</td>
      <td class="muted">${esc(l.note || '')}</td></tr>`).join('')}
  </tbody></table>`;
}

/* ---------- PHÒNG ---------- */
let roomSearch = '', roomShowDeleted = false;
async function viewRooms() {
  el('topActions').innerHTML = roomShowDeleted
    ? `<button class="btn" onclick="roomShowDeleted=false;viewRooms()">← Danh sách phòng</button>`
    : `<button class="btn pri" onclick="roomForm()">${IC.plus} Thêm phòng</button>`;
  const list = roomShowDeleted ? await guard(() => API.rooms(true)) : ST.rooms;
  const del = roomShowDeleted;
  el('content').innerHTML = `
    <div class="panel"><div class="hd">
      <h2>${del ? 'Phòng đã xóa' : 'Danh sách phòng'} (<span id="roomCount">${list.length}</span>)</h2>
      <div class="toolbar">
        <div class="search"><span class="i">${IC.search}</span><input id="rs" placeholder="Tìm phòng, tầng, giới tính..." value="${esc(roomSearch)}"></div>
        ${del ? '' : `<button class="btn sm" onclick="roomShowDeleted=true;viewRooms()">${IC.trash} Đã xóa</button>`}
      </div>
    </div><div class="table-wrap">
      ${list.length ? `<table><thead><tr><th>Phòng</th><th>Loại</th><th class="num">Đang ở</th><th class="num">Giá thuê</th><th></th></tr></thead><tbody>
      ${list.map(r => { const full = r.occupancy >= r.capacity && r.capacity > 0; return `<tr data-s="${esc((r.name + ' ' + genderLabel(r.gender) + ' tầng' + r.floor + ' hạng' + (r.hang || 'b')).toLowerCase())}">
        <td><strong>${esc(r.name)}</strong>${r.upcoming ? ` <span class="badge blue" title="Sắp vào">+${r.upcoming}</span>` : ''}<div class="sub2">Tầng ${r.floor || '—'} · ${esc(legalEntity(r.gender))}</div>${r.note ? `<div class="sub2" style="white-space:pre-wrap;margin-top:3px">${esc(r.note)}</div>` : ''}</td>
        <td>${r.gender === 'female' ? '<span class="badge red">Nữ</span>' : '<span class="badge blue">Nam</span>'} <span class="badge gray">Hạng ${esc(r.hang || 'B')}</span>${!roomIsShared(r) ? ' ' + roomTypeBadge(r) : ''}</td>
        <td class="num">${roomIsShared(r) ? `<span class="badge ${full ? 'red' : r.occupancy ? 'green' : 'gray'}">${r.occupancy}/${r.capacity || 0}</span>` : `<span class="badge gray">${r.occupancy} người</span>`}</td>
        <td class="num">${money(r.monthly_fee)}<span class="muted">/người</span><div class="sub2">Nguyên phòng: ${money(ST.settings['room_price_' + (r.hang || 'B')])}</div></td>
        <td class="num"><div class="rowbtns" style="justify-content:flex-end">
          ${del ? `<button class="btn sm green" onclick="restoreRoom(${r.id})">${IC.undo} Khôi phục</button>`
                : `<button class="btn sm" onclick="roomForm(${r.id})">Sửa</button><button class="btn sm ghost" onclick="delRoom(${r.id})">${IC.trash}</button>`}
        </div></td></tr>`; }).join('')}
      <tr class="no-result" style="display:none"><td colspan="5"><div class="empty">Không tìm thấy phòng phù hợp.</div></td></tr>
      </tbody></table>` : `<div class="empty">${del ? 'Không có phòng đã xóa.' : `Chưa có phòng nào. Bấm <strong>${IC.plus} Thêm phòng</strong>.`}</div>`}
    </div></div>`;
  const rs = el('rs'); if (rs) { rs.addEventListener('input', () => roomSearch = rs.value); attachRowSearch(rs, 'roomCount'); }
}
function facilityOptions(sel) {
  return ST.facilities.map(f => `<option value="${f.id}" ${sel === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('');
}
function roomForm(id) {
  const r = id ? roomById(id) : { name: '', floor: 1, gender: 'female', hang: 'B', capacity: HANG_CAP.B, monthly_fee: ST.settings.room_fee || 1200000, note: '', facility_id: (ST.facilities[0] || {}).id };
  openModal(`
    <div class="mh"><h3>${id ? 'Sửa phòng' : 'Thêm phòng'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="grid2">
        <div class="field"><label>Tên / số phòng *</label><input id="f_name" value="${esc(r.name)}" placeholder="VD: 104" oninput="el('f_floor_disp').value='Tầng '+roomFloorOf(this.value)"></div>
        <div class="field"><label>Cơ sở</label><select id="f_fac">${facilityOptions(r.facility_id)}</select></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Tầng <span class="opt">(tự tính từ số phòng)</span></label><input id="f_floor_disp" readonly value="Tầng ${roomFloorOf(r.name)}" style="background:var(--bg2);color:var(--muted)"></div>
        <div class="field"><label>Giới tính (pháp nhân tự gán)</label><select id="f_gender" onchange="el('lgHint').textContent='Pháp nhân: '+(this.value==='female'?(ST.settings.legal_female||'E2'):(ST.settings.legal_male||'S2'))">
          <option value="female" ${r.gender === 'female' ? 'selected' : ''}>Nữ (tầng 1–2)</option>
          <option value="male" ${r.gender === 'male' ? 'selected' : ''}>Nam (tầng 3–4)</option>
        </select><div class="muted" id="lgHint" style="font-size:12px;margin-top:4px">Pháp nhân: ${esc(legalEntity(r.gender))}</div></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Hạng phòng</label><select id="f_hang" onchange="el('f_cap').value=HANG_CAP[this.value]||el('f_cap').value">${HANGS.map(hh => `<option value="${hh}" ${(r.hang || 'B') === hh ? 'selected' : ''}>Hạng ${hh} — ${HANG_CAP[hh]} giường · nguyên phòng ${money(ST.settings['room_price_' + hh])}</option>`).join('')}</select></div>
        <div class="field"><label>Sức chứa (giường) <span class="opt">(tự điền theo hạng)</span></label><input id="f_cap" type="number" min="0" value="${esc(r.capacity)}"></div>
      </div>
      <div class="field"><label>Giá thuê ghép / người / tháng <span class="opt">(đồng)</span></label><input id="f_mfee" type="number" min="0" value="${esc(r.monthly_fee)}"></div>
      <div class="field"><label>Loại phòng</label><select id="f_rtype">
        ${Object.keys(ROOM_TYPE).map(k => `<option value="${k}" ${roomType(r) === k ? 'selected' : ''}>${ROOM_TYPE[k][0]}</option>`).join('')}
      </select><div class="muted" style="font-size:11.5px;margin-top:4px">${IC.info} "Thuê nguyên phòng / An ninh / Nhân viên công tác" sẽ <strong>không tính vào giường trống</strong> cho thuê ghép.</div></div>
      <div class="field"><label>Ghi chú <span class="opt">(mỗi dòng một ghi chú)</span></label><textarea id="f_note" rows="3">${esc(r.note || '')}</textarea></div>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn pri" onclick="saveRoom(${id || 0})">Lưu</button></div>`);
  setTimeout(() => el('f_name').focus(), 50);
}
async function saveRoom(id) {
  const body = { name: el('f_name').value.trim(), facility_id: +el('f_fac').value || null,
    gender: el('f_gender').value, hang: el('f_hang').value, capacity: +el('f_cap').value || 0, monthly_fee: +el('f_mfee').value || 0, note: el('f_note').value.trim(), room_type: el('f_rtype').value };
  if (!body.name) return toast('Nhập tên phòng', 'err');
  await guard(() => id ? API.updateRoom(id, body) : API.createRoom(body));
  await refreshCache(); closeModal(); toast('Đã lưu phòng'); viewRooms();
}
async function delRoom(id) { if (!confirm('Xóa phòng này? (Có thể khôi phục lại trong mục "Đã xóa")')) return; await guard(() => API.deleteRoom(id)); await refreshCache(); toast('Đã xóa phòng'); viewRooms(); }
async function restoreRoom(id) { await guard(() => API.restoreRoom(id)); await refreshCache(); toast('Đã khôi phục phòng'); viewRooms(); }
const roomFloorOf = n => { const m = String(n || '').match(/\d/); return m ? m[0] : '—'; };

/* ---------- HỌC VIÊN ---------- */
let stuSearch = '', stuFilter = 'all', stuSort = { key: '', dir: 1 };
function stuSortVal(s) {
  switch (stuSort.key) {
    case 'name': return (s.name || '').toLowerCase();
    case 'room': return (s.room_name || '').toLowerCase();
    case 'contract': return ['done', 'scanned', 'unsigned', 'none'].indexOf(s.contract_status);
    case 'deposit': return ['held', 'refunded', 'forfeited', 'none'].indexOf(s.deposit_status);
    case 'debt': return +s.debt || 0;
    case 'status': return ['upcoming', 'staying', 'leaving', 'left'].indexOf(liveStatus(s));
    default: return 0;
  }
}
function viewStudents() {
  el('topActions').innerHTML = `<button class="btn" onclick="renumberContractsModal()" title="Đánh số HĐ tự động theo pháp nhân & ngày ký">${IC.fileText} Đánh số HĐ</button><button class="btn" onclick="showDeletedStudents()">${IC.trash} Đã xóa</button><button class="btn pri" onclick="adminGo('reg')">${IC.filePen} Đăng ký / duyệt đơn</button>`;
  let list = ST.students.slice();
  if (stuFilter === 'in') list = list.filter(isOccupying);
  if (stuFilter === 'upcoming') list = list.filter(s => liveStatus(s) === 'upcoming');
  if (stuFilter === 'out') list = list.filter(s => liveStatus(s) === 'left');
  if (stuFilter === 'noresi') list = list.filter(s => isOccupying(s) && s.residency_status !== 'registered');
  if (stuFilter === 'nocontract') list = list.filter(s => isOccupying(s) && ['unsigned', 'none'].includes(s.contract_status));
  if (stuFilter === 'washing') list = list.filter(s => isOccupying(s) && s.uses_washing);
  if (stuFilter === 'nodeposit') list = list.filter(s => isOccupying(s) && s.deposit_status === 'none');
  if (stuFilter === 'contract_overdue') list = list.filter(contractOverdue);
  if (stuFilter === 'handover_pending') list = list.filter(handoverPending);
  if (stuFilter === 'leaving') list = list.filter(s => liveStatus(s) === 'leaving');
  if (stuFilter === 'departure') list = list.filter(s => s.check_out_date && ['departure', 'urgent_visa'].includes(s.checkout_reason));
  if (stuFilter === 'departure_expected') { list = list.filter(willDepartSoon).sort((a, b) => nextDepartureDate(a).localeCompare(nextDepartureDate(b))); }
  if (stuFilter === 'resi_overdue') list = list.filter(s => isOccupying(s) && s.residency_status === 'unregistered' && stayDays(s) > 7);
  if (stuFilter === 'resi_processing') list = list.filter(s => isOccupying(s) && s.residency_status === 'processing');
  if (stuFilter === 'resi_registered') list = list.filter(s => isOccupying(s) && s.residency_status === 'registered');
  // Tìm kiếm áp dụng bằng ẩn/hiện hàng (attachRowSearch) — không lọc dựng lại ở đây
  const vthr = (ST.settings && +ST.settings.violation_mail_threshold) || 3;
  const cnt = f => ST.students.filter(f).length;
  if (stuSort.key) list = list.slice().sort((a, b) => { const x = stuSortVal(a), y = stuSortVal(b); return (x < y ? -1 : x > y ? 1 : 0) * stuSort.dir; });
  const sTh = (key, label, cls) => `<th class="sortable${cls ? ' ' + cls : ''}${stuSort.key === key ? (stuSort.dir === 1 ? ' asc' : ' desc') : ''}" data-sort="${key}">${label}<span class="sort-ar">${stuSort.key === key ? (stuSort.dir === 1 ? '▲' : '▼') : ''}</span></th>`;
  el('content').innerHTML = `
    <div class="pill-row">
      <button class="btn sm ${stuFilter === 'all' ? 'pri' : ''}" onclick="stuFilter='all';viewStudents()">Tất cả (${ST.students.length})</button>
      <button class="btn sm ${stuFilter === 'in' ? 'pri' : ''}" onclick="stuFilter='in';viewStudents()"><span class="dot-svg dot-green">${IC.dot}</span> Đang ở (${cnt(isOccupying)})</button>
      <button class="btn sm ${stuFilter === 'upcoming' ? 'pri' : ''}" onclick="stuFilter='upcoming';viewStudents()"><span class="dot-svg dot-blue">${IC.dot}</span> Sắp vào (${cnt(s => liveStatus(s) === 'upcoming')})</button>
      <button class="btn sm ${stuFilter === 'leaving' ? 'pri' : ''}" onclick="stuFilter='leaving';viewStudents()"><span class="dot-svg dot-amber">${IC.dot}</span> Sắp trả (${cnt(s => liveStatus(s) === 'leaving')})</button>
      <button class="btn sm ${stuFilter === 'out' ? 'pri' : ''}" onclick="stuFilter='out';viewStudents()"><span class="dot-svg dot-gray">${IC.dot}</span> Đã trả (${cnt(s => liveStatus(s) === 'left')})</button>
      <button class="btn sm ${stuFilter === 'departure' ? 'pri' : ''}" onclick="stuFilter='departure';viewStudents()">${IC.planeTakeoff} Xuất cảnh (${cnt(s => s.check_out_date && ['departure', 'urgent_visa'].includes(s.checkout_reason))})</button>
      <button class="btn sm ${stuFilter === 'departure_expected' ? 'pri' : ''}" onclick="stuFilter='departure_expected';viewStudents()">${IC.planeTakeoff} Dự kiến XC (${cnt(willDepartSoon)})</button>
      <button class="btn sm ${stuFilter === 'noresi' ? 'pri' : ''}" onclick="stuFilter='noresi';viewStudents()">${IC.flag} Chưa tạm trú (${cnt(s => isOccupying(s) && s.residency_status !== 'registered')})</button>
      <button class="btn sm ${stuFilter === 'nocontract' ? 'pri' : ''}" onclick="stuFilter='nocontract';viewStudents()">${IC.filePen} HĐ chưa ký (${cnt(s => isOccupying(s) && ['unsigned', 'none'].includes(s.contract_status))})</button>
      <button class="btn sm ${stuFilter === 'washing' ? 'pri' : ''}" onclick="stuFilter='washing';viewStudents()">${IC.washer} Máy giặt (${cnt(s => isOccupying(s) && s.uses_washing)})</button>
      <button class="btn sm ${stuFilter === 'nodeposit' ? 'pri' : ''}" onclick="stuFilter='nodeposit';viewStudents()">${IC.lock} Chưa đóng cọc (${cnt(s => isOccupying(s) && s.deposit_status === 'none')})</button>
      <button class="btn sm ${stuFilter === 'contract_overdue' ? 'pri' : ''}" onclick="stuFilter='contract_overdue';viewStudents()">${IC.alert} Ghép >7 ngày chưa ký HĐ (${cnt(contractOverdue)})</button>
    </div>
    <div class="panel"><div class="hd"><h2>Học viên (<span id="stuCount">${list.length}</span>)</h2>
      <div class="search"><span class="i">${IC.search}</span><input id="ss" placeholder="Tìm tên, mã, lớp, SĐT, số phòng..." value="${esc(stuSearch)}"></div>
    </div><div class="table-wrap">
      ${list.length ? `<table><thead><tr>${sTh('name', 'Học viên')}${sTh('room', 'Phòng')}${sTh('contract', 'Hợp đồng')}${sTh('deposit', 'Cọc')}<th>Dự kiến XC</th>${sTh('status', 'Trạng thái')}<th></th></tr></thead><tbody>
      ${list.map(s => {
        const flags = `${isOccupying(s) && s.residency_status !== 'registered' ? `<span title="Chưa đăng ký tạm trú"> ${IC.alert}</span>` : ''}${contractOverdue(s) ? `<span title="Thuê ghép >7 ngày chưa ký HĐ" style="color:var(--red-ink)"> ${IC.fileText}</span>` : ''}${s.uses_washing ? `<span title="Máy giặt"> ${IC.washer}</span>` : ''}${s.vehicle_count ? `<span title="Xe gửi"> ${IC.bike}${s.vehicle_count}</span>` : ''}${s.violation_count ? `<span title="Vi phạm ${s.violation_count} lần" style="color:${s.violation_count >= vthr ? 'var(--red-ink)' : 'var(--amber-ink)'}"> ${IC.alert}${s.violation_count}</span>` : ''}`;
        const ds = esc((s.name + ' ' + (s.code || '') + ' ' + (s.phone || '') + ' ' + (s.class_name || '') + ' ' + (s.room_name || '')).toLowerCase());
        return `<tr data-s="${ds}">
        <td><div class="flex"><span class="avatar">${esc(initials(s.name))}</span><div>
          <strong>${esc(s.name)}</strong> <span class="badge ${s.gender === 'female' ? 'red' : 'blue'}" style="font-size:10px">${genderLabel(s.gender)}</span>${s.login_username ? ` <span title="Có tài khoản">${IC.key}</span>` : ''}
          <div class="sub2">${esc(s.code || '—')}${s.class_name ? ' · ' + esc(s.class_name) : ''}${flags}</div>
        </div></div></td>
        <td>${s.room_name ? `<strong>${esc(s.room_name)}</strong>` : '<span class="muted">Chưa xếp</span>'}<div class="sub2">${RENTAL_LABEL[s.rental_type] || 'Thuê ghép'}</div></td>
        <td><span class="badge ${CONTRACT_BADGE[s.contract_status] || 'gray'}">${CONTRACT_LABEL[s.contract_status] || '—'}</span></td>
        <td>${depositBadge(s)}${s.deposit_status === 'none' && isOccupying(s) ? ` <button class="btn sm ghost" title="Ghi nhận đóng cọc" onclick="depositForm(${s.id})">＋</button>` : ''}</td>
        <td class="muted" style="font-size:12px;white-space:nowrap">${s.expected_departure ? fmtDate(s.expected_departure) : (['departure', 'urgent_visa'].includes(s.checkout_reason) && s.check_out_date ? fmtDate(s.check_out_date) : '—')}</td>
        <td>${statusBadge(s)}</td>
        <td class="num"><div class="rowbtns" style="justify-content:flex-end">
          ${isOccupying(s) ? `<button class="btn sm danger" onclick="checkOutForm(${s.id})">Check-out</button>` : `<button class="btn sm green" onclick="checkInForm(${s.id})">Check-in</button>`}
          <button class="btn sm pri" onclick="studentDetail(${s.id})">Chi tiết</button>
        </div></td></tr>`; }).join('')}
      <tr class="no-result" style="display:none"><td colspan="7"><div class="empty">Không tìm thấy học viên phù hợp.</div></td></tr>
      </tbody></table>` : `<div class="empty">Không có học viên phù hợp.</div>`}
    </div></div>`;
  const ss = el('ss'); if (ss) { ss.addEventListener('input', () => stuSearch = ss.value); attachRowSearch(ss, 'stuCount'); }
  document.querySelectorAll('#content th.sortable').forEach(th => {
    th.onclick = e => {
      if (e.target.classList.contains('rz-handle')) return; // đang kéo giãn cột
      const k = th.dataset.sort;
      if (stuSort.key === k) stuSort.dir *= -1; else { stuSort.key = k; stuSort.dir = 1; }
      viewStudents();
    };
  });
}
function depositBadge(s) {
  if (s.deposit_status === 'held') return '<span class="badge amber">Đang giữ</span>';
  if (s.deposit_status === 'refunded') return '<span class="badge green">Đã hoàn</span>';
  if (s.deposit_status === 'forfeited') return '<span class="badge gray">Không hoàn</span>';
  return '<span class="muted">—</span>';
}
function roomOptions(sel, gender) {
  // Chỉ xếp học viên vào phòng CHO THUÊ GHÉP (giữ lại phòng đang chọn nếu là phòng đặc biệt)
  const rooms = ST.rooms.filter(r => (!gender || r.gender === gender) && (roomIsShared(r) || r.id === sel));
  return `<option value="">— Chưa xếp phòng —</option>` + rooms.map(r => {
    const full = r.occupancy >= r.capacity && sel !== r.id;
    return `<option value="${r.id}" ${sel === r.id ? 'selected' : ''} ${full ? 'disabled' : ''}>${esc(r.name)} · Tầng ${r.floor} (${r.occupancy}/${r.capacity || 0})${full ? ' - đầy' : ''}</option>`;
  }).join('');
}
let _cccdData = null, _cccdChanged = false;
function previewCccd(input) {
  const f = input.files[0]; if (!f) return;
  if (f.size > 6 * 1024 * 1024) { input.value = ''; return toast('Ảnh quá lớn (tối đa 6MB)', 'err'); }
  const r = new FileReader();
  r.onload = () => { _cccdData = r.result; _cccdChanged = true; el('cccdPrev').innerHTML = `<img src="${r.result}" style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid var(--line)">`; };
  r.readAsDataURL(f);
}
async function studentForm(id) {
  const s = id ? await guard(() => API.student(id)) : { name: '', code: '', gender: 'female', phone: '', id_card: '', room_id: '', check_in_date: today(), note: '', uses_washing: false, rental_type: 'ghep', residency_status: 'unregistered', contract_status: 'unsigned', class_name: '', birth_date: '', contract_no: '', contract_date: '', class_start_date: '', expected_departure: '', parent_phone: '' };
  _cccdData = s.cccd_image || null; _cccdChanged = false;
  const opt = (val, cur, label) => `<option value="${val}" ${cur === val ? 'selected' : ''}>${label}</option>`;
  openModal(`
    <div class="mh"><h3>${id ? 'Sửa học viên' : 'Thêm học viên'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="grid2">
        <div class="field"><label>Họ tên *</label><input id="f_name" value="${esc(s.name)}" placeholder="Nguyễn Văn A"></div>
        <div class="field"><label>Mã học viên (MSHV)</label><input id="f_code" value="${esc(s.code || '')}" placeholder="TXTS-S25..."></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Lớp</label><input id="f_class" value="${esc(s.class_name || '')}" placeholder="Esu684"></div>
        <div class="field"><label>Ngày sinh</label><input id="f_birth"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Giới tính</label><select id="f_gender" onchange="el('f_room').innerHTML=roomOptions('', this.value)">
          ${opt('female', s.gender, 'Nữ')}${opt('male', s.gender, 'Nam')}</select></div>
        <div class="field"><label>Số điện thoại</label><input id="f_phone" value="${esc(s.phone || '')}"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Ngày khai giảng</label><input id="f_cstart"></div>
        <div class="field"><label>Dự kiến xuất cảnh</label><input id="f_departure"></div>
      </div>
      <div class="field"><label>SĐT phụ huynh <span class="opt">(liên hệ khẩn cấp)</span></label><input id="f_pphone" value="${esc(s.parent_phone || '')}"></div>
      <div class="grid2">
        <div class="field"><label>Phòng</label><select id="f_room">${roomOptions(s.room_id, s.gender)}</select></div>
        <div class="field"><label>Hình thức thuê</label><select id="f_rental">
          ${opt('ghep', s.rental_type, 'Thuê ghép (giá/người)')}${opt('phong', s.rental_type, 'Thuê nguyên phòng (giá theo hạng)')}</select></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Ngày vào (check-in)</label><input id="f_in" type="date" value="${esc((s.check_in_date || today()).slice(0, 10))}"></div>
        <div class="field"><label>Tạm trú</label><select id="f_residency">
          ${opt('unregistered', s.residency_status, 'Chưa đăng ký')}${opt('processing', s.residency_status, 'Đang xử lý')}${opt('registered', s.residency_status, 'Đã đăng ký')}</select></div>
      </div>

      <div style="background:var(--bg2);padding:12px;border-radius:10px;margin-bottom:14px">
        <div style="font-weight:600;font-size:13px;margin-bottom:10px">${IC.fileText} Hợp đồng</div>
        <div class="grid2">
          <div class="field" style="margin:0 0 12px"><label>Số HĐ <span class="opt">(tự động theo pháp nhân + ngày ký)</span></label>
            <div class="flex" style="gap:6px"><input id="f_cno" value="${esc(s.contract_no || '')}" placeholder="03/2026/HDKTX-E2" style="flex:1">
            <button type="button" class="btn sm" onclick="suggestContractNo()" title="Tạo số HĐ tự động">${IC.zap}</button></div></div>
          <div class="field" style="margin:0 0 12px"><label>Ngày ký HĐ</label><input id="f_cdate" type="date" value="${esc((s.contract_date || '').slice(0, 10))}"></div>
        </div>
        <div class="field" style="margin:0 0 12px"><label>Tình trạng HĐ</label><select id="f_cstatus">
          ${['done', 'scanned', 'unsigned', 'none', 'handover'].map(k => opt(k, s.contract_status || 'unsigned', CONTRACT_LABEL[k])).join('')}</select></div>
        <div class="hint" style="margin:0;font-size:11.5px">${IC.info} Thuê ghép <strong>dài hạn</strong> bắt buộc ký HĐ; quá 7 ngày chưa ký sẽ bị báo động. Thuê ghép <strong>ngắn hạn</strong> (dưới 2 tháng, có ngày trả) chỉ cần <strong>ký phiếu bàn giao</strong>.</div>
        <div class="field" style="margin:0"><label>Ảnh CCCD <span class="opt">(chụp/chọn ảnh)</span></label>
          <input type="file" id="f_cccd" accept="image/*" onchange="previewCccd(this)">
          <div id="cccdPrev" style="margin-top:8px">${s.cccd_image ? `<img src="${s.cccd_image}" style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid var(--line)">` : ''}</div>
        </div>
      </div>

      <div class="field"><label>Dịch vụ</label>
        <label class="check"><input type="checkbox" id="f_wash" ${s.uses_washing ? 'checked' : ''}> ${IC.washer} Máy giặt (${money(ST.settings.washing_fee)}/tháng)</label>
        <div class="muted" style="font-size:12px;margin-top:4px">${IC.bike} Xe: thêm ở mục "Chi tiết" của học viên (phí gửi xe tính theo số xe).</div>
      </div>
      <div class="field"><label>Ghi chú</label><input id="f_note" value="${esc(s.note || '')}"></div>
      ${!id ? `
      <label class="check"><input type="checkbox" id="f_dep" checked> ${IC.lock} Đã đóng cọc ${money(ST.settings.deposit_fee)} khi nhận phòng</label>
      <label class="check" style="margin-top:8px"><input type="checkbox" id="f_login" onchange="el('loginBox').style.display=this.checked?'block':'none'"> ${IC.key} Tạo tài khoản đăng nhập</label>
      <div id="loginBox" style="display:none;background:var(--bg2);padding:12px;border-radius:10px;margin-top:8px">
        <div class="grid2">
          <div class="field" style="margin:0"><label>Tên đăng nhập <span class="opt">(trống = mã HV)</span></label><input id="f_luser"></div>
          <div class="field" style="margin:0"><label>Mật khẩu</label><input id="f_lpass" type="text" placeholder="tối thiểu 4 ký tự"></div>
        </div>
      </div>` : ''}
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn pri" onclick="saveStudent(${id || 0})">Lưu</button></div>`, true);
  attachDate(el('f_birth'), s.birth_date);
  attachDate(el('f_cstart'), s.class_start_date);
  attachDate(el('f_departure'), s.expected_departure);
  setTimeout(() => el('f_name').focus(), 50);
}
async function saveStudent(id) {
  const body = {
    name: el('f_name').value.trim(), code: el('f_code').value.trim(), class_name: el('f_class').value.trim(),
    birth_date: el('f_birth').dataset.iso || null, gender: el('f_gender').value, phone: el('f_phone').value.trim(),
    room_id: el('f_room').value || null, rental_type: el('f_rental').value, check_in_date: el('f_in').value,
    residency_status: el('f_residency').value, contract_no: el('f_cno').value.trim(),
    contract_date: el('f_cdate').value || null, contract_status: el('f_cstatus').value,
    class_start_date: el('f_cstart').dataset.iso || null, expected_departure: el('f_departure').dataset.iso || null,
    parent_phone: el('f_pphone').value.trim(),
    note: el('f_note').value.trim(), uses_washing: el('f_wash').checked,
  };
  if (!body.name) return toast('Nhập họ tên', 'err');
  if (!id) {
    body.cccd_image = _cccdData || null;
    body.deposit_paid = el('f_dep').checked;
    if (el('f_login').checked) { body.create_login = true; body.login_username = el('f_luser').value.trim(); body.login_password = el('f_lpass').value.trim(); }
  } else if (_cccdChanged) {
    body.cccd_image = _cccdData;
  }
  await guard(() => id ? API.updateStudent(id, body) : API.createStudent(body));
  await refreshCache(); closeModal(); toast('Đã lưu học viên'); viewStudents();
}
// Gợi ý số HĐ tự động theo pháp nhân + ngày ký (điểm 7)
async function suggestContractNo() {
  const gender = el('f_gender') ? el('f_gender').value : 'female';
  const date = (el('f_cdate') && el('f_cdate').value) || today();
  const r = await guard(() => API.contractNoNext(gender, date));
  if (r && r.contract_no) { el('f_cno').value = r.contract_no; toast('Số HĐ đề xuất: ' + r.contract_no); }
}
async function suggestApCno(gender) {
  const date = (el('ap_cdate') && el('ap_cdate').value) || today();
  const r = await guard(() => API.contractNoNext(gender, date));
  if (r && r.contract_no) { el('ap_cno').value = r.contract_no; toast('Số HĐ đề xuất: ' + r.contract_no); }
}
// Đánh số lại toàn bộ HĐ theo ngày ký (ban thư ký) — xem trước rồi áp dụng
async function renumberContractsModal() {
  const r = await guard(() => API.renumberContracts(true));
  if (!r) return;
  const rows = r.plan.filter(p => p.changed);
  openModal(`
    <div class="mh"><h3>${IC.fileText} Đánh số hợp đồng theo ngày ký</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="hint">${IC.info} Số HĐ chạy tự động theo <strong>pháp nhân</strong> (${legalEntity('female')} · ${legalEntity('male')}) và <strong>ngày ký</strong>, đánh lại từ đầu mỗi năm. Tổng ${r.total} HĐ đã ký · <strong>${r.changed}</strong> sẽ thay đổi số.</div>
      ${rows.length ? `<div class="table-wrap" style="max-height:50vh;overflow:auto"><table><thead><tr><th>Học viên</th><th>Ngày ký</th><th>Số cũ</th><th>Số mới</th></tr></thead><tbody>
        ${rows.map(p => `<tr><td>${esc(p.name)}</td><td>${fmtDate(p.date)}</td><td class="muted">${esc(p.old || '—')}</td><td><strong>${esc(p.new)}</strong></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">Không có thay đổi — số HĐ đã đúng thứ tự theo ngày ký.</div>'}
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button>${rows.length ? `<button class="btn pri" onclick="applyRenumber()">Áp dụng (${r.changed})</button>` : ''}</div>`, true);
}
async function applyRenumber() {
  const r = await guard(() => API.renumberContracts(false));
  await refreshCache(); closeModal(); toast(`Đã đánh số ${r.changed} hợp đồng`); if (ST.view === 'students') viewStudents();
}
async function studentDetail(id) {
  const s = await guard(() => API.student(id));
  let invs = [], logs = [];
  try { invs = (await API.invoices()).filter(i => i.student_id === id); } catch {}
  try { logs = (await API.logs()).filter(l => l.student_id === id).slice(0, 12); } catch {}
  const vehicles = s.vehicles || [];
  window._detailVehicles = vehicles;
  const vios = s.violations || [];
  const vthr = (ST.settings && +ST.settings.violation_mail_threshold) || 3;
  openModal(`
    <div class="mh"><h3>${esc(s.name)} <span class="badge ${s.gender === 'female' ? 'red' : 'blue'}">${genderLabel(s.gender)}</span> ${statusBadge(s)}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="cards" style="margin-bottom:16px">
        <div class="stat"><div class="l">Phòng</div><div class="v sm">${esc(s.room_name || '—')}${s.room_hang ? ` <span class="badge gray">${s.room_hang}</span>` : ''}</div></div>
        <div class="stat"><div class="l">Hình thức</div><div class="v sm">${RENTAL_LABEL[s.rental_type] || 'Thuê ghép'}</div></div>
        <div class="stat"><div class="l">Tạm trú</div><div class="v sm">${resiBadge(s.residency_status)}</div></div>
      </div>
      <p><strong>Mã HV:</strong> ${esc(s.code || '—')} &nbsp;•&nbsp; <strong>Lớp:</strong> ${esc(s.class_name || '—')} &nbsp;•&nbsp; <strong>Ngày sinh:</strong> ${fmtDate(s.birth_date)}</p>
      <p><strong>SĐT:</strong> ${esc(s.phone || '—')} &nbsp;•&nbsp; <strong>SĐT phụ huynh:</strong> ${esc(s.parent_phone || '—')} &nbsp;•&nbsp; <strong>Tạm trú:</strong> ${resiBadge(s.residency_status)}</p>
      <p><strong>Khai giảng:</strong> ${fmtDate(s.class_start_date)} &nbsp;•&nbsp; <strong>Dự kiến xuất cảnh:</strong> ${fmtDate(s.expected_departure)}</p>
      <p><strong>Ngày vào:</strong> ${fmtDate(s.check_in_date)} ${s.check_out_date ? ` &nbsp;•&nbsp; <strong>Ngày trả:</strong> ${fmtDate(s.check_out_date)}` : ''}</p>
      <p><strong>Tài khoản:</strong> ${s.login_username ? `<span class="badge blue">${IC.key} ${esc(s.login_username)}</span>` : '<span class="muted">Chưa có</span>'}
        <button class="btn sm" style="margin-left:8px" onclick='accountForm(${s.id}, ${JSON.stringify(s.code || "")})'>${s.login_username ? 'Đặt lại MK' : 'Tạo tài khoản'}</button></p>

      <div class="panel" style="margin-top:12px"><div class="hd"><h2 style="font-size:14px">${IC.fileText} Hợp đồng</h2></div><div class="pad">
        <p style="margin:0">Số HĐ: <strong>${esc(s.contract_no || '—')}</strong> · Ngày ký: ${fmtDate(s.contract_date)} · <span class="badge ${CONTRACT_BADGE[s.contract_status] || 'gray'}">${CONTRACT_LABEL[s.contract_status] || '—'}</span></p>
        ${contractOverdue(s) ? `<div class="hint" style="margin:10px 0 0;background:var(--red-bg);border-color:#e3b8ad;color:var(--red-ink)">${IC.alert} <strong>Báo động:</strong> thuê ghép dài hạn đã vào ở ${stayDays(s)} ngày (>7) mà chưa ký hợp đồng.</div>`
          : handoverPending(s) ? `<div class="hint" style="margin:10px 0 0">${IC.info} Thuê ghép ngắn hạn (dưới 2 tháng) — cần <strong>ký phiếu bàn giao phòng</strong> (đặt tình trạng HĐ = "Đã ký phiếu bàn giao").</div>` : ''}
        ${(s.cccd_front || s.cccd_back || s.cccd_image) ? `<div style="margin-top:10px"><div class="muted" style="font-size:12px;margin-bottom:4px">Ảnh CCCD:</div><div style="display:flex;gap:8px;flex-wrap:wrap">
          ${s.cccd_front ? `<img src="${s.cccd_front}" title="Mặt trước" style="max-width:48%;max-height:180px;border-radius:8px;border:1px solid var(--line)">` : ''}
          ${s.cccd_back ? `<img src="${s.cccd_back}" title="Mặt sau" style="max-width:48%;max-height:180px;border-radius:8px;border:1px solid var(--line)">` : ''}
          ${!s.cccd_front && !s.cccd_back && s.cccd_image ? `<img src="${s.cccd_image}" style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid var(--line)">` : ''}
        </div></div>` : '<p class="muted" style="margin:8px 0 0;font-size:12px">Chưa có ảnh CCCD</p>'}
      </div></div>

      <div class="panel"><div class="hd"><h2 style="font-size:14px">${IC.bike} Xe (${vehicles.length})</h2><button class="btn sm" onclick="vehicleForm(0, ${s.id})">${IC.plus} Thêm xe</button></div><div class="pad">
        ${vehicles.length ? vehicles.map(v => `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--line)">
          <div><strong>${esc(v.plate || '—')}</strong> <span class="muted">${esc(v.vehicle_type || '')}</span>${v.sticker ? ` · mã dán: ${esc(v.sticker)}` : ''}</div>
          <div class="rowbtns"><button class="btn sm ghost" onclick="vehicleForm(${v.id}, ${s.id})">${IC.pencil}</button><button class="btn sm ghost" onclick="delVehicle(${v.id}, ${s.id})">${IC.trash}</button></div>
        </div>`).join('') : '<p class="muted" style="margin:0">Chưa có xe.</p>'}
      </div></div>

      <div class="panel"><div class="hd"><h2 style="font-size:14px">${IC.lock} Tiền cọc</h2></div><div class="pad">
        <p style="margin:0 0 10px">Trạng thái: ${depositBadge(s)} ${s.deposit_amount ? `· <strong>${money(s.deposit_amount)}</strong>` : ''} ${s.deposit_date ? `· đóng ${fmtDate(s.deposit_date)}` : ''} ${s.deposit_refund_date ? `· xử lý ${fmtDate(s.deposit_refund_date)}` : ''}</p>
        ${+s.deposit_deduction ? `<p style="margin:0 0 10px;color:var(--red)">Khấu trừ hư hao: <strong>${money(s.deposit_deduction)}</strong>${s.deposit_deduction_note ? ` (${esc(s.deposit_deduction_note)})` : ''} · Hoàn thực tế: <strong>${money((+s.deposit_amount || 0) - (+s.deposit_deduction || 0))}</strong></p>` : ''}
        ${s.deposit_account ? `<p style="margin:0 0 10px" class="muted">Hoàn về: ${esc(s.deposit_account)} — ${esc(s.deposit_bank)}</p>` : ''}
        <div class="rowbtns">
          ${s.deposit_status === 'none' ? `<button class="btn sm" onclick="depositForm(${s.id})">Ghi nhận đóng cọc</button>` : ''}
          ${s.deposit_status === 'held' ? `<button class="btn sm green" onclick="refundForm(${s.id})">Hoàn cọc</button><button class="btn sm danger" onclick="settleDeposit(${s.id},'forfeit')">Không hoàn (giữ cọc)</button>` : ''}
          ${s.deposit_status === 'refunded' || s.deposit_status === 'forfeited' ? `<button class="btn sm" onclick="depositForm(${s.id})">Điều chỉnh</button>` : ''}
        </div>
      </div></div>

      <div class="panel"><div class="hd"><h2 style="font-size:14px">${IC.alert} Vi phạm / Nhắc nhở (${vios.length})</h2>
        <div class="rowbtns">
          ${vios.length >= vthr && !vios.some(v => v.notified_school) ? `<button class="btn sm danger" onclick="notifySchool(${s.id})">${IC.inbox} Gửi mail nhà trường</button>` : ''}
          <button class="btn sm pri" onclick="violationForm(${s.id})">${IC.plus} Ghi nhận</button>
        </div></div><div class="pad">
        ${vios.length >= vthr ? `<div class="hint" style="background:var(--red-bg);border-color:#e3b8ad;color:var(--red-ink)">${IC.alert} Học viên đã vi phạm <strong>${vios.length} lần</strong> (≥ ${vthr})${vios.some(v => v.notified_school) ? ' — đã gửi mail nhà trường' : ' — cần thông báo nhà trường'}.</div>` : ''}
        ${vios.length ? `<div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Loại vi phạm</th><th>Mức độ</th><th class="num">Lần</th><th></th></tr></thead><tbody>
          ${vios.map(v => `<tr><td>${fmtDate(v.date)}</td><td><strong>${esc(v.type_name)}</strong>${v.note ? `<div class="muted" style="font-size:12px">${esc(v.note)}</div>` : ''}</td><td>${vioSevBadge(v.severity)}</td><td class="num"><span class="badge ${v.level >= vthr ? 'red' : 'gray'}">${v.level}</span></td><td class="num"><button class="btn sm ghost" onclick="delViolation(${v.id}, ${s.id})">${IC.trash}</button></td></tr>`).join('')}
        </tbody></table></div>` : '<p class="muted" style="margin:0">Chưa có vi phạm.</p>'}
      </div></div>

      <h4 style="margin:18px 0 8px">${IC.receipt} Phiếu báo tiền phòng</h4>
      ${invs.length ? `<div class="table-wrap"><table><thead><tr><th>Kỳ</th><th class="num">Tổng tiền phiếu</th></tr></thead><tbody>
        ${invs.map(i => `<tr><td>${monthLabel(i.month)}</td><td class="num"><strong>${money(i.total)}</strong></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">Chưa có phiếu báo.</p>'}
      <h4 style="margin:18px 0 8px">${IC.history} Lịch sử ra/vào</h4>
      ${logs.length ? `<div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Hoạt động</th><th>Ghi chú</th></tr></thead><tbody>
        ${logs.map(l => `<tr><td>${fmtDate(l.date)}</td><td>${l.type === 'in' ? '<span class="badge green">Check-in</span>' : '<span class="badge red">Check-out</span>'}</td><td class="muted">${esc(l.note || '')}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">Chưa có.</p>'}
    </div>
    <div class="mf">
      <button class="btn" onclick="studentForm(${s.id})">${IC.pencil} Sửa</button>
      ${isOccupying(s) ? `<button class="btn" onclick="transferForm(${s.id})">${IC.transfer} Chuyển phòng</button>` : ''}
      ${isOccupying(s) ? `<button class="btn danger" onclick="checkOutForm(${s.id})">Check-out</button>` : `<button class="btn green" onclick="checkInForm(${s.id})">Check-in lại</button>`}
      <button class="btn danger" onclick="delStudent(${s.id})">${IC.trash} Xóa</button>
    </div>`, true);
}
/* Xe */
function vehicleForm(vid, studentId) {
  let v = { plate: '', vehicle_type: '', sticker: '', note: '' };
  if (vid) { const d = (window._detailVehicles || []).find(x => x.id === vid); if (d) v = d; }
  openModal(`
    <div class="mh"><h3>${vid ? 'Sửa xe' : 'Thêm xe'}</h3><button class="x" onclick="studentDetail(${studentId})">×</button></div>
    <div class="mb">
      <div class="grid2">
        <div class="field"><label>Biển số</label><input id="v_plate" value="${esc(v.plate || '')}" placeholder="63-B4 508.58"></div>
        <div class="field"><label>Loại xe</label><input id="v_type" value="${esc(v.vehicle_type || '')}" placeholder="Xe số / Xe ga..."></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Mã dán xe</label><input id="v_sticker" value="${esc(v.sticker || '')}" placeholder="201.1"></div>
        <div class="field"><label>Ghi chú</label><input id="v_note" value="${esc(v.note || '')}"></div>
      </div>
      <div class="hint">${IC.bulb} Phí gửi xe (${money(ST.settings.parking_fee)}/xe/tháng) sẽ tự tính vào hóa đơn theo số xe.</div>
    </div>
    <div class="mf"><button class="btn" onclick="studentDetail(${studentId})">Hủy</button><button class="btn pri" onclick="saveVehicle(${vid || 0}, ${studentId})">Lưu</button></div>`);
}
async function saveVehicle(vid, studentId) {
  const body = { student_id: studentId, plate: el('v_plate').value.trim(), vehicle_type: el('v_type').value.trim(), sticker: el('v_sticker').value.trim(), note: el('v_note').value.trim() };
  await guard(() => vid ? API.updateVehicle(vid, body) : API.createVehicle(body));
  await refreshCache(); toast('Đã lưu xe'); studentDetail(studentId);
}
async function delVehicle(vid, studentId) {
  if (!confirm('Xóa xe này?')) return;
  await guard(() => API.deleteVehicle(vid)); await refreshCache(); toast('Đã xóa xe'); studentDetail(studentId);
}
/* Chuyển phòng */
function transferForm(id) {
  const s = studentById(id);
  openModal(`
    <div class="mh"><h3>${IC.transfer} Chuyển phòng: ${esc(s.name)}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <p class="muted">Phòng hiện tại: <strong>${esc(s.room_name || '—')}</strong></p>
      <div class="grid2">
        <div class="field"><label>Phòng mới</label><select id="t_room">${roomOptions('', s.gender)}</select></div>
        <div class="field"><label>Ngày chuyển</label><input id="t_date" type="date" value="${today()}"></div>
      </div>
      <div class="field"><label>Ghi chú</label><input id="t_note" placeholder="Lý do chuyển..."></div>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn pri" onclick="doTransfer(${id})">Chuyển</button></div>`);
}
async function doTransfer(id) {
  const room_id = el('t_room').value; if (!room_id) return toast('Chọn phòng mới', 'err');
  await guard(() => API.transfer(id, { room_id, date: el('t_date').value, note: el('t_note').value.trim() }));
  await refreshCache(); closeModal(); toast('Đã chuyển phòng'); adminGo(ST.view);
}
/* Hoàn cọc kèm khấu trừ hư hao tài sản + STK */
function refundForm(id) {
  const s = studentById(id) || {};
  const deposit = +s.deposit_amount || 0;
  const assetRow = a => `<tr>
    <td>${esc(a.name)} <span class="muted" style="font-size:11px">(${esc(a.unit)})</span></td>
    <td class="num"><input type="number" min="0" step="1" data-dqty="${a.id}" value="0" style="width:64px;text-align:right" oninput="dedCalc()"></td>
    <td class="num"><input type="number" min="0" data-dfee="${a.id}" data-dname="${esc(a.name)}" value="${+a.fee || 0}" style="width:110px;text-align:right" oninput="dedCalc()"></td>
    <td class="num" id="dl_${a.id}">0 đ</td>
  </tr>`;
  const person = ST.assets.filter(a => a.category === 'person');
  const fixed = ST.assets.filter(a => a.category === 'fixed');
  openModal(`
    <div class="mh"><h3>${IC.handCoins} Hoàn cọc: ${esc(s.name || '')}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="hint">Tick số lượng tài sản <strong>hư hao / mất / không vệ sinh</strong> để khấu trừ vào cọc. Có thể sửa đơn giá bồi hoàn.</div>
      <div class="table-wrap" style="max-height:280px;overflow:auto"><table><thead><tr><th>Tài sản</th><th class="num">SL hư/mất</th><th class="num">Đơn giá</th><th class="num">Thành tiền</th></tr></thead><tbody>
        ${person.length ? `<tr><td colspan="4" style="background:#fbeee3;font-weight:700;font-size:12px">Trang thiết bị theo người</td></tr>${person.map(assetRow).join('')}` : ''}
        ${fixed.length ? `<tr><td colspan="4" style="background:#fbeee3;font-weight:700;font-size:12px">Trang thiết bị cố định</td></tr>${fixed.map(assetRow).join('')}` : ''}
      </tbody></table></div>
      <div style="background:var(--bg2);padding:14px;border-radius:10px;margin:14px 0;font-size:14px">
        <div style="display:flex;justify-content:space-between"><span>Tiền cọc:</span><strong>${money(deposit)}</strong></div>
        <div style="display:flex;justify-content:space-between;color:var(--red)"><span>Khấu trừ hư hao:</span><strong id="dedTotal">0 đ</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:16px;margin-top:6px;padding-top:8px;border-top:1px solid var(--line)"><span><strong>Hoàn thực tế:</strong></span><strong id="dedRefund" data-deposit="${deposit}" style="color:var(--green)">${money(deposit)}</strong></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Số tài khoản</label><input id="r_acc" value="${esc(s.deposit_account || '')}"></div>
        <div class="field"><label>Ngân hàng</label><input id="r_bank" value="${esc(s.deposit_bank || '')}" placeholder="VIETCOMBANK - ..."></div>
      </div>
      <div class="field"><label>Ngày hoàn</label><input id="r_date" type="date" value="${today()}"></div>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn green" onclick="doRefund(${id}, ${deposit})">Xác nhận hoàn cọc</button></div>`, true);
  dedCalc();
}
function dedCalc() {
  let total = 0;
  document.querySelectorAll('#modal input[data-dqty]').forEach(q => {
    const id = q.dataset.dqty;
    const fee = +document.querySelector(`[data-dfee="${id}"]`).value || 0;
    const line = (+q.value || 0) * fee;
    total += line;
    el('dl_' + id).textContent = money(line);
  });
  const deposit = +(el('dedRefund').dataset.deposit || 0);
  el('dedTotal').textContent = money(total);
  el('dedRefund').textContent = money(Math.max(0, deposit - total));
  el('dedTotal').dataset.total = total;
}
async function doRefund(id, deposit) {
  let total = 0; const parts = [];
  document.querySelectorAll('#modal input[data-dqty]').forEach(q => {
    const qty = +q.value || 0; if (!qty) return;
    const feeEl = document.querySelector(`[data-dfee="${q.dataset.dqty}"]`);
    const fee = +feeEl.value || 0, line = qty * fee;
    total += line; parts.push(`${feeEl.dataset.dname} x${qty} = ${money(line)}`);
  });
  await guard(() => API.settleDeposit(id, {
    action: 'refund', account: el('r_acc').value.trim(), bank: el('r_bank').value.trim(), date: el('r_date').value,
    deduction: total, deduction_note: parts.join('; '),
  }));
  await refreshCache(); closeModal();
  toast(total ? `Đã hoàn cọc (trừ ${money(total)} hư hao)` : 'Đã hoàn cọc');
  studentDetailRefresh(id);
}
async function delStudent(id) {
  if (!confirm('Xóa học viên này? Đây là xóa mềm — có thể khôi phục lại trong mục "Đã xóa".')) return;
  await guard(() => API.deleteStudent(id)); await refreshCache(); closeModal(); toast('Đã xóa học viên (khôi phục được)'); viewStudents();
}
// Thùng rác học viên: xem danh sách đã xóa mềm + khôi phục
async function showDeletedStudents() {
  const list = await guard(() => API.students(true));
  openModal(`
    <div class="mh"><h3>${IC.trash} Học viên đã xóa (${list.length})</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      ${list.length ? `<div class="table-wrap"><table><thead><tr><th>Học viên</th><th>Mã</th><th>Phòng</th><th></th></tr></thead><tbody>
        ${list.map(s => `<tr>
          <td><strong>${esc(s.name)}</strong>${s.class_name ? ` <span class="muted">· ${esc(s.class_name)}</span>` : ''}</td>
          <td>${esc(s.code || '—')}</td><td>${esc(s.room_name || '—')}</td>
          <td class="num"><button class="btn sm green" onclick="restoreStudentAndReload(${s.id})">${IC.undo} Khôi phục</button></td>
        </tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">Không có học viên nào trong thùng rác.</div>'}
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Đóng</button></div>`, true);
}
async function restoreStudentAndReload(id) {
  await guard(() => API.restoreStudent(id));
  await refreshCache(); closeModal(); toast('Đã khôi phục học viên'); viewStudents();
}
// Admin tạo ĐƠN ĐĂNG KÝ hộ học viên (thay cho việc thêm học viên trực tiếp).
// Đơn vào trạng thái "Chờ duyệt" -> admin bấm "Thêm vào phòng" để tạo học viên.
function appForm() {
  const facOpts = (ST.facilities || []).map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('');
  openModal(`
    <div class="mh"><h3>${IC.filePen} Tạo đơn đăng ký</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="hint">${IC.info} Đơn tạo ở đây vào danh sách <strong>Đăng ký ở nội trú</strong> ở trạng thái <strong>Chờ duyệt</strong>. Bấm <strong>“Thêm vào phòng”</strong> để duyệt & tạo học viên.</div>
      <div class="grid2">
        <div class="field"><label>Họ và tên *</label><input id="ap_name" placeholder="Nguyễn Văn A"></div>
        <div class="field"><label>SĐT *</label><input id="ap_phone" placeholder="09..."></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Giới tính</label><select id="ap_gender"><option value="female">Nữ</option><option value="male">Nam</option></select></div>
        <div class="field"><label>Ngày sinh</label><input id="ap_birth" placeholder="dd/mm/yyyy" readonly></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Mã học viên (MSHV)</label><input id="ap_code" placeholder="TXTS-..."></div>
        <div class="field"><label>Lớp</label><input id="ap_class" placeholder="Esu..."></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Hình thức</label><select id="ap_rental"><option value="ghep">Thuê ghép</option><option value="phong">Thuê nguyên phòng</option></select></div>
        <div class="field"><label>Cơ sở</label><select id="ap_fac">${facOpts}</select></div>
      </div>
      <div class="field"><label>Nguyện vọng phòng</label><input id="ap_pref" placeholder="VD: tầng thấp, gần thang máy..."></div>
      <div class="grid2">
        <label class="chk" style="align-self:center"><input type="checkbox" id="ap_wash"> Đăng ký máy giặt</label>
        <label class="chk" style="align-self:center"><input type="checkbox" id="ap_park"> Gửi xe</label>
      </div>
      <div class="field"><label>Biển số xe (nếu gửi xe)</label><input id="ap_plate" placeholder="59-..."></div>
      <div class="field"><label>Ghi chú</label><textarea id="ap_note" rows="2"></textarea></div>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn pri" onclick="saveApp()">Tạo đơn</button></div>`);
  attachDate(el('ap_birth'), '');
}
async function saveApp() {
  const name = el('ap_name').value.trim(), phone = el('ap_phone').value.trim();
  if (!name) return toast('Nhập họ tên', 'err');
  if (!phone) return toast('Nhập số điện thoại', 'err');
  const body = {
    name, phone, gender: el('ap_gender').value, birth_date: el('ap_birth').dataset.iso || null,
    code: el('ap_code').value.trim(), class_name: el('ap_class').value.trim(),
    rental_type: el('ap_rental').value, facility_id: +el('ap_fac').value || null,
    pref: el('ap_pref').value.trim(), note: el('ap_note').value.trim(),
    wants_washing: el('ap_wash').checked, wants_parking: el('ap_park').checked, plate: el('ap_plate').value.trim(),
  };
  await guard(() => API.publicApply(body));
  await refreshCache(); closeModal(); toast('Đã tạo đơn đăng ký (chờ duyệt)'); adminGo('reg');
}
function accountForm(id, code) {
  openModal(`
    <div class="mh"><h3>Tài khoản đăng nhập học viên</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="field"><label>Tên đăng nhập <span class="opt">(bỏ trống nếu đã có)</span></label><input id="a_user" value="${esc(code || '')}"></div>
      <div class="field"><label>Mật khẩu mới</label><input id="a_pass" type="text" placeholder="tối thiểu 4 ký tự"></div>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn pri" onclick="saveAccount(${id})">Lưu</button></div>`);
  setTimeout(() => el('a_pass').focus(), 50);
}
async function saveAccount(id) {
  const r = await guard(() => API.setAccount(id, { username: el('a_user').value.trim(), password: el('a_pass').value.trim() }));
  await refreshCache(); closeModal(); toast('Đã lưu tài khoản: ' + r.username);
}
/* Cọc */
function depositForm(id) {
  const s = studentById(id) || {};
  openModal(`
    <div class="mh"><h3>${IC.lock} Ghi nhận đóng cọc</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="grid2">
        <div class="field"><label>Số tiền cọc</label><input id="d_amt" type="number" min="0" value="${esc(s.deposit_amount || ST.settings.deposit_fee || 1200000)}"></div>
        <div class="field"><label>Ngày đóng</label><input id="d_date" type="date" value="${(s.deposit_date || today()).slice(0, 10)}"></div>
      </div>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn pri" onclick="saveDeposit(${id})">Lưu</button></div>`);
}
async function saveDeposit(id) {
  await guard(() => API.setDeposit(id, { amount: +el('d_amt').value || 0, date: el('d_date').value }));
  await refreshCache(); closeModal(); toast('Đã ghi nhận cọc'); studentDetailRefresh(id);
}
async function settleDeposit(id, action) {
  if (!confirm(action === 'refund' ? 'Xác nhận HOÀN cọc cho học viên?' : 'Xác nhận KHÔNG hoàn cọc (giữ lại)?')) return;
  await guard(() => API.settleDeposit(id, { action }));
  await refreshCache(); toast(action === 'refund' ? 'Đã hoàn cọc' : 'Đã giữ cọc'); studentDetailRefresh(id);
}
function studentDetailRefresh(id) { if (el('overlay').classList.contains('show')) studentDetail(id); else viewStudents(); }

/* ---------- QUỸ CỌC ---------- */
function quyCoc() {
  const held = ST.students.filter(s => s.deposit_status === 'held');
  const pending = held.filter(s => liveStatus(s) === 'left');   // đã trả phòng, cọc chưa xử lý
  const staying = held.filter(s => liveStatus(s) !== 'left');
  const total = held.reduce((a, s) => a + (+s.deposit_amount || 0), 0);
  const pendAmt = pending.reduce((a, s) => a + (+s.deposit_amount || 0), 0);
  const rowFor = s => `<tr>
    <td><strong>${esc(s.name)}</strong><div class="sub2">${esc(s.room_name || 'Chưa xếp')} · ${esc(s.code || '')}</div></td>
    <td class="num">${money(s.deposit_amount)}</td>
    <td>${fmtDate(s.deposit_date)}</td>
    <td>${statusBadge(s)}</td>
    <td class="num">${liveStatus(s) === 'left' ? `<button class="btn sm green" onclick="closeModal();refundForm(${s.id})">Hoàn cọc</button>` : ''}</td>
  </tr>`;
  openModal(`
    <div class="mh"><h3>${IC.lock} Quỹ cọc</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="kpis" style="margin-bottom:16px">
        <div class="kpi"><span class="ic ic-brand">${IC.lock}</span><div><div class="v">${money(total)}</div><div class="l">Tổng quỹ cọc đang giữ</div></div></div>
        <div class="kpi"><span class="ic ic-gray">${IC.users}</span><div><div class="v">${held.length}</div><div class="l">Học viên đang giữ cọc</div></div></div>
        <div class="kpi"><span class="ic ic-red">${IC.handCoins}</span><div><div class="v">${pending.length}</div><div class="l">Cần hoàn cọc ${pendAmt ? '(' + money(pendAmt) + ')' : ''}</div></div></div>
      </div>
      ${pending.length ? `<div class="hint" style="background:var(--red-bg);border-color:#fca5a5;color:#b91c1c">${IC.handCoins} <strong>${pending.length} học viên đã trả phòng</strong> đang chờ hoàn cọc — hãy xử lý sớm.</div>
        <div class="table-wrap" style="margin-bottom:18px"><table><thead><tr><th>Học viên</th><th class="num">Cọc</th><th>Ngày đóng</th><th>Trạng thái</th><th></th></tr></thead><tbody>${pending.map(rowFor).join('')}</tbody></table></div>` : `<div class="hint">${IC.checkCircle} Không có khoản cọc nào chờ hoàn.</div>`}
      <h4 style="margin:6px 0 8px">Đang giữ cọc (${staying.length})</h4>
      ${staying.length ? `<div class="table-wrap"><table><thead><tr><th>Học viên</th><th class="num">Cọc</th><th>Ngày đóng</th><th>Trạng thái</th><th></th></tr></thead><tbody>${staying.map(rowFor).join('')}</tbody></table></div>` : '<p class="muted">Chưa có.</p>'}
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Đóng</button></div>`, true);
}

/* ---------- XE ---------- */
let vehSearch = '';
/* ---------- MÁY GIẶT ---------- */
function viewWashing() {
  const fee = +ST.settings.washing_fee || 0;
  const users = ST.students.filter(s => s.uses_washing && isOccupying(s)).sort((a, b) => (a.room_name || '').localeCompare(b.room_name || '', 'vi'));
  const total = users.length * fee;
  el('topActions').innerHTML = `<button class="btn pri" onclick="addWashingForm()">${IC.plus} Thêm HV dùng máy giặt</button>`;
  el('content').innerHTML = `
    <div class="kpis">
      <div class="kpi"><span class="ic ic-blue">${IC.washer}</span><div><div class="v">${users.length}</div><div class="l">HV đang dùng máy giặt</div></div></div>
      <div class="kpi"><span class="ic ic-brand">${IC.banknote}</span><div><div class="v">${money(total)}</div><div class="l">Doanh thu máy giặt / tháng</div></div></div>
      <div class="kpi"><span class="ic ic-gray">${IC.receipt}</span><div><div class="v">${money(fee)}</div><div class="l">Đơn giá / tháng</div></div></div>
    </div>
    <div class="panel"><div class="hd"><h2>${IC.washer} Học viên dùng máy giặt (${users.length})</h2></div>
    <div class="table-wrap">${users.length ? `<table><thead><tr><th>Học viên</th><th>Phòng</th><th class="num">Phí / tháng</th><th></th></tr></thead><tbody>
      ${users.map(s => `<tr>
        <td><a href="#" onclick="studentDetail(${s.id});return false"><strong>${esc(s.name)}</strong></a>${s.code ? `<div class="muted" style="font-size:11px">${esc(s.code)}</div>` : ''}</td>
        <td>${esc(s.room_name || '—')}</td>
        <td class="num">${money(fee)}</td>
        <td class="num"><button class="btn sm ghost" onclick="toggleWashing(${s.id}, false)">${IC.trash} Ngưng</button></td>
      </tr>`).join('')}
    </tbody></table>` : '<div class="empty">Chưa có học viên nào đăng ký máy giặt. Bấm "Thêm HV dùng máy giặt".</div>'}</div></div>`;
}
function addWashingForm() {
  const avail = ST.students.filter(s => !s.uses_washing && isOccupying(s)).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
  if (!avail.length) return toast('Mọi học viên đang ở đều đã dùng máy giặt', 'err');
  const opts = avail.map(s => `<option value="${s.id}">${esc(s.name)}${s.code ? ' (' + esc(s.code) + ')' : ''}${s.room_name ? ' — ' + esc(s.room_name) : ''}</option>`).join('');
  openModal(`
    <div class="mh"><h3>${IC.washer} Thêm HV dùng máy giặt</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="field"><label>Chọn học viên</label><select id="wash_stu">${opts}</select></div>
      <div class="hint">${IC.info} Phí máy giặt ${money(+ST.settings.washing_fee || 0)}/tháng sẽ được tính vào hóa đơn từ kỳ kế tiếp.</div>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn pri" onclick="toggleWashing(+el('wash_stu').value, true)">Thêm</button></div>`);
}
async function toggleWashing(id, on) {
  if (!id) return;
  if (!on && !confirm('Ngưng dịch vụ máy giặt cho học viên này?')) return;
  await guard(() => API.setWashing(id, on));
  await refreshCache(); closeModal();
  toast(on ? 'Đã thêm HV dùng máy giặt' : 'Đã ngưng máy giặt');
  if (ST.view === 'washing') viewWashing();
}
async function viewVehicles() {
  el('content').innerHTML = '<div class="spinner"></div>';
  const all = await guard(() => API.vehicles());
  const active = all.filter(v => v.student_status === 'in');
  const list = all;
  el('content').innerHTML = `
    <div class="cards">
      <div class="stat"><div class="l">${IC.bike} Tổng xe</div><div class="v">${all.length}</div></div>
      <div class="stat"><div class="l">${IC.checkCircle} Xe HV đang ở</div><div class="v">${active.length}</div></div>
    </div>
    <div class="panel"><div class="hd"><h2>Danh sách xe (<span id="vehCount">${list.length}</span>)</h2>
      <div class="search"><span class="i">${IC.search}</span><input id="vs" placeholder="Tìm biển số, loại, chủ xe, phòng..." value="${esc(vehSearch)}"></div>
    </div><div class="table-wrap">
      ${list.length ? `<table><thead><tr><th>Biển số</th><th>Loại xe</th><th>Mã dán</th><th>Chủ xe</th><th>Phòng</th><th>Trạng thái HV</th></tr></thead><tbody>
        ${list.map(v => `<tr data-s="${esc((v.plate + ' ' + (v.vehicle_type || '') + ' ' + (v.student_name || '') + ' ' + (v.room_name || '') + ' ' + (v.sticker || '')).toLowerCase())}">
          <td><strong>${esc(v.plate || '—')}</strong></td>
          <td>${esc(v.vehicle_type || '—')}</td>
          <td>${esc(v.sticker || '—')}</td>
          <td><a href="#" onclick="studentDetail(${v.student_id});return false">${esc(v.student_name)}</a></td>
          <td>${esc(v.room_name || '—')}</td>
          <td>${v.student_status === 'in' ? '<span class="badge green">Đang ở</span>' : '<span class="badge gray">Đã rời</span>'}</td>
        </tr>`).join('')}
        <tr class="no-result" style="display:none"><td colspan="6"><div class="empty">Không tìm thấy xe phù hợp.</div></td></tr>
      </tbody></table>` : `<div class="empty">Chưa có xe nào. Thêm xe trong <strong>Chi tiết học viên</strong>.</div>`}
    </div></div>`;
  const vs = el('vs'); if (vs) { vs.addEventListener('input', () => vehSearch = vs.value); attachRowSearch(vs, 'vehCount'); }
}

/* ---------- BÁO CÁO DOANH THU ---------- */
let revYear = curMonth().slice(0, 4);
const REV_SERVICES = [
  ['room', 'Phí lưu trú (tiền phòng)', 'bravo_room'],
  ['electric', 'Phí điện sinh hoạt', 'bravo_electric'],
  ['water', 'Phí nước sinh hoạt', 'bravo_water'],
  ['service', 'Phí dịch vụ chung', 'bravo_service'],
  ['washing', 'Phí máy giặt', 'bravo_washing'],
  ['parking', 'Phí gửi xe máy', 'bravo_parking'],
  ['other', 'Khoản khác', 'bravo_other'],
];
async function viewRevenue() {
  el('content').innerHTML = '<div class="spinner"></div>';
  const years = await guard(() => API.revenueYears());
  if (years.length && !years.includes(revYear)) revYear = years[0];
  const data = await guard(() => API.revenue(revYear));
  const sum = k => data.reduce((a, m) => a + (+m[k] || 0), 0);
  const grand = sum('total'), paid = sum('paid');

  // Bảng theo tháng
  const monthRows = data.map(m => `<tr>
    <td><strong>${m.month.slice(5)}/${m.month.slice(0, 4)}</strong></td>
    ${REV_SERVICES.filter(x => x[0] !== 'other' || sum('other')).map(([k]) => `<td class="num">${+m[k] ? money(m[k]) : '<span class="muted">—</span>'}</td>`).join('')}
    <td class="num"><strong>${money(m.total)}</strong></td>
  </tr>`).join('');

  el('content').innerHTML = `
    <div class="cards">
      <div class="stat"><div class="l">${IC.calendar} Năm</div><div class="v sm"><select id="ry" style="font-size:15px;font-weight:600;padding:6px 8px">${(years.length ? years : [revYear]).map(y => `<option value="${y}" ${y === revYear ? 'selected' : ''}>${y}</option>`).join('')}</select></div></div>
      <div class="stat"><div class="l">${IC.trendingUp} Tổng dự báo doanh thu năm</div><div class="v sm">${money(grand)}</div></div>
    </div>

    <div class="panel"><div class="hd"><h2>${IC.trendingUp} Dự báo doanh thu theo tháng — năm ${revYear}</h2>
      <button class="btn sm" onclick='exportRevenue(${JSON.stringify(data).replace(/'/g, "&#39;")})'>${IC.download} Xuất Excel (CSV)</button></div>
      <div class="table-wrap">
      ${data.length ? `<table><thead><tr><th>Tháng</th>
        ${REV_SERVICES.filter(x => x[0] !== 'other' || sum('other')).map(([, l]) => `<th class="num">${l.replace('Phí ', '').replace(' sinh hoạt', '').replace(' (tiền phòng)', '')}</th>`).join('')}
        <th class="num">Tổng</th></tr></thead>
        <tbody>${monthRows}
          <tr style="background:#faf6f2"><td><strong>Cả năm</strong></td>
          ${REV_SERVICES.filter(x => x[0] !== 'other' || sum('other')).map(([k]) => `<td class="num"><strong>${money(sum(k))}</strong></td>`).join('')}
          <td class="num"><strong>${money(grand)}</strong></td></tr>
        </tbody></table>` : '<div class="empty">Chưa có phiếu báo trong năm này.</div>'}
      </div>
    </div>

    <div class="panel"><div class="hd"><h2>${IC.receipt} Tổng theo dịch vụ (đối chiếu Bravo) — năm ${revYear}</h2></div>
      <div class="table-wrap"><table><thead><tr><th>Mã SP Bravo</th><th>Loại phí</th><th>Dịch vụ</th><th class="num">Tiền phiếu cả năm</th></tr></thead><tbody>
        ${REV_SERVICES.map(([k, l, codeKey]) => { const v = sum(k); if (!v && k === 'other') return ''; return `<tr>
          <td><strong>${esc(ST.settings[codeKey] || '—')}</strong></td>
          <td class="muted">${esc(ST.settings.bravo_fee_type || '')}</td>
          <td>${l}</td><td class="num">${money(v)}</td></tr>`; }).join('')}
        <tr style="background:#faf6f2"><td colspan="3"><strong>TỔNG TIỀN PHIẾU</strong></td><td class="num"><strong>${money(grand)}</strong></td></tr>
      </tbody></table></div>
      <div class="pad muted" style="font-size:12.5px">${IC.bulb} Mã sản phẩm Bravo chỉnh trong <a href="#" onclick="adminGo('settings');return false">Cài đặt</a>. Số liệu = tổng tiền đã lập phiếu báo (chưa gồm cọc). Thu tiền thực tế do Bravo quản lý.</div>
    </div>

    <div class="panel"><div class="hd"><h2>${IC.planeTakeoff} Học viên xuất cảnh đi Nhật — năm ${revYear}</h2><span class="muted" style="font-size:12px">gồm xuất cảnh theo kế hoạch + đột xuất</span></div>
      <div class="table-wrap"><table><thead><tr><th>Tháng</th><th class="num">Số HV xuất cảnh</th></tr></thead><tbody>
        ${Array.from({ length: 12 }, (_, i) => { const mm = String(i + 1).padStart(2, '0'); const c = ST.students.filter(s => s.check_out_date && ['departure', 'urgent_visa'].includes(s.checkout_reason) && String(s.check_out_date).slice(0, 7) === revYear + '-' + mm).length; return `<tr><td>${mm}/${revYear}</td><td class="num">${c ? '<strong>' + c + '</strong>' : '<span class="muted">—</span>'}</td></tr>`; }).join('')}
        <tr style="background:#faf6f2"><td><strong>Tổng cả năm ${revYear}</strong></td><td class="num"><strong>${ST.students.filter(s => s.check_out_date && ['departure', 'urgent_visa'].includes(s.checkout_reason) && String(s.check_out_date).slice(0, 4) === revYear).length}</strong></td></tr>
      </tbody></table></div>
    </div>`;
  const ry = el('ry'); if (ry) ry.onchange = e => { revYear = e.target.value; viewRevenue(); };
}
function exportRevenue(data) {
  const cols = REV_SERVICES.map(x => x[1]);
  const head = ['Thang', ...cols, 'Tong'];
  const rows = data.map(m => [m.month, ...REV_SERVICES.map(([k]) => +m[k] || 0), +m.total || 0]);
  const sum = k => data.reduce((a, m) => a + (+m[k] || 0), 0);
  rows.push(['Ca nam', ...REV_SERVICES.map(([k]) => sum(k)), sum('total'), sum('paid')]);
  const csv = '﻿' + [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `doanh-thu-${revYear}.csv`; a.click();
  toast('Đã xuất file CSV');
}

/* ---------- NHẬT KÝ HỆ THỐNG (AUDIT LOG) ---------- */
const AUDIT_RES = {
  students: 'Học viên', rooms: 'Phòng', vehicles: 'Xe', assets: 'Tài sản',
  invoices: 'Hóa đơn', electric: 'Điện', violations: 'Vi phạm', applications: 'Đơn đăng ký',
  requests: 'Yêu cầu hỗ trợ', settings: 'Cài đặt', facilities: 'Cơ sở', media: 'Ảnh giới thiệu',
  admin: 'Tài khoản', logs: 'Nhật ký ra/vào', reports: 'Báo cáo', me: 'Học viên (tự thao tác)',
};
const AUDIT_SUB = {
  checkin: 'Check-in', checkout: 'Check-out', transfer: 'Chuyển phòng', approve: 'Duyệt đơn',
  reject: 'Từ chối', confirm: 'Xác nhận trả phòng', notify: 'Gửi mail nhà trường', restore: 'Khôi phục',
  generate: 'Lập hóa đơn hàng loạt', 'generate-one': 'Lập hóa đơn 1 HV', bulk: 'Lưu chỉ số điện',
  'mark-paid': 'Đánh dấu đã thu', status: 'Đổi trạng thái', recalc: 'Tính lại hóa đơn',
  password: 'Đặt lại mật khẩu', account: 'Cấp tài khoản', deposit: 'Cập nhật cọc',
  'deposit-settle': 'Tất toán cọc', note: 'Ghi chú', types: 'Loại vi phạm', users: 'Tài khoản NV',
  damage: 'Báo hư hỏng',
};
function auditLabel(method, pathStr) {
  const seg = String(pathStr || '').replace(/^\/api\//, '').split('/').filter(Boolean);
  const res = AUDIT_RES[seg[0]] || seg[0] || '—';
  const tail = seg.slice(1).filter(x => !/^\d+$/.test(x));
  const key = tail[tail.length - 1];
  if (key && AUDIT_SUB[key]) return AUDIT_SUB[key] + ' · ' + res;
  const verb = method === 'POST' ? 'Tạo mới' : (method === 'PUT' || method === 'PATCH') ? 'Cập nhật' : method === 'DELETE' ? 'Xóa' : method;
  return verb + ' · ' + res;
}
const AUDIT_MCLR = { POST: 'green', PUT: 'amber', PATCH: 'amber', DELETE: 'red' };
function fmtDT(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v).slice(0, 16).replace('T', ' ');
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} · ${p(d.getHours())}:${p(d.getMinutes())}`;
}
let auditLimit = 200;
async function viewAudit() {
  el('topActions').innerHTML = `<button class="btn" onclick="viewAudit()">${IC.refresh} Tải lại</button>`;
  el('content').innerHTML = '<div class="spinner"></div>';
  const rows = await guard(() => API.auditLog(auditLimit));
  const todayStr = today();
  const todayCnt = rows.filter(r => String(r.at || '').slice(0, 10) === todayStr).length;
  const users = new Set(rows.map(r => r.username)).size;

  const body = rows.map(r => {
    const label = auditLabel(r.method, r.path);
    const s = `${r.username} ${label} ${r.detail || ''} ${r.path || ''}`.toLowerCase();
    return `<tr data-s="${esc(s)}">
      <td style="white-space:nowrap">${fmtDT(r.at)}</td>
      <td><strong>${esc(r.username || '—')}</strong> <span class="badge ${r.role === 'admin' ? 'gray' : 'blue'}" style="font-size:10px">${r.role === 'admin' ? 'QTV' : 'NV'}</span></td>
      <td><span class="badge ${AUDIT_MCLR[r.method] || 'gray'}" style="font-size:10px">${r.method}</span> ${esc(label)}</td>
      <td class="muted" style="font-size:12px;max-width:360px;overflow:hidden;text-overflow:ellipsis">${esc(r.detail || '')}</td>
    </tr>`;
  }).join('');

  el('content').innerHTML = `
    <div class="cards">
      <div class="stat"><div class="l">${IC.history} Tổng bản ghi (mới nhất)</div><div class="v sm">${rows.length}</div></div>
      <div class="stat"><div class="l">${IC.calendar} Thao tác hôm nay</div><div class="v sm">${todayCnt}</div></div>
      <div class="stat"><div class="l">${IC.users} Người thao tác</div><div class="v sm">${users}</div></div>
    </div>
    <div class="panel"><div class="hd"><h2>${IC.history} Nhật ký thao tác</h2>
      <div class="flex" style="gap:8px">
        <select id="auLimit" style="padding:6px 8px;font-size:13px">
          ${[100, 200, 500].map(n => `<option value="${n}" ${n === auditLimit ? 'selected' : ''}>${n} dòng gần nhất</option>`).join('')}
        </select>
        <div class="search"><span class="i">${IC.search}</span><input id="auSearch" placeholder="Tìm người dùng / thao tác..."></div>
      </div></div>
      <div class="pad" style="padding-top:0"><span class="muted" style="font-size:12px" id="auCount"></span></div>
      <div class="table-wrap">
        ${rows.length ? `<table><thead><tr><th>Thời gian</th><th>Người dùng</th><th>Thao tác</th><th>Chi tiết</th></tr></thead>
          <tbody>${body}</tbody></table>` : '<div class="empty">Chưa có nhật ký thao tác nào.</div>'}
      </div>
      <div class="pad muted" style="font-size:12px">${IC.info} Nhật ký ghi lại mọi thao tác thêm/sửa/xóa của quản lý & nhân viên. Mật khẩu, CCCD, ảnh được ẩn tự động.</div>
    </div>`;
  const sel = el('auLimit'); if (sel) sel.onchange = e => { auditLimit = +e.target.value; viewAudit(); };
  const inp = el('auSearch'); if (inp) attachRowSearch(inp, 'auCount');
}

/* ---------- TRUNG TÂM HỖ TRỢ ---------- */
const SUPCAT = { damage: ['Hư hỏng phòng', 'gray', IC.wrench], violation: ['Báo vi phạm', 'amber', IC.flag], other: ['Khác — cần hỗ trợ', 'blue', IC.info] };
const supCatBadge = c => { const [l, cl] = SUPCAT[c] || SUPCAT.damage; return `<span class="badge ${cl}">${l}</span>`; };
// Mỗi trang là 1 mục nav riêng (điểm 1 — Sếp): reg · checkout · repair · violations · feedback
async function viewRequests() {
  const view = ST.view;
  el('content').innerHTML = '<div class="spinner"></div>';
  let apps = [], damage = [], couts = [], vios = [], vstats = null;
  try { [apps, damage, couts, vios, vstats] = await Promise.all([API.applications(), API.damageAll(), API.checkoutReqs(), API.violations(), API.violationStats().catch(() => null)]); }
  catch (e) { return toast(e.message, 'err'); }
  Object.assign(ST, { applications: apps, damage, couts, vstats }); updateNavBadges();
  const threshold = (vstats && vstats.threshold) || 3;

  let body = '';
  if (view === 'reg') {
    const addBtn = `<div class="rowbtns" style="justify-content:space-between;align-items:center;margin-bottom:10px"><span class="muted" style="font-size:12.5px">${IC.info} Mọi học viên đều vào qua đơn đăng ký rồi duyệt. Học viên tự đăng ký tại trang công khai, hoặc admin tạo đơn hộ tại đây.</span><button class="btn pri" onclick="appForm()">${IC.plus} Tạo đơn đăng ký</button></div>`;
    body = addBtn + (apps.length ? `<div class="table-wrap"><table><thead><tr><th>Ngày gửi</th><th>Họ tên</th><th>SĐT</th><th>GT</th><th>Hình thức</th><th>Nguyện vọng</th><th>Trạng thái</th><th></th></tr></thead><tbody>
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
    body = `<div class="panel"><div class="hd"><h2>${IC.wrench} Báo hư hỏng cơ sở vật chất</h2><span class="muted" style="font-size:12px">Duyệt & chuyển bộ phận bảo trì xử lý</span></div>${tbl}</div>`;
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
    body = `
      ${(vstats && vstats.needMail) ? `<div class="hint" style="background:var(--red-bg);border-color:#e3b8ad;color:var(--red-ink)">${IC.alert} <strong>${vstats.needMail} học viên</strong> vi phạm ≥ ${threshold} lần cần báo nhà trường. Cấu hình SMTP trong <a href="#" onclick="adminGo('settings');return false">Cài đặt</a> để gửi email tự động, hoặc bấm <strong>Gửi mail</strong> ở từng dòng.</div>` : ''}
      <div class="panel"><div class="hd"><h2>${IC.alert} Quản lý vi phạm</h2>
        <div class="toolbar">
          <button class="btn sm" onclick="violationStatsModal()">${IC.trendingUp} Thống kê</button>
          <button class="btn sm pri" onclick="violationForm()">${IC.plus} Ghi nhận vi phạm</button>
        </div></div>
        ${vios.length ? `<div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Học viên</th><th>Loại vi phạm</th><th>Mức độ</th><th class="num">Lần</th><th>Nhà trường</th><th></th></tr></thead><tbody>${vioRows}</tbody></table></div>` : '<div class="empty">Chưa ghi nhận vi phạm nào. Bấm <strong>Ghi nhận vi phạm</strong> hoặc mở chi tiết học viên.</div>'}
      </div>`;
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
    body = `<div class="panel"><div class="hd"><h2>${IC.inbox} Hộp thư hỗ trợ / góp ý</h2><span class="muted" style="font-size:12px">Học viên báo vi phạm · cần hỗ trợ khác</span></div>${tbl}</div>`;
  }
  const bare = view === 'repair' || view === 'violations' || view === 'feedback';
  el('content').innerHTML = bare ? body : `<div class="panel">${body}</div>`;
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
  if (r.mail && r.level >= r.threshold) {
    if (r.mail.sent) toast(`Đã ghi vi phạm lần ${r.level} · đã gửi mail nhà trường`);
    else toast(`Vi phạm lần ${r.level} (≥${r.threshold}) — chưa gửi được mail: ${r.mail.reason}`, 'err');
  } else toast(`Đã ghi nhận vi phạm lần ${r.level}`);
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
  const r = await guard(() => API.approveApplication(id, body));
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
  await guard(() => API.checkIn(id, { date: el('c_date').value, room_id: el('c_room').value || null, note: el('c_note').value.trim() }));
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
      <div class="hint">${IC.info} App sẽ tự xét điều kiện hoàn cọc dựa trên ngày báo và lý do.</div>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn danger" onclick="doCheckOut(${id})">Xác nhận check-out</button></div>`);
}
async function doCheckOut(id) {
  const s = studentById(id);
  const r = await guard(() => API.checkOut(id, { date: el('c_date').value, notice_date: el('c_notice').value, reason: el('c_reason').value, note: el('c_note').value.trim() }));
  await refreshCache(); closeModal();
  toast(r.recalced ? `Đã check-out · hóa đơn tháng tính lại ${r.recalced.days_stayed} ngày ở` : 'Đã check-out');
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
  const pool = type === 'in' ? ST.students.filter(s => s.status !== 'in') : ST.students.filter(s => s.status === 'in');
  if (!pool.length) return toast(type === 'in' ? 'Không có học viên nào đang ở ngoài' : 'Không có học viên nào đang ở', 'err');
  openModal(`
    <div class="mh"><h3>${type === 'in' ? IC.check+' Check-in nhanh' : IC.undo+' Check-out nhanh'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb"><div class="field"><label>Chọn học viên</label>
      <select id="q_stu">${pool.map(s => `<option value="${s.id}">${esc(s.name)} ${s.code ? '(' + esc(s.code) + ')' : ''}</option>`).join('')}</select></div></div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn pri" onclick="const id=+el('q_stu').value;closeModal();${type === 'in' ? 'checkInForm' : 'checkOutForm'}(id)">Tiếp tục</button></div>`);
}

/* ---------- TIỀN PHÒNG / HÓA ĐƠN ---------- */
let invMonth = curMonth(), invFilter = 'all', invSearch = '';
function invStatusBadge(st) {
  if (st === 'paid') return '<span class="badge green">Đã đóng</span>';
  if (st === 'sent') return '<span class="badge blue">Đã gửi QR</span>';
  return '<span class="badge amber">Chưa gửi</span>';
}
// Biểu đồ cột mini (sparkline) tiêu thụ điện
function sparkBars(series) {
  const max = Math.max(1, ...series.map(s => s.kwh));
  const w = 9, gap = 3, h = 28;
  const bars = series.map((s, i) => {
    const bh = s.kwh > 0 ? Math.max(2, Math.round(s.kwh / max * h)) : 0;
    const last = i === series.length - 1;
    return `<rect x="${i * (w + gap)}" y="${h - bh}" width="${w}" height="${bh}" rx="1.5" fill="${last ? 'var(--brand)' : 'var(--line2)'}"><title>${monthLabel(s.month)}: ${s.kwh} kWh</title></rect>`;
  }).join('');
  return `<svg width="${series.length * (w + gap)}" height="${h}" style="vertical-align:middle;display:block">${bars}</svg>`;
}
function deltaTag(cur, prev) {
  const d = cur - prev;
  if (!prev && !cur) return '<span class="muted">—</span>';
  if (d === 0) return '<span class="muted">= tháng trước</span>';
  const up = d > 0;
  return `<span style="color:${up ? 'var(--red-ink)' : 'var(--green-ink)'};font-weight:600">${up ? '▲' : '▼'} ${Math.abs(d)} kWh</span>`;
}
async function viewInvoices() {
  el('topActions').innerHTML = `<button class="btn" onclick="electricForm()">${IC.zap} Chỉ số điện</button><button class="btn" onclick="oneInvoiceForm()">${IC.plus} HĐ cho 1 HV</button><button class="btn pri" onclick="generateForm()">${IC.receipt} Tạo hóa đơn theo tháng</button>`;
  el('content').innerHTML = '<div class="spinner"></div>';
  const months = await guard(() => API.invoiceMonths());
  if (months.length && !months.includes(invMonth)) invMonth = months[0];
  const all = await guard(() => API.invoices(invMonth));
  let ehist = { months: [], rooms: [] };
  try { ehist = await API.electricHistory(invMonth, 6); } catch {}
  const elecPanel = ehist.rooms.length ? `<div class="panel"><div class="hd"><h2>${IC.zap} Tiêu thụ điện theo phòng — so với tháng trước</h2><span class="muted" style="font-size:12px">${ehist.months.length} tháng gần nhất · cột cam = tháng này</span></div>
    <div class="table-wrap"><table><thead><tr><th>Phòng</th><th>Xu hướng</th><th class="num">Tháng này</th><th>Chênh lệch</th></tr></thead><tbody>
      ${ehist.rooms.map(r => { const cur = r.series[r.series.length - 1].kwh; const prev = r.series.length > 1 ? r.series[r.series.length - 2].kwh : 0; return `<tr>
        <td><strong>${esc(r.room_name)}</strong></td>
        <td>${sparkBars(r.series)}</td>
        <td class="num"><strong>${cur}</strong> kWh</td>
        <td>${deltaTag(cur, prev)}</td>
      </tr>`; }).join('')}
    </tbody></table></div></div>` : '';
  let list = all.slice();
  if (invFilter === 'paid') list = list.filter(i => i.status === 'paid');
  if (invFilter === 'unpaid') list = list.filter(i => i.status !== 'paid');
  // Tìm kiếm áp dụng bằng ẩn/hiện hàng (attachRowSearch)

  const total = all.reduce((a, i) => a + (+i.total || 0), 0);
  const paid = all.filter(i => i.status === 'paid').reduce((a, i) => a + (+i.total || 0), 0);

  el('content').innerHTML = `
    <div class="cards">
      <div class="stat"><div class="l">${IC.calendar} Kỳ</div><div class="v sm"><select id="im" style="font-size:15px;font-weight:600;padding:6px 8px">${(months.length ? months : [invMonth]).map(m => `<option value="${m}" ${m === invMonth ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select></div></div>
      <div class="stat"><div class="l">${IC.receipt} Số phiếu</div><div class="v sm">${all.length}</div></div>
      <div class="stat"><div class="l">Tổng tiền phiếu (dự báo)</div><div class="v sm">${money(total)}</div></div>
    </div>
    <div class="panel"><div class="hd"><h2>Phiếu báo tiền phòng ${monthLabel(invMonth)} (<span id="invCount">${list.length}</span>)</h2>
      <div class="toolbar">
        <div class="search"><span class="i">${IC.search}</span><input id="invs" placeholder="Tìm tên HV / số phòng..." value="${esc(invSearch)}"></div>
        ${all.length ? `<button class="btn sm" onclick='exportCSV(${JSON.stringify(list).replace(/'/g, "&#39;")})'>${IC.download} Xuất Excel (CSV)</button>` : ''}</div></div>
      <div class="table-wrap">
      ${all.length === 0 ? `<div class="empty">Chưa có hóa đơn nào cho kỳ này.<br><br><button class="btn pri" onclick="generateForm()">${IC.receipt} Tạo hóa đơn</button></div>` :
      list.length ? `<table><thead><tr><th>Học viên</th><th>Phòng</th><th class="num">Ngày ở</th><th class="num">Phòng</th><th class="num">Điện</th><th class="num">Nước</th><th class="num">DV</th><th class="num">Giặt</th><th class="num">Xe</th><th class="num">Tổng</th><th></th></tr></thead><tbody>
        ${list.map(i => `<tr data-s="${esc(((i.student_name || '') + ' ' + (i.student_code || '') + ' ' + (i.room_name || '')).toLowerCase())}">
          <td><strong>${esc(i.student_name)}</strong>${i.student_code ? `<div class="muted" style="font-size:11px">${esc(i.student_code)}</div>` : ''}</td>
          <td>${esc(i.room_name || '—')}</td>
          <td class="num">${i.days_stayed}</td>
          <td class="num">${money(i.room_charge)}</td>
          <td class="num">${money(i.electric_charge)}<div class="muted" style="font-size:10px">${i.electric_kwh || 0} kWh</div></td>
          <td class="num">${money(i.water_charge)}</td>
          <td class="num">${money(i.service_charge)}</td>
          <td class="num">${i.washing_charge ? money(i.washing_charge) : '—'}</td>
          <td class="num">${i.parking_charge ? money(i.parking_charge) : '—'}</td>
          <td class="num"><strong>${money(i.total)}</strong></td>
          <td class="num"><div class="rowbtns" style="justify-content:flex-end">
            <button class="btn sm pri" onclick='phieuBao(${JSON.stringify(i).replace(/'/g, "&#39;")})'>${IC.fileText} Phiếu báo</button>
            <button class="btn sm ghost" title="Tính lại theo số ngày ở hiện tại" onclick="recalcInv(${i.id})">${IC.refresh}</button>
            <button class="btn sm ghost" onclick='invoiceForm(${i.id}, ${JSON.stringify(i).replace(/'/g, "&#39;")})'>${IC.pencil}</button>
            <button class="btn sm ghost" onclick="delInvoice(${i.id})">${IC.trash}</button>
          </div></td></tr>`).join('')}
        <tr class="no-result" style="display:none"><td colspan="12"><div class="empty">Không tìm thấy hóa đơn phù hợp.</div></td></tr>
      </tbody></table>` : `<div class="empty">Không có hóa đơn ${invFilter === 'paid' ? 'đã đóng' : 'chưa đóng'} trong kỳ này.</div>`}
    </div></div>
    ${elecPanel}`;
  const im = el('im'); if (im) im.onchange = e => { invMonth = e.target.value; viewInvoices(); };
  const iv = el('invs'); if (iv) { iv.addEventListener('input', () => invSearch = iv.value); attachRowSearch(iv, 'invCount'); }
}
function invActions(i) {
  if (i.status === 'pending') return `<button class="btn sm" onclick="setInvStatus(${i.id},'sent')">Đã gửi QR</button><button class="btn sm green" onclick="setInvStatus(${i.id},'paid')">${IC.check} Đóng</button>`;
  if (i.status === 'sent') return `<button class="btn sm green" onclick="setInvStatus(${i.id},'paid')">${IC.check} Đã đóng</button><button class="btn sm" onclick="setInvStatus(${i.id},'pending')">${IC.undo}</button>`;
  return `<button class="btn sm" onclick="setInvStatus(${i.id},'pending')">Bỏ đóng</button>`;
}
async function setInvStatus(id, status) { await guard(() => API.setInvoiceStatus(id, status)); await refreshCache(); viewInvoices(); }
async function recalcInv(id) { const r = await guard(() => API.recalcInvoice(id)); toast(`Đã tính lại: ${r.days_stayed} ngày ở → ${money(r.total)}`); viewInvoices(); }
async function markMonthPaid() {
  if (!confirm(`Đánh dấu TẤT CẢ hóa đơn ${monthLabel(invMonth)} là đã thu?`)) return;
  const r = await guard(() => API.markPaid(invMonth));
  toast(`Đã đánh dấu ${r.updated} hóa đơn đã thu`); viewInvoices();
}
async function delInvoice(id) { if (!confirm('Xóa hóa đơn này?')) return; await guard(() => API.deleteInvoice(id)); await refreshCache(); toast('Đã xóa'); viewInvoices(); }

/* Tạo hóa đơn tự tính cho 1 học viên (VD học viên mới vào giữa tháng) */
function oneInvoiceForm() {
  const opts = ST.students.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'))
    .map(s => `<option value="${s.id}">${esc(s.name)}${s.code ? ' (' + esc(s.code) + ')' : ''}${s.room_name ? ' · ' + esc(s.room_name) : ''}</option>`).join('');
  openModal(`
    <div class="mh"><h3>${IC.plus} Tạo hóa đơn cho 1 học viên</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="hint">${IC.info} Dùng khi có học viên mới vào giữa tháng. Hệ thống <strong>tự tính</strong> theo phòng, số ngày ở và chỉ số điện đã lưu — không ảnh hưởng hóa đơn người khác (người đã đóng sẽ bị khóa).</div>
      <div class="grid2">
        <div class="field"><label>Học viên *</label><select id="oi_stu">${opts}</select></div>
        <div class="field"><label>Kỳ (tháng)</label><input id="oi_month" type="month" value="${invMonth}"></div>
      </div>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn pri" onclick="saveOneInvoice()">Tạo &amp; xem phiếu báo</button></div>`);
}
async function saveOneInvoice() {
  const student_id = +el('oi_stu').value, month = el('oi_month').value;
  if (!student_id) return toast('Chọn học viên', 'err');
  if (!month) return toast('Chọn kỳ', 'err');
  const r = await guard(() => API.generateOneInvoice({ student_id, month }));
  await refreshCache(); closeModal(); invMonth = month; invFilter = 'all';
  toast(r.created ? 'Đã tạo hóa đơn cho học viên' : 'Đã cập nhật hóa đơn');
  viewInvoices();
  if (r.invoice) { r.invoice.room_name = (roomById(r.invoice.room_id) || {}).name || ''; setTimeout(() => phieuBao(r.invoice), 150); }
}
async function generateForm() {
  el('overlay').classList.add('show');
  el('modal').className = 'modal wide';
  el('modal').innerHTML = `<div class="mb"><div class="spinner"></div></div>`;
  await renderGenerateForm(invMonth);
}
async function renderGenerateForm(month) {
  const rooms = await guard(() => API.electric(month));
  el('modal').innerHTML = `
    <div class="mh"><h3>${IC.receipt} Tạo hóa đơn tháng</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="field"><label>Kỳ (tháng)</label><input id="g_month" type="month" value="${month}" onchange="renderGenerateForm(this.value)"></div>
      <div class="hint">${IC.bulb} Nhập <strong>số cuối công-tơ</strong>. Số đầu tự lấy = số cuối tháng trước (sửa được để test). Tiền điện = (cuối − đầu) × ${money(ST.settings.electric_unit)}, chia đều theo số người ở.</div>
      ${electricTable(rooms)}
      <p class="muted" style="font-size:12px;margin-top:10px">Hóa đơn <strong>chưa đóng</strong> sẽ được <strong>tính lại</strong> theo điện & ngày mới; hóa đơn <strong>đã đóng</strong> được giữ nguyên.</p>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn pri" onclick="runGenerate()">Lưu số điện & tạo/cập nhật hóa đơn</button></div>`;
}
// Bảng nhập chỉ số điện (số đầu + số cuối đều sửa được)
function electricTable(rooms) {
  return `<div class="table-wrap" style="max-height:340px;overflow:auto"><table><thead><tr><th>Phòng</th><th class="num">Đang ở</th><th class="num">Số đầu</th><th class="num">Số cuối</th><th class="num">Tiêu thụ</th><th class="num">Tiền điện</th></tr></thead><tbody>
    ${rooms.map(r => { const st = +r.reading_start || 0, en = +r.reading_end || 0; return `<tr>
      <td><strong>${esc(r.room_name)}</strong> <span class="muted">${r.gender === 'female' ? 'Nữ' : 'Nam'}</span></td>
      <td class="num">${r.occupancy}</td>
      <td class="num"><input type="number" min="0" step="0.1" data-estart="${r.room_id}" value="${st || ''}" placeholder="0" style="width:90px;text-align:right" oninput="ecalc(${r.room_id})"></td>
      <td class="num"><input type="number" min="0" step="0.1" data-room="${r.room_id}" value="${en || ''}" placeholder="0" style="width:90px;text-align:right" oninput="ecalc(${r.room_id})"></td>
      <td class="num" id="ek_${r.room_id}">${Math.max(0, en - st)}</td>
      <td class="num" id="em_${r.room_id}">${money(Math.max(0, en - st) * (+ST.settings.electric_unit || 0))}</td></tr>`; }).join('')}
  </tbody></table></div>`;
}
function ecalc(rid) {
  const st = +document.querySelector(`[data-estart="${rid}"]`).value || 0;
  const en = +document.querySelector(`[data-room="${rid}"]`).value || 0;
  const kwh = Math.max(0, en - st);
  el('ek_' + rid).textContent = kwh;
  el('em_' + rid).textContent = money(kwh * (+ST.settings.electric_unit || 0));
}
function readElectricInputs() {
  return [...document.querySelectorAll('#modal input[data-room]')].map(inp => ({
    room_id: +inp.dataset.room,
    reading_end: +inp.value || 0,
    reading_start: +(document.querySelector(`[data-estart="${inp.dataset.room}"]`)?.value) || 0,
  }));
}
/* Màn hình nhập chỉ số điện độc lập (lưu, không tạo hóa đơn) */
let elecMonth = curMonth();
async function electricForm() {
  el('overlay').classList.add('show'); el('modal').className = 'modal wide';
  el('modal').innerHTML = `<div class="mb"><div class="spinner"></div></div>`;
  await renderElectricForm(elecMonth);
}
async function renderElectricForm(month) {
  elecMonth = month;
  const rooms = await guard(() => API.electric(month));
  el('modal').innerHTML = `
    <div class="mh"><h3>${IC.zap} Chỉ số điện theo tháng</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="field"><label>Kỳ (tháng)</label><input id="e_month" type="month" value="${month}" onchange="renderElectricForm(this.value)"></div>
      <div class="hint">Nhập số đầu (lần đầu để test) và số cuối. Tháng sau số đầu sẽ tự nối tiếp. Bấm Lưu để ghi lại — dùng khi tạo hóa đơn.</div>
      ${electricTable(rooms)}
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Đóng</button><button class="btn pri" onclick="saveElectric()">Lưu chỉ số điện</button></div>`;
}
async function saveElectric() {
  const readings = readElectricInputs();
  await guard(() => API.saveElectric({ month: el('e_month').value, readings }));
  closeModal(); toast('Đã lưu chỉ số điện');
}
async function runGenerate() {
  const month = el('g_month').value; if (!month) return toast('Chọn kỳ', 'err');
  const readings = readElectricInputs();
  // Bước 1: xem trước (dry-run) — tính nhưng KHÔNG lưu
  const pv = await guard(() => API.generateInvoices({ month, readings, preview: true }));
  const msg = `Kỳ ${month} — ${pv.total} học viên ở trong kỳ:\n`
    + `• Tạo mới: ${pv.created}\n`
    + `• Cập nhật (chưa thu): ${pv.updated}\n`
    + `• Bỏ qua (đã đóng, khóa): ${pv.skipped}\n\n`
    + `Tiếp tục lập hóa đơn? (Chạy lại bao nhiêu lần cũng được — HV mới vào giữa tháng sẽ được tạo bù, hóa đơn đã thu không bị đụng.)`;
  if (!confirm(msg)) return;
  // Bước 2: lập thật
  const r = await guard(() => API.generateInvoices({ month, readings }));
  await refreshCache(); closeModal(); invMonth = month; invFilter = 'all';
  toast(`Đã tạo ${r.created} · cập nhật ${r.updated || 0}${r.skipped ? ` · bỏ qua ${r.skipped} (đã đóng)` : ''} hóa đơn`);
  viewInvoices();
}
function invoiceForm(id, i) {
  i = i || { student_id: '', month: invMonth, days_stayed: 0, room_charge: 0, electric_kwh: 0, electric_charge: 0, water_charge: 0, service_charge: 0, washing_charge: 0, parking_charge: 0, other_charge: 0, other_note: '' };
  const opts = ST.students.map(s => `<option value="${s.id}" ${i.student_id === s.id ? 'selected' : ''}>${esc(s.name)}${s.code ? ' (' + esc(s.code) + ')' : ''}</option>`).join('');
  const f = (lbl, key, extra = '') => `<div class="field"><label>${lbl}</label><input id="i_${key}" type="number" min="0" value="${esc(i[key] || 0)}" ${extra}></div>`;
  openModal(`
    <div class="mh"><h3>${id ? 'Sửa hóa đơn' : 'Thêm hóa đơn lẻ'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="grid2">
        <div class="field"><label>Học viên *</label><select id="i_stu" ${id ? 'disabled' : ''}>${opts}</select></div>
        <div class="field"><label>Kỳ</label><input id="i_month" type="month" value="${i.month}"></div>
      </div>
      <div class="grid2">${f('Số ngày ở', 'days_stayed')}${f('Tiền phòng', 'room_charge')}</div>
      <div class="grid2">${f('Tiền điện', 'electric_charge')}${f('Nước', 'water_charge')}</div>
      <div class="grid2">${f('Dịch vụ', 'service_charge')}${f('Máy giặt', 'washing_charge')}</div>
      <div class="grid2">${f('Gửi xe', 'parking_charge')}${f('Khoản khác', 'other_charge')}</div>
      <div class="field"><label>Ghi chú khoản khác</label><input id="i_other_note" value="${esc(i.other_note || '')}"></div>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn pri" onclick="saveInvoice(${id || 0})">Lưu</button></div>`, true);
}
async function saveInvoice(id) {
  const g = k => +el('i_' + k).value || 0;
  const body = { student_id: +el('i_stu').value, month: el('i_month').value, days_stayed: g('days_stayed'),
    room_charge: g('room_charge'), electric_charge: g('electric_charge'), water_charge: g('water_charge'),
    service_charge: g('service_charge'), washing_charge: g('washing_charge'), parking_charge: g('parking_charge'),
    other_charge: g('other_charge'), other_note: el('i_other_note').value.trim() };
  if (!body.student_id) return toast('Chọn học viên', 'err');
  await guard(() => id ? API.updateInvoice(id, body) : API.createInvoice(body));
  await refreshCache(); closeModal(); invMonth = body.month; toast('Đã lưu hóa đơn'); viewInvoices();
}
async function phieuBao(inv) {
  const s = studentById(inv.student_id) || {};
  const room = roomById(s.room_id) || {};
  const fac = ST.facilities.find(f => f.id === room.facility_id) || {};
  const set = ST.settings;
  let er = null; try { er = (await API.electric(inv.month)).find(x => x.room_id === s.room_id); } catch {}
  const unit = +set.electric_unit || 0;
  const occ = ST.students.filter(x => x.room_id === s.room_id && isOccupying(x)).length || 1;

  const rows = [];
  let stt = 0;
  const row = (khoan, ct, tt) => rows.push(`<tr><td>${++stt}</td><td><strong>${khoan}</strong></td><td>${ct}</td><td class="n">${money(tt)}</td></tr>`);
  row('Tiền phòng', `${inv.days_stayed} ngày ở · ${RENTAL_LABEL[s.rental_type] || 'Thuê ghép'}`, inv.room_charge);
  row('Tiền điện', er ? `CS ${er.reading_start}→${er.reading_end} · ${inv.electric_kwh} kWh × ${money(unit)} ÷ ${occ} người` : `${inv.electric_kwh} kWh × ${money(unit)}`, inv.electric_charge);
  row('Tiền nước', `${money(set.water_fee)}/người/tháng`, inv.water_charge);
  row('Phí dịch vụ', 'Wifi + Rác + An ninh trật tự', inv.service_charge);
  if (+inv.washing_charge) row('Máy giặt', `${money(set.washing_fee)}/tháng`, inv.washing_charge);
  if (+inv.parking_charge) row('Gửi xe', `${money(set.parking_fee)}/xe`, inv.parking_charge);
  if (+inv.other_charge) row(inv.other_note || 'Khoản khác', '', inv.other_charge);

  openModal(`
    <div class="mh rc-noprint"><h3>${IC.fileText} Phiếu báo tiền phòng</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb"><div id="receiptArea"><div class="receipt">
      <div class="rc-head">
        <h2>${esc(set.dorm_name || 'Ký túc xá')}</h2>
        <div class="addr">${esc(fac.address || '')}${set.hotline ? ' · Hotline: ' + esc(set.hotline) : ''}</div>
      </div>
      <div class="rc-title">PHIẾU BÁO TIỀN PHÒNG — ${monthLabel(inv.month).toUpperCase()}</div>
      <div class="rc-info">
        <div><b>Họ và tên:</b> ${esc(s.name)}</div>
        <div><b>Phòng:</b> ${esc(inv.room_name || '—')} (Hạng ${esc(room.hang || '')}) &nbsp;&nbsp; <b style="min-width:0">MSHV:</b> ${esc(s.code || '—')} &nbsp;&nbsp; <b style="min-width:0">Lớp:</b> ${esc(s.class_name || '—')}</div>
        <div><b>Ngày nhận phòng:</b> ${fmtDate(s.check_in_date)}</div>
      </div>
      <table><thead><tr><th style="width:36px">STT</th><th>Khoản thu</th><th>Chi tiết</th><th class="n">Thành tiền</th></tr></thead><tbody>
        ${rows.join('')}
        <tr class="rc-total"><td colspan="3">TỔNG CỘNG PHẢI NỘP</td><td class="n">${money(inv.total)}</td></tr>
      </tbody></table>
      <div class="rc-note">
        ${IC.creditCard} Thanh toán qua <strong>mã QR</strong> do quản lý gửi trên Zalo. Hạn đóng: <strong>ngày ${set.due_day_from || 1}–${set.due_day_to || 5}</strong> hàng tháng.<br>
        ${IC.pin} Nếu có sai sót, vui lòng báo lại trước ngày 05. Xin cảm ơn!
      </div>
    </div></div></div>
    <div class="mf rc-noprint">
      <button class="btn" onclick="closeModal()">Đóng</button>
      <button class="btn pri" onclick="downloadPhieuBao('phieu-bao-${esc(String(s.code || inv.student_id))}-${inv.month}')">${IC.download} Tải phiếu báo</button>
    </div>`, true);
}
// Tải phiếu báo dưới dạng file HTML tự chứa (không in) — mở ra đúng định dạng, tự lưu PDF nếu muốn
function downloadPhieuBao(fname) {
  const inner = el('receiptArea') ? el('receiptArea').innerHTML : '';
  const css = `<style>
    body{margin:0;padding:24px;background:#fff}
    .receipt{font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#2a251f;max-width:620px;margin:0 auto}
    .receipt .rc-head{text-align:center;border-bottom:2px solid #b8863b;padding-bottom:16px;margin-bottom:16px}
    .receipt .rc-head h2{margin:0;font-size:24px;color:#2a251f;text-transform:uppercase;letter-spacing:.04em;font-weight:700}
    .receipt .rc-head .addr{font-size:12.5px;color:#6a6055;margin-top:5px}
    .receipt .rc-title{text-align:center;font-size:15px;font-weight:700;margin:6px 0 16px;letter-spacing:.03em;text-transform:uppercase;color:#8a6528}
    .receipt .rc-info{font-size:13.5px;line-height:1.95}
    .receipt .rc-info b{display:inline-block;min-width:120px;color:#4a443c}
    .receipt table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px}
    .receipt th,.receipt td{border:1px solid #e2d8ca;padding:9px 11px;text-align:left}
    .receipt th{background:#f5ecd9;font-size:12px;color:#4a443c}
    .receipt td.n,.receipt th.n{text-align:right}
    .receipt .rc-total{background:#fbf4e8}
    .receipt .rc-total td{font-weight:800;font-size:15px;color:#8a6528}
    .receipt .rc-note{font-size:12.5px;color:#6a6055;margin-top:14px;border-top:1px dashed #d8cdbd;padding-top:10px}
    .receipt .rc-note svg{width:15px;height:15px;vertical-align:-2px}
  </style>`;
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(fname)}</title>${css}</head><body>${inner}</body></html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  a.download = fname + '.html'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Đã tải phiếu báo');
}
function exportCSV(rows) {
  const head = ['Ho ten', 'Ma HV', 'Phong', 'Ky', 'So ngay o', 'Tien phong', 'Dien (kWh)', 'Tien dien', 'Nuoc', 'Dich vu', 'May giat', 'Gui xe', 'Khac', 'Tong'];
  const data = rows.map(i => [i.student_name, i.student_code || '', i.room_name || '', i.month, i.days_stayed, i.room_charge, i.electric_kwh, i.electric_charge, i.water_charge, i.service_charge, i.washing_charge, i.parking_charge, i.other_charge, i.total]);
  const csv = '﻿' + [head, ...data].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `tien-phong-${invMonth}.csv`; a.click();
  toast('Đã xuất file CSV');
}

/* ---------- CÀI ĐẶT ---------- */
function viewSettings() {
  const s = ST.settings;
  const fee = (lbl, key, note = '') => `<div class="field"><label>${lbl} ${note ? `<span class="opt">${note}</span>` : ''}</label><input id="set_${key}" type="number" min="0" value="${esc(s[key] || 0)}"></div>`;
  el('content').innerHTML = `
    <div class="panel"><div class="hd"><h2>${IC.home} Thông tin hiển thị trên phiếu báo</h2></div><div class="pad">
      <div class="grid2">
        <div class="field"><label>Tên ký túc xá</label><input id="set_dorm_name" value="${esc(s.dorm_name || '')}"></div>
        <div class="field"><label>Hotline</label><input id="set_hotline" value="${esc(s.hotline || '')}" placeholder="VD: 0906 316 671"></div>
      </div>
      <p class="muted" style="font-size:12px;margin:0">Địa chỉ lấy theo từng cơ sở (mục Cơ sở bên dưới).</p>
    </div></div>
    <div class="panel"><div class="hd"><h2>${IC.banknote} Đơn giá & quy tắc tính tiền</h2></div><div class="pad">
      <div class="grid2">
        ${fee('Tiền phòng', 'room_fee', '/người/tháng')}
        ${fee('Cọc', 'deposit_fee', 'khi nhận phòng')}
      </div>
      <div class="grid2">
        ${fee('Nước', 'water_fee', '/người/tháng')}
        ${fee('Điện', 'electric_unit', '/kWh')}
      </div>
      <div class="grid2">
        ${fee('Dịch vụ', 'service_fee', '/người/tháng')}
        ${fee('Máy giặt', 'washing_fee', '/tháng')}
      </div>
      <div class="grid2">
        ${fee('Gửi xe', 'parking_fee', '/xe/tháng')}
        <div></div>
      </div>
      <div style="font-weight:600;font-size:13px;margin:6px 0 10px">${IC.home} Giá thuê nguyên phòng theo hạng</div>
      <div class="grid2">
        ${fee('Hạng A', 'room_price_A', '/phòng/tháng')}
        ${fee('Hạng B', 'room_price_B', '/phòng/tháng')}
      </div>
      <div class="grid2">
        ${fee('Hạng C', 'room_price_C', '/phòng/tháng')}
        ${fee('Hạng D', 'room_price_D', '/phòng/tháng')}
      </div>
      <div class="grid2">
        <div class="field"><label>Tháng lẻ: ở trên (ngày) → tính 50%</label><input id="set_partial_half_min" type="number" min="0" value="${esc(s.partial_half_min)}"></div>
        <div class="field"><label>Tháng lẻ: ở trên (ngày) → tính 100%</label><input id="set_partial_full_min" type="number" min="0" value="${esc(s.partial_full_min)}"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Pháp nhân phòng Nữ</label><input id="set_legal_female" value="${esc(s.legal_female || 'E2')}"></div>
        <div class="field"><label>Pháp nhân phòng Nam</label><input id="set_legal_male" value="${esc(s.legal_male || 'S2')}"></div>
      </div>
      <button class="btn pri" onclick="saveSettings()">Lưu cài đặt</button>
    </div></div>

    <div class="panel"><div class="hd"><h2>${IC.receipt} Mã sản phẩm Bravo (đối chiếu doanh thu)</h2></div><div class="pad">
      <div class="field"><label>Loại phí chung</label><input id="set_bravo_fee_type" value="${esc(s.bravo_fee_type || '')}" placeholder="T0704" style="max-width:200px"></div>
      <div class="grid2">
        <div class="field"><label>Phí lưu trú (tiền phòng)</label><input id="set_bravo_room" value="${esc(s.bravo_room || '')}" placeholder="GP00180"></div>
        <div class="field"><label>Phí điện</label><input id="set_bravo_electric" value="${esc(s.bravo_electric || '')}" placeholder="GP00184"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Phí nước</label><input id="set_bravo_water" value="${esc(s.bravo_water || '')}" placeholder="GP00181"></div>
        <div class="field"><label>Phí dịch vụ chung</label><input id="set_bravo_service" value="${esc(s.bravo_service || '')}" placeholder="GP00183"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Phí gửi xe</label><input id="set_bravo_parking" value="${esc(s.bravo_parking || '')}" placeholder="GP00182"></div>
        <div class="field"><label>Phí máy giặt</label><input id="set_bravo_washing" value="${esc(s.bravo_washing || '')}" placeholder="(mã Bravo nếu có)"></div>
      </div>
      <button class="btn pri" onclick="saveBravo()">Lưu mã Bravo</button>
    </div></div>

    <div class="panel"><div class="hd"><h2>${IC.building} Cơ sở ký túc xá</h2><button class="btn sm" onclick="facilityForm()">${IC.plus} Thêm cơ sở</button></div>
      <div class="table-wrap"><table><thead><tr><th>Tên</th><th>Địa chỉ</th><th class="num">Số phòng</th><th></th></tr></thead><tbody>
        ${ST.facilities.map(f => `<tr><td><strong>${esc(f.name)}</strong></td><td class="muted">${esc(f.address || '')}</td><td class="num">${f.room_count}</td>
          <td class="num"><div class="rowbtns" style="justify-content:flex-end"><button class="btn sm" onclick="facilityForm(${f.id})">Sửa</button><button class="btn sm danger" onclick="delFacility(${f.id})">Xóa</button></div></td></tr>`).join('')}
      </tbody></table></div>
    </div>

    <div class="panel"><div class="hd"><h2>${IC.armchair} Tài sản / trang thiết bị trong phòng</h2><button class="btn sm" onclick="assetForm()">${IC.plus} Thêm tài sản</button></div>
      <div class="table-wrap"><table><thead><tr><th>Tên tài sản</th><th>Loại</th><th>ĐVT</th><th class="num">SL</th><th class="num">Phí bồi hoàn</th><th></th></tr></thead><tbody>
        ${ST.assets.map(a => `<tr>
          <td><strong>${esc(a.name)}</strong></td>
          <td>${a.category === 'person' ? '<span class="badge blue">Theo người</span>' : '<span class="badge gray">Cố định</span>'}</td>
          <td>${esc(a.unit)}</td><td class="num">${a.quantity}</td><td class="num">${a.fee ? money(a.fee) : '<span class="muted">—</span>'}</td>
          <td class="num"><div class="rowbtns" style="justify-content:flex-end"><button class="btn sm" onclick="assetForm(${a.id})">Sửa</button><button class="btn sm ghost" onclick="delAsset(${a.id})">${IC.trash}</button></div></td>
        </tr>`).join('')}
      </tbody></table></div>
      <div class="pad muted" style="font-size:12.5px">${IC.bulb} Phí bồi hoàn dùng để khấu trừ vào cọc khi học viên trả phòng (nếu tài sản hư/mất/không vệ sinh).</div>
    </div>

    <div class="panel"><div class="hd"><h2>${IC.filePen} Nội dung trang giới thiệu</h2><a class="btn sm" href="/dang-ky" target="_blank">Xem trang</a></div><div class="pad">
      <div class="hint">${IC.info} Chỉnh tiêu đề &amp; mô tả từng mục ở trang đăng ký công khai. Để trống sẽ dùng nội dung mặc định.</div>
      ${INTRO_FIELDS.map(([k, label, t]) => `<div class="field"><label>${label}</label>${t === 'ta' ? `<textarea id="set_${k}" rows="2">${esc(s[k] || '')}</textarea>` : `<input id="set_${k}" value="${esc(s[k] || '')}">`}</div>`).join('')}
      <button class="btn pri" onclick="saveIntro()">Lưu nội dung</button>
    </div></div>

    <div class="panel"><div class="hd"><h2>${IC.building} Ảnh khu nội trú (trang giới thiệu)</h2><a class="btn sm" href="/dang-ky" target="_blank">Xem trang</a></div><div class="pad">
      <div class="hint">${IC.info} Ảnh hiển thị ở <strong>trang đăng ký công khai</strong> cho học viên xem. Chọn ảnh từ máy — lưu ngay, <strong>không cần sửa code</strong>. Nên dùng ảnh ngang, dung lượng < 1MB để tải nhanh.</div>
      <div class="media-grid">
        ${INTRO_MEDIA.map(([key, label]) => `<div class="media-slot">
          <div class="media-thumb"><img src="/api/public/image/${key}?t=${Date.now()}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="media-empty" style="display:none">${IC.building}<span>Chưa có ảnh</span></div></div>
          <div class="media-info">${key === 'hero' ? `<strong>${label}</strong><div class="muted" style="font-size:11px">Ảnh nền — không có nhãn</div>` : `<label style="font-size:11px;color:var(--muted);font-weight:600">Nhãn hiển thị</label><input id="set_imgcap_${key}" value="${esc(s['imgcap_' + key] || label)}" placeholder="VD: ${esc(label)}">`}</div>
          <div class="rowbtns">
            <label class="btn sm">${IC.download} Chọn ảnh<input type="file" accept="image/*" style="display:none" onchange="uploadIntroMedia('${key}', this)"></label>
            <button class="btn sm ghost" title="Xóa ảnh" onclick="removeIntroMedia('${key}')">${IC.trash}</button>
          </div>
        </div>`).join('')}
      </div>
      <button class="btn pri" style="margin-top:14px" onclick="saveImgCaptions()">Lưu nhãn ảnh</button>
    </div></div>

    <div class="panel"><div class="hd"><h2>${IC.alert} Loại vi phạm / nhắc nhở</h2><button class="btn sm" onclick="vtypeForm()">${IC.plus} Thêm loại</button></div>
      <div class="table-wrap"><table><thead><tr><th>Tên loại vi phạm</th><th>Mức độ</th><th></th></tr></thead><tbody>
        ${(ST.vtypes || []).map(t => `<tr>
          <td><strong>${esc(t.name)}</strong>${t.active === false ? ' <span class="badge gray">Ẩn</span>' : ''}</td>
          <td>${vioSevBadge(t.severity)}</td>
          <td class="num"><div class="rowbtns" style="justify-content:flex-end"><button class="btn sm" onclick="vtypeForm(${t.id})">Sửa</button><button class="btn sm ghost" onclick="delVtype(${t.id})">${IC.trash}</button></div></td>
        </tr>`).join('')}
      </tbody></table></div>
      <div class="pad muted" style="font-size:12.5px">${IC.bulb} Dùng khi ghi nhận vi phạm cho học viên. Đến ngưỡng cấu hình bên dưới, hệ thống gửi email nhà trường.</div>
    </div>

    <div class="panel"><div class="hd"><h2>${IC.inbox} Nhà trường & Email (SMTP)</h2></div><div class="pad">
      <div class="grid2">
        <div class="field"><label>Tên nhà trường</label><input id="set_school_name" value="${esc(s.school_name || '')}" placeholder="VD: Trường Nhật ngữ ..."></div>
        <div class="field"><label>Email nhà trường <span class="opt">(nhận thông báo vi phạm)</span></label><input id="set_school_email" value="${esc(s.school_email || '')}" placeholder="daotao@truong.edu.vn"></div>
      </div>
      <div class="field"><label>Gửi email khi vi phạm đủ <span class="opt">(số lần)</span></label><input id="set_violation_mail_threshold" type="number" min="1" value="${esc(s.violation_mail_threshold || 3)}" style="max-width:120px"></div>
      <div class="hint">${IC.info} Điền cấu hình SMTP để hệ thống tự gửi email. Gmail: host <strong>smtp.gmail.com</strong> · port <strong>587</strong> · secure <strong>false</strong> · mật khẩu dùng <strong>App Password</strong> (không dùng mật khẩu đăng nhập thường).</div>
      <div class="grid2">
        <div class="field"><label>SMTP host</label><input id="set_smtp_host" value="${esc(s.smtp_host || '')}" placeholder="smtp.gmail.com"></div>
        <div class="field"><label>Port</label><input id="set_smtp_port" value="${esc(s.smtp_port || '587')}" placeholder="587"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Tài khoản (user)</label><input id="set_smtp_user" value="${esc(s.smtp_user || '')}" placeholder="email gửi đi"></div>
        <div class="field"><label>Mật khẩu (App Password) ${s.smtp_pass_set ? '<span class="badge green" style="font-size:10px">Đã lưu</span>' : ''}</label><input id="set_smtp_pass" type="password" value="" placeholder="${s.smtp_pass_set ? '•••••• (để trống nếu giữ nguyên)' : 'Nhập App Password'}"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Người gửi <span class="opt">(from)</span></label><input id="set_smtp_from" value="${esc(s.smtp_from || '')}" placeholder="Ban quản lý KTX"></div>
        <div class="field"><label>Bảo mật (secure)</label><select id="set_smtp_secure"><option value="false" ${s.smtp_secure !== 'true' ? 'selected' : ''}>false — STARTTLS (port 587)</option><option value="true" ${s.smtp_secure === 'true' ? 'selected' : ''}>true — SSL/TLS (port 465)</option></select></div>
      </div>
      <div class="hint" style="font-size:12px">${IC.lock} Vì bảo mật, mật khẩu SMTP <strong>không bao giờ được trả về</strong>. Để trống ô mật khẩu khi lưu nếu muốn giữ nguyên mật khẩu đã lưu.</div>
      <div class="rowbtns" style="margin-top:6px">
        <button class="btn pri" onclick="saveMailSettings()">Lưu cấu hình email</button>
        <button class="btn" id="smtpTestBtn" onclick="testSmtpConnection()">${IC.mail} Kiểm tra kết nối</button>
        <span id="smtpTestResult" class="muted" style="font-size:12.5px;align-self:center"></span>
      </div>
    </div></div>

    <div class="panel"><div class="hd"><h2>${IC.shield} Người dùng & phân quyền</h2><button class="btn sm" onclick="userForm()">${IC.plus} Thêm nhân viên</button></div>
      <div class="table-wrap"><table><thead><tr><th>Tên đăng nhập</th><th>Họ tên</th><th>Vai trò</th><th></th></tr></thead>
        <tbody id="usrRows"><tr><td colspan="4"><div class="spinner"></div></td></tr></tbody></table></div>
      <div class="pad muted" style="font-size:12.5px">${IC.bulb} <strong>Quản trị viên</strong> có toàn quyền (kể cả Điều hành, Doanh thu, Nhật ký, Cài đặt). <strong>Nhân viên</strong> chỉ thao tác nghiệp vụ (Học viên, Phòng, Xe, Check-in/out, Tiền phòng, Tiếp nhận & Hỗ trợ) và đều được ghi vào Nhật ký.</div>
    </div>

    <div class="panel"><div class="hd"><h2>${IC.key} Tài khoản của bạn</h2></div><div class="pad">
      <button class="btn" onclick="changePwd()">${IC.key} Đổi mật khẩu</button>
    </div></div>`;
  loadAdminUsers();
}
/* ---------- Quản lý tài khoản nhân viên (chỉ quản trị) ---------- */
const ROLE_LABEL = { admin: ['Quản trị viên', 'gray'], staff: ['Nhân viên', 'blue'], maintenance: ['Bảo trì', 'amber'] };
async function loadAdminUsers() {
  const box = el('usrRows'); if (!box) return;
  let users = [];
  try { users = await API.adminUsers(); } catch (e) { box.innerHTML = `<tr><td colspan="4" class="muted">${esc(e.message)}</td></tr>`; return; }
  const me = Auth.user.id;
  box.innerHTML = users.map(u => {
    const [rl, rc] = ROLE_LABEL[u.role] || [u.role, 'gray'];
    return `<tr>
      <td><strong>${esc(u.username)}</strong>${u.id === me ? ' <span class="badge amber" style="font-size:10px">Bạn</span>' : ''}</td>
      <td>${esc(u.full_name || '—')}</td>
      <td><span class="badge ${rc}">${rl}</span></td>
      <td class="num"><div class="rowbtns" style="justify-content:flex-end">
        <button class="btn sm" onclick="userForm(${u.id})">Sửa</button>
        <button class="btn sm" onclick="resetUserPwForm(${u.id})">${IC.key} MK</button>
        ${u.id === me ? '' : `<button class="btn sm ghost" title="Xóa" onclick="delUser(${u.id}, '${esc(u.username).replace(/'/g, "\\'")}')">${IC.trash}</button>`}
      </div></td>
    </tr>`;
  }).join('') || '<tr><td colspan="4" class="muted">Chưa có tài khoản.</td></tr>';
  window._usrCache = users;
}
function userForm(id) {
  const u = id ? (window._usrCache || []).find(x => x.id === id) : { username: '', full_name: '', role: 'staff' };
  if (id && !u) return;
  const roleOpt = (v, l) => `<option value="${v}" ${u.role === v ? 'selected' : ''}>${l}</option>`;
  openModal(`
    <div class="mh"><h3>${id ? 'Sửa tài khoản' : 'Thêm nhân viên'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="field"><label>Tên đăng nhập *</label><input id="u_username" value="${esc(u.username)}" ${id ? 'disabled' : ''} placeholder="vd: nhanvien01"></div>
      <div class="field"><label>Họ tên</label><input id="u_full" value="${esc(u.full_name || '')}" placeholder="Nguyễn Văn A"></div>
      <div class="field"><label>Vai trò</label><select id="u_role">${roleOpt('staff', 'Nhân viên — thao tác nghiệp vụ')}${roleOpt('maintenance', 'Bảo trì — xử lý báo hư hỏng')}${roleOpt('admin', 'Quản trị viên — toàn quyền')}</select></div>
      ${id ? '' : `<div class="field"><label>Mật khẩu *</label><input id="u_pass" type="text" placeholder="Tối thiểu 4 ký tự"></div>`}
      ${id === Auth.user.id ? `<div class="hint">${IC.info} Bạn không thể tự hạ quyền chính mình.</div>` : ''}
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn pri" onclick="saveUser(${id || 0})">Lưu</button></div>`);
}
async function saveUser(id) {
  const body = { full_name: el('u_full').value.trim(), role: el('u_role').value };
  if (!id) { body.username = el('u_username').value.trim(); body.password = el('u_pass').value.trim(); }
  await guard(() => id ? API.updateUser(id, body) : API.createUser(body));
  closeModal(); toast(id ? 'Đã cập nhật tài khoản' : 'Đã tạo tài khoản'); loadAdminUsers();
}
function resetUserPwForm(id) {
  const u = (window._usrCache || []).find(x => x.id === id);
  openModal(`
    <div class="mh"><h3>Đặt lại mật khẩu</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <p class="muted" style="margin-top:0">Tài khoản: <strong>${esc(u ? u.username : '')}</strong></p>
      <div class="field"><label>Mật khẩu mới *</label><input id="u_newpass" type="text" placeholder="Tối thiểu 4 ký tự"></div>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn pri" onclick="doResetUserPw(${id})">Đổi mật khẩu</button></div>`);
}
async function doResetUserPw(id) {
  const pw = el('u_newpass').value.trim();
  if (pw.length < 4) return toast('Mật khẩu tối thiểu 4 ký tự', 'err');
  await guard(() => API.resetUserPw(id, pw));
  closeModal(); toast('Đã đổi mật khẩu');
}
async function delUser(id, name) {
  if (!confirm(`Xóa tài khoản "${name}"? Không thể hoàn tác.`)) return;
  await guard(() => API.deleteUser(id));
  toast('Đã xóa tài khoản'); loadAdminUsers();
}
/* Ảnh trang giới thiệu (upload trong Cài đặt) */
function uploadIntroMedia(key, input) {
  const f = input.files[0]; if (!f) return;
  if (f.size > 6 * 1024 * 1024) { input.value = ''; return toast('Ảnh quá lớn (tối đa 6MB)', 'err'); }
  const r = new FileReader();
  r.onload = async () => {
    try {
      await guard(() => API.uploadMedia(key, r.result));
      toast('Đã cập nhật ảnh'); viewSettings();
    } catch (e) { input.value = ''; }
  };
  r.readAsDataURL(f);
}
async function removeIntroMedia(key) {
  if (!confirm('Xóa ảnh này? Trang giới thiệu sẽ hiện ô mẫu.')) return;
  await guard(() => API.deleteMedia(key)); toast('Đã xóa ảnh'); viewSettings();
}
async function saveIntro() {
  const body = {};
  INTRO_FIELDS.forEach(([k]) => body[k] = el('set_' + k).value);
  await guard(() => API.updateSettings(body));
  await refreshCache(); toast('Đã lưu nội dung trang giới thiệu'); viewSettings();
}
async function saveImgCaptions() {
  const body = {};
  INTRO_MEDIA.forEach(([key]) => { const inp = el('set_imgcap_' + key); if (inp) body['imgcap_' + key] = inp.value; });
  await guard(() => API.updateSettings(body));
  await refreshCache(); toast('Đã lưu nhãn ảnh'); viewSettings();
}
function vtypeForm(id) {
  const t = id ? (ST.vtypes || []).find(x => x.id === id) : { name: '', severity: 'minor', active: true };
  const sevOpt = (v, l) => `<option value="${v}" ${t.severity === v ? 'selected' : ''}>${l}</option>`;
  openModal(`
    <div class="mh"><h3>${id ? 'Sửa loại vi phạm' : 'Thêm loại vi phạm'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="field"><label>Tên loại vi phạm *</label><input id="vt_name" value="${esc(t.name)}" placeholder="VD: Về trễ giờ quy định"></div>
      <div class="grid2">
        <div class="field"><label>Mức độ</label><select id="vt_sev">${sevOpt('minor', 'Nhẹ')}${sevOpt('major', 'Nặng')}${sevOpt('severe', 'Nghiêm trọng')}</select></div>
        ${id ? `<div class="field"><label>Trạng thái</label><select id="vt_active"><option value="1" ${t.active !== false ? 'selected' : ''}>Đang dùng</option><option value="0" ${t.active === false ? 'selected' : ''}>Ẩn</option></select></div>` : ''}
      </div>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn pri" onclick="saveVtype(${id || 0})">Lưu</button></div>`);
  setTimeout(() => el('vt_name').focus(), 50);
}
async function saveVtype(id) {
  const body = { name: el('vt_name').value.trim(), severity: el('vt_sev').value, active: id ? el('vt_active').value === '1' : true };
  if (!body.name) return toast('Nhập tên loại vi phạm', 'err');
  await guard(() => id ? API.updateVType(id, body) : API.createVType(body));
  await refreshCache(); closeModal(); toast('Đã lưu loại vi phạm'); viewSettings();
}
async function delVtype(id) { if (!confirm('Xóa loại vi phạm này?')) return; await guard(() => API.deleteVType(id)); await refreshCache(); toast('Đã xóa'); viewSettings(); }
async function saveMailSettings() {
  const body = {
    school_name: el('set_school_name').value.trim(),
    school_email: el('set_school_email').value.trim(),
    violation_mail_threshold: +el('set_violation_mail_threshold').value || 3,
    smtp_host: el('set_smtp_host').value.trim(),
    smtp_port: el('set_smtp_port').value.trim() || '587',
    smtp_secure: el('set_smtp_secure').value,
    smtp_user: el('set_smtp_user').value.trim(),
    smtp_pass: el('set_smtp_pass').value,
    smtp_from: el('set_smtp_from').value.trim(),
  };
  await guard(() => API.updateSettings(body));
  await refreshCache(); toast('Đã lưu cấu hình email'); viewSettings();
}
async function testSmtpConnection() {
  const btn = el('smtpTestBtn'), out = el('smtpTestResult');
  const body = {
    smtp_host: el('set_smtp_host').value.trim(),
    smtp_port: el('set_smtp_port').value.trim() || '587',
    smtp_secure: el('set_smtp_secure').value,
    smtp_user: el('set_smtp_user').value.trim(),
    smtp_pass: el('set_smtp_pass').value, // để trống -> server dùng mật khẩu đã lưu
  };
  if (btn) { btn.disabled = true; }
  if (out) { out.className = 'muted'; out.style.fontSize = '12.5px'; out.textContent = 'Đang kiểm tra...'; }
  try {
    const r = await API.testSmtp(body);
    if (out) {
      if (r.ok) { out.style.color = 'var(--green)'; out.textContent = '✔ Kết nối SMTP thành công'; }
      else { out.style.color = 'var(--red)'; out.textContent = '✖ ' + (r.reason || 'Không kết nối được'); }
    }
  } catch (e) {
    if (out) { out.style.color = 'var(--red)'; out.textContent = '✖ ' + e.message; }
  } finally { if (btn) btn.disabled = false; }
}
function assetForm(id) {
  const a = id ? ST.assets.find(x => x.id === id) : { name: '', unit: 'Cái', category: 'fixed', quantity: 1, fee: 0, note: '' };
  openModal(`
    <div class="mh"><h3>${id ? 'Sửa tài sản' : 'Thêm tài sản'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="field"><label>Tên tài sản *</label><input id="as_name" value="${esc(a.name)}" placeholder="VD: Remote máy lạnh"></div>
      <div class="grid2">
        <div class="field"><label>Loại</label><select id="as_cat"><option value="person" ${a.category === 'person' ? 'selected' : ''}>Theo người</option><option value="fixed" ${a.category === 'fixed' ? 'selected' : ''}>Cố định trong phòng</option></select></div>
        <div class="field"><label>Đơn vị tính</label><input id="as_unit" value="${esc(a.unit)}" placeholder="Cái / Lần..."></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Số lượng</label><input id="as_qty" type="number" min="0" value="${esc(a.quantity)}"></div>
        <div class="field"><label>Phí bồi hoàn <span class="opt">(đồng)</span></label><input id="as_fee" type="number" min="0" value="${esc(a.fee)}"></div>
      </div>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn pri" onclick="saveAsset(${id || 0})">Lưu</button></div>`);
  setTimeout(() => el('as_name').focus(), 50);
}
async function saveAsset(id) {
  const body = { name: el('as_name').value.trim(), category: el('as_cat').value, unit: el('as_unit').value.trim() || 'Cái', quantity: +el('as_qty').value || 0, fee: +el('as_fee').value || 0 };
  if (!body.name) return toast('Nhập tên tài sản', 'err');
  await guard(() => id ? API.updateAsset(id, body) : API.createAsset(body));
  await refreshCache(); closeModal(); toast('Đã lưu tài sản'); viewSettings();
}
async function delAsset(id) { if (!confirm('Xóa tài sản này?')) return; await guard(() => API.deleteAsset(id)); await refreshCache(); toast('Đã xóa'); viewSettings(); }
async function saveBravo() {
  const keys = ['bravo_fee_type', 'bravo_room', 'bravo_electric', 'bravo_water', 'bravo_service', 'bravo_parking', 'bravo_washing'];
  const body = {}; keys.forEach(k => body[k] = el('set_' + k).value.trim());
  await guard(() => API.updateSettings(body));
  await refreshCache(); toast('Đã lưu mã Bravo'); viewSettings();
}
async function saveSettings() {
  const keys = ['room_fee', 'deposit_fee', 'water_fee', 'electric_unit', 'service_fee', 'washing_fee', 'parking_fee', 'partial_half_min', 'partial_full_min', 'room_price_A', 'room_price_B', 'room_price_C', 'room_price_D'];
  const body = {}; keys.forEach(k => body[k] = +el('set_' + k).value || 0);
  body.legal_female = el('set_legal_female').value.trim() || 'E2';
  body.legal_male = el('set_legal_male').value.trim() || 'S2';
  body.dorm_name = el('set_dorm_name').value.trim() || 'Ký túc xá';
  body.hotline = el('set_hotline').value.trim();
  await guard(() => API.updateSettings(body));
  await refreshCache(); toast('Đã lưu cài đặt'); viewSettings();
}
function facilityForm(id) {
  const f = id ? ST.facilities.find(x => x.id === id) : { name: '', address: '' };
  openModal(`
    <div class="mh"><h3>${id ? 'Sửa cơ sở' : 'Thêm cơ sở'}</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="field"><label>Tên cơ sở *</label><input id="fc_name" value="${esc(f.name)}" placeholder="VD: Cơ sở 2"></div>
      <div class="field"><label>Địa chỉ</label><input id="fc_addr" value="${esc(f.address || '')}"></div>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn pri" onclick="saveFacility(${id || 0})">Lưu</button></div>`);
  setTimeout(() => el('fc_name').focus(), 50);
}
async function saveFacility(id) {
  const body = { name: el('fc_name').value.trim(), address: el('fc_addr').value.trim() };
  if (!body.name) return toast('Nhập tên cơ sở', 'err');
  await guard(() => id ? API.updateFacility(id, body) : API.createFacility(body));
  await refreshCache(); closeModal(); toast('Đã lưu cơ sở'); viewSettings();
}
async function delFacility(id) { if (!confirm('Xóa cơ sở này?')) return; await guard(() => API.deleteFacility(id)); await refreshCache(); toast('Đã xóa'); viewSettings(); }

/* ---------- ĐỔI MẬT KHẨU ---------- */
function changePwd() {
  openModal(`
    <div class="mh"><h3>${IC.key} Đổi mật khẩu</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="field"><label>Mật khẩu hiện tại</label><input id="cp_old" type="password"></div>
      <div class="field"><label>Mật khẩu mới</label><input id="cp_new" type="password"></div>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn pri" onclick="doChangePwd()">Đổi mật khẩu</button></div>`);
}
async function doChangePwd() {
  await guard(() => API.changePassword(el('cp_old').value, el('cp_new').value));
  closeModal(); toast('Đã đổi mật khẩu');
}

/* ================================================================= */
/* ==============          CỔNG HỌC VIÊN            ================= */
/* ================================================================= */
async function renderStudent() {
  el('app').innerHTML = `
    <div class="app"><div class="main" style="margin:0 auto;max-width:760px;width:100%">
      <div class="top">
        <div><h1>${IC.home} Ký túc xá của tôi</h1><div class="sub">Xin chào, ${esc(Auth.user.full_name || Auth.user.username)}</div></div>
        <div class="toolbar"><button class="btn sm" onclick="changePwd()">${IC.key} Đổi mật khẩu</button><button class="btn sm" onclick="Auth.logout()">${IC.undo} Đăng xuất</button></div>
      </div>
      <div class="content" id="content"><div class="spinner"></div></div>
    </div></div>`;
  startTableResize();
  loadStudentPortal();
}
async function loadStudentPortal() {
  let profile, invs, damage, coutReqs, myVios = [];
  try { [profile, invs, damage, coutReqs, myVios] = await Promise.all([API.meProfile(), API.meInvoices(), API.meDamage(), API.meCheckoutReq(), API.meViolations().catch(() => [])]); }
  catch (e) { el('content').innerHTML = `<div class="hint">${IC.alert} ${esc(e.message)}</div>`; return; }
  const billNow = invs.filter(i => i.month === curMonth()).reduce((a, i) => a + (+i.total || 0), 0);
  const depTxt = { held: 'Đang giữ', refunded: 'Đã hoàn', forfeited: 'Không hoàn', none: '—' }[profile.deposit_status] || '—';
  const pendingCout = coutReqs.find(c => c.status === 'pending');
  el('content').innerHTML = `
    <div class="cards">
      <div class="stat"><div class="l">${IC.doorOpen} Phòng của tôi</div><div class="v sm">${esc(profile.room_name || 'Chưa xếp')}</div></div>
      <div class="stat"><div class="l">${IC.receipt} Phiếu tháng này</div><div class="v sm">${money(billNow)}</div></div>
      <div class="stat"><div class="l">${IC.lock} Cọc</div><div class="v sm">${depTxt}</div></div>
    </div>
    <div class="panel"><div class="hd"><h2>${IC.user} Thông tin của tôi</h2></div><div class="pad">
      <p><strong>Họ tên:</strong> ${esc(profile.name)} · <span class="badge ${profile.gender === 'female' ? 'red' : 'blue'}">${genderLabel(profile.gender)}</span></p>
      <p><strong>Mã HV:</strong> ${esc(profile.code || '—')} &nbsp;•&nbsp; <strong>Lớp:</strong> ${esc(profile.class_name || '—')} &nbsp;•&nbsp; <strong>SĐT:</strong> ${esc(profile.phone || '—')}</p>
      <p><strong>Ngày vào:</strong> ${fmtDate(profile.check_in_date)} ${profile.check_out_date ? `&nbsp;•&nbsp; <strong>Ngày trả:</strong> ${fmtDate(profile.check_out_date)}` : ''}</p>
    </div></div>

    ${myVios.length ? `<div class="panel"><div class="hd"><h2>${IC.alert} Nhắc nhở / Vi phạm (${myVios.length})</h2></div><div class="table-wrap">
      <table><thead><tr><th>Ngày</th><th>Nội dung</th><th>Mức độ</th><th class="num">Lần</th></tr></thead><tbody>
        ${myVios.map(v => `<tr><td>${fmtDate(v.date)}</td><td><strong>${esc(v.type_name)}</strong>${v.note ? `<div class="muted" style="font-size:12px">${esc(v.note)}</div>` : ''}</td><td>${vioSevBadge(v.severity)}</td><td class="num">${v.level}</td></tr>`).join('')}
      </tbody></table>
      <div class="pad muted" style="font-size:12.5px">${IC.info} Vui lòng tuân thủ nội quy ký túc xá. Vi phạm nhiều lần sẽ được thông báo về nhà trường.</div>
    </div></div>` : ''}

    <div class="panel"><div class="hd"><h2>${IC.receipt} Phiếu báo tiền phòng</h2></div><div class="table-wrap">
      ${invs.length ? `<table><thead><tr><th>Kỳ</th><th class="num">Phòng</th><th class="num">Điện</th><th class="num">Khác</th><th class="num">Tổng</th></tr></thead><tbody>
        ${invs.map(i => `<tr><td>${monthLabel(i.month)}</td><td class="num">${money(i.room_charge)}</td><td class="num">${money(i.electric_charge)}</td><td class="num">${money((+i.water_charge) + (+i.service_charge) + (+i.washing_charge) + (+i.parking_charge))}</td><td class="num"><strong>${money(i.total)}</strong></td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">Chưa có phiếu báo.</div>'}
      <div class="pad muted" style="font-size:12.5px">${IC.creditCard} Đóng tiền qua mã QR quản lý gửi trên Zalo theo hạn hằng tháng.</div>
    </div></div>

    <div class="panel"><div class="hd"><h2>${IC.handCoins} Hỗ trợ học viên</h2><button class="btn sm pri" onclick="damageForm()">${IC.plus} Gửi yêu cầu hỗ trợ</button></div><div class="table-wrap">
      ${damage.length ? `<table><thead><tr><th>Ngày</th><th>Loại</th><th>Nội dung</th><th>Trạng thái</th></tr></thead><tbody>
        ${damage.map(d => `<tr><td>${fmtDate(String(d.created_at).slice(0, 10))}</td><td>${supCatBadge(d.category)}</td><td><strong>${esc(d.title)}</strong>${d.description ? `<div class="muted" style="font-size:12px">${esc(d.description)}</div>` : ''}${d.admin_note ? `<div style="font-size:12px;color:${d.status === 'blocked' ? 'var(--red-ink)' : 'var(--green)'}">${d.status === 'blocked' ? 'Lý do' : 'Phản hồi'}: ${esc(d.admin_note)}</div>` : ''}</td><td>${d.status === 'done' ? '<span class="badge green">Đã xử lý</span>' : d.status === 'blocked' ? '<span class="badge red">Chưa xử lý được</span>' : d.status === 'processing' ? '<span class="badge blue">Đang xử lý</span>' : '<span class="badge amber">Mới</span>'}</td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">Chưa có yêu cầu nào.</div>'}
    </div></div>

    <div class="panel"><div class="hd"><h2>${IC.logOut} Đăng ký trả phòng</h2>${!pendingCout && profile.status === 'in' ? '<button class="btn sm danger" onclick="checkoutReqForm()">Xin trả phòng</button>' : ''}</div><div class="pad">
      ${pendingCout ? `<div class="hint">${IC.hourglass} Bạn đã gửi đơn trả phòng ngày <strong>${fmtDate(pendingCout.desired_date)}</strong> — đang chờ quản lý duyệt.</div>` :
      profile.status !== 'in' ? '<p class="muted" style="margin:0">Bạn đã trả phòng.</p>' :
      `<p class="muted" style="margin:0">Cần báo trước 1 tháng để được hoàn cọc (trừ trường hợp xuất cảnh đột xuất).</p>`}
      ${coutReqs.filter(c => c.status !== 'pending').length ? `<div class="table-wrap" style="margin-top:10px"><table><thead><tr><th>Ngày gửi</th><th>Ngày muốn trả</th><th>Trạng thái</th></tr></thead><tbody>
        ${coutReqs.filter(c => c.status !== 'pending').map(c => `<tr><td>${fmtDate(String(c.created_at).slice(0, 10))}</td><td>${fmtDate(c.desired_date)}</td><td>${c.status === 'done' ? '<span class="badge green">Đã duyệt</span>' : '<span class="badge gray">Từ chối</span>'}</td></tr>`).join('')}
      </tbody></table></div>` : ''}
    </div></div>`;
}
function damageForm() {
  openModal(`
    <div class="mh"><h3>${IC.handCoins} Gửi yêu cầu hỗ trợ</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="field"><label>Loại yêu cầu *</label><select id="dm_cat" onchange="dmCatHint()">
        <option value="damage">Báo hư hỏng trong phòng</option>
        <option value="violation">Báo cáo vi phạm</option>
        <option value="other">Khác (cần hỗ trợ trong quá trình ở)</option>
      </select></div>
      <div class="field"><label>Nội dung *</label><input id="dm_title" placeholder="Nêu ngắn gọn nội dung..."></div>
      <div class="field"><label>Mô tả chi tiết</label><textarea id="dm_desc" rows="3" placeholder="Mô tả thêm nếu cần..."></textarea></div>
      <div class="hint" id="dmHint" style="font-size:12px">${IC.info} Báo hư hỏng thiết bị/cơ sở vật chất trong phòng để quản lý sửa chữa.</div>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn pri" onclick="submitDamage()">Gửi yêu cầu</button></div>`);
  setTimeout(() => el('dm_title').focus(), 50);
}
function dmCatHint() {
  const c = el('dm_cat').value, h = el('dmHint');
  const t = { damage: 'Báo hư hỏng thiết bị/cơ sở vật chất trong phòng để quản lý sửa chữa.',
    violation: 'Phản ánh vi phạm nội quy (ồn ào, mất vệ sinh, người lạ...) để quản lý xử lý.',
    other: 'Nội dung khác cần hỗ trợ trong quá trình ở — điền rõ ở ô Nội dung.' };
  if (h) h.innerHTML = `${IC.info} ${t[c] || t.damage}`;
  el('dm_title').placeholder = c === 'other' ? 'Bạn cần hỗ trợ việc gì?' : (c === 'violation' ? 'Vi phạm gì? Ai/phòng nào?' : 'Hư hỏng gì?');
}
async function submitDamage() {
  const title = el('dm_title').value.trim(); if (!title) return toast('Nhập nội dung yêu cầu', 'err');
  await guard(() => API.createMeDamage({ category: el('dm_cat').value, title, description: el('dm_desc').value.trim() }));
  closeModal(); toast('Đã gửi yêu cầu hỗ trợ'); loadStudentPortal();
}
function checkoutReqForm() {
  openModal(`
    <div class="mh"><h3>${IC.logOut} Đăng ký trả phòng</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb">
      <div class="field"><label>Ngày dự kiến trả phòng</label><input id="co_date" type="date" value="${today()}"></div>
      <div class="field"><label>Lý do</label><select id="co_reason">
        ${CHECKOUT_REASONS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
      </select></div>
      <div class="field"><label>Ghi chú</label><textarea id="co_note" rows="2"></textarea></div>
      <div class="hint">${IC.info} Đơn sẽ được gửi tới quản lý để duyệt. Cần báo trước 1 tháng để được hoàn cọc.</div>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn danger" onclick="submitCheckoutReq()">Gửi đơn</button></div>`);
}
async function submitCheckoutReq() {
  await guard(() => API.createMeCheckoutReq({ desired_date: el('co_date').value, reason: el('co_reason').value, note: el('co_note').value.trim() }));
  closeModal(); toast('Đã gửi đơn trả phòng'); loadStudentPortal();
}

/* ================================================================= */
/* ==============          CỔNG BẢO TRÌ             ================= */
/* ================================================================= */
async function renderMaintenance() {
  el('app').innerHTML = `
    <div class="app"><div class="main" style="margin:0 auto;max-width:940px;width:100%">
      <div class="top">
        <div><h1>${IC.wrench} Bảo trì ký túc xá</h1><div class="sub">Xin chào, ${esc(Auth.user.full_name || Auth.user.username)}</div></div>
        <div class="toolbar"><button class="btn sm" onclick="loadMaintenance()">${IC.refresh} Tải lại</button><button class="btn sm" onclick="changePwd()">${IC.key} Đổi mật khẩu</button><button class="btn sm" onclick="Auth.logout()">${IC.undo} Đăng xuất</button></div>
      </div>
      <div class="content" id="content"><div class="spinner"></div></div>
    </div></div>`;
  startTableResize();
  loadMaintenance();
}
async function loadMaintenance() {
  let tasks = [];
  try { tasks = await API.maintenanceTasks(); }
  catch (e) { el('content').innerHTML = `<div class="hint">${IC.alert} ${esc(e.message)}</div>`; return; }
  const pending = tasks.filter(t => t.status !== 'done');
  const done = tasks.filter(t => t.status === 'done');
  el('content').innerHTML = `
    <div class="cards">
      <div class="stat"><div class="l">${IC.bell} Cần xử lý</div><div class="v sm" style="color:${pending.length ? 'var(--red)' : 'var(--green)'}">${pending.length}</div></div>
      <div class="stat"><div class="l">${IC.checkCircle} Đã hoàn thành</div><div class="v sm">${done.length}</div></div>
    </div>
    ${pending.length ? `<div class="hint" style="border-color:var(--amber-ink)">${IC.bell} Bạn có <strong>${pending.length}</strong> công việc bảo trì cần xử lý.</div>` : `<div class="hint">${IC.checkCircle} Không có công việc nào đang chờ.</div>`}
    <div class="panel"><div class="hd"><h2>${IC.wrench} Công việc cần xử lý</h2></div><div class="table-wrap">
      ${pending.length ? `<table><thead><tr><th>Chuyển lúc</th><th>Phòng</th><th>Nội dung</th><th>Người báo</th><th>Trạng thái</th><th></th></tr></thead><tbody>
        ${pending.map(t => `<tr>
          <td>${fmtDate(String(t.assigned_at).slice(0, 10))}</td>
          <td><strong>${esc(t.room_name || '—')}</strong></td>
          <td><strong>${esc(t.title)}</strong>${t.description ? `<div class="muted" style="font-size:12px">${esc(t.description)}</div>` : ''}</td>
          <td>${esc(t.student_name || '—')}${t.student_phone ? `<div class="muted" style="font-size:11px">${esc(t.student_phone)}</div>` : ''}</td>
          <td>${t.status === 'blocked' ? `<span class="badge red">Chưa xử lý được</span>${t.admin_note ? `<div style="font-size:11px;color:var(--red-ink)">Lý do: ${esc(t.admin_note)}</div>` : ''}`
            : t.status === 'processing' ? '<span class="badge blue">Đang xử lý</span>' : '<span class="badge amber">Mới nhận</span>'}</td>
          <td class="num"><div class="rowbtns" style="justify-content:flex-end;flex-wrap:wrap;gap:4px">
            ${t.status !== 'processing' ? `<button class="btn sm" onclick="maintDo(${t.id},'processing')">Bắt đầu xử lý</button>` : ''}
            <button class="btn sm danger" onclick="maintBlockForm(${t.id})">${IC.alert} Chưa xử lý được</button>
            <button class="btn sm green" onclick="maintDoneForm(${t.id})">${IC.check} Đã xử lý xong</button>
          </div></td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">Không có công việc cần xử lý.</div>'}
    </div></div>
    ${done.length ? `<div class="panel"><div class="hd"><h2>${IC.history} Đã hoàn thành (${done.length})</h2></div><div class="table-wrap">
      <table><thead><tr><th>Xong lúc</th><th>Phòng</th><th>Nội dung</th><th>Ghi chú bảo trì</th></tr></thead><tbody>
        ${done.map(t => `<tr><td>${fmtDate(String(t.resolved_at || t.assigned_at).slice(0, 10))}</td><td>${esc(t.room_name || '—')}</td><td>${esc(t.title)}</td><td class="muted">${esc(t.admin_note || '—')}</td></tr>`).join('')}
      </tbody></table></div></div>` : ''}`;
}
async function maintDo(id, status) { await guard(() => API.maintenanceTaskStatus(id, status)); toast('Đã cập nhật'); loadMaintenance(); }
function maintDoneForm(id) {
  openModal(`
    <div class="mh"><h3>${IC.check} Hoàn thành công việc</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb"><div class="field"><label>Ghi chú bảo trì (đã làm gì)</label><textarea id="mt_note" rows="3" placeholder="VD: Đã thay vòi nước mới, kiểm tra lại..."></textarea></div></div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn pri" onclick="submitMaintDone(${id})">Xác nhận đã xong</button></div>`);
}
async function submitMaintDone(id) {
  await guard(() => API.maintenanceTaskStatus(id, 'done', el('mt_note').value.trim()));
  closeModal(); toast('Đã hoàn thành công việc'); loadMaintenance();
}
function maintBlockForm(id) {
  openModal(`
    <div class="mh"><h3>${IC.alert} Chưa xử lý được</h3><button class="x" onclick="closeModal()">×</button></div>
    <div class="mb"><div class="field"><label>Lý do chưa xử lý được *</label>
      <textarea id="mt_reason" rows="3" placeholder="VD: Cần thay linh kiện, đang đặt hàng · Ngoài khả năng, cần thợ ngoài · Chờ học viên có mặt..."></textarea></div>
      <div class="hint" style="font-size:12px">${IC.info} Công việc vẫn nằm trong danh sách "Cần xử lý"; quản lý & học viên sẽ thấy lý do này.</div>
    </div>
    <div class="mf"><button class="btn" onclick="closeModal()">Hủy</button><button class="btn danger" onclick="submitMaintBlock(${id})">Lưu lý do</button></div>`);
  setTimeout(() => el('mt_reason').focus(), 50);
}
async function submitMaintBlock(id) {
  const reason = el('mt_reason').value.trim(); if (!reason) return toast('Nhập lý do chưa xử lý được', 'err');
  await guard(() => API.maintenanceTaskStatus(id, 'blocked', reason));
  closeModal(); toast('Đã ghi nhận lý do'); loadMaintenance();
}

/* ================= LỊCH CHỌN NGÀY (tiếng Việt, chỉ chọn) ================= */
const VN_DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
function fmtDMY(iso) { if (!iso) return ''; const p = iso.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }
// Gắn bộ chọn ngày cho 1 ô input: readonly, giá trị ISO lưu ở dataset.iso, hiển thị dd/mm/yyyy
function attachDate(input, iso) {
  if (!input) return;
  input.readOnly = true;
  input.dataset.iso = (iso || '').slice(0, 10);
  input.value = fmtDMY(input.dataset.iso);
  input.placeholder = 'Chọn ngày';
  input.classList.add('date-in');
  input.onclick = () => openCalendar(input);
  input.onfocus = () => openCalendar(input);
}
let _calEl = null;
function closeCalendar() { if (_calEl) { _calEl.remove(); _calEl = null; document.removeEventListener('mousedown', _calOutside, true); } }
function _calOutside(e) { if (_calEl && !_calEl.contains(e.target) && e.target !== _calEl._input) closeCalendar(); }
function openCalendar(input) {
  closeCalendar();
  const base = input.dataset.iso ? new Date(input.dataset.iso + 'T00:00:00') : new Date();
  let view = new Date(base.getFullYear(), base.getMonth(), 1);
  const cal = document.createElement('div'); cal.className = 'cal-pop'; cal._input = input;
  const pick = ds => { input.dataset.iso = ds; input.value = fmtDMY(ds); closeCalendar(); input.dispatchEvent(new Event('change')); };
  const render = () => {
    const y = view.getFullYear(), m = view.getMonth();
    const start = (new Date(y, m, 1).getDay() + 6) % 7; // Thứ 2 = 0
    const days = new Date(y, m + 1, 0).getDate();
    const sel = input.dataset.iso;
    const nowY = new Date().getFullYear();
    let cells = '';
    for (let i = 0; i < start; i++) cells += '<span class="cal-d empty"></span>';
    for (let d = 1; d <= days; d++) {
      const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells += `<span class="cal-d${ds === sel ? ' sel' : ''}" data-d="${ds}">${d}</span>`;
    }
    cal.innerHTML = `
      <div class="cal-hd">
        <button type="button" class="cal-nav" data-nav="-1">‹</button>
        <div class="cal-title">
          <select class="cal-m">${Array.from({ length: 12 }, (_, i) => `<option value="${i}" ${i === m ? 'selected' : ''}>Tháng ${i + 1}</option>`).join('')}</select>
          <select class="cal-y">${Array.from({ length: 100 }, (_, i) => { const yy = nowY + 5 - i; return `<option value="${yy}" ${yy === y ? 'selected' : ''}>${yy}</option>`; }).join('')}</select>
        </div>
        <button type="button" class="cal-nav" data-nav="1">›</button>
      </div>
      <div class="cal-dow">${VN_DOW.map(w => `<span>${w}</span>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
      <div class="cal-ft"><button type="button" class="btn sm" data-today>Hôm nay</button><button type="button" class="btn sm ghost" data-clear>Xóa</button></div>`;
    cal.querySelectorAll('[data-d]').forEach(e => e.onclick = () => pick(e.dataset.d));
    cal.querySelector('[data-nav="-1"]').onclick = () => { view = new Date(y, m - 1, 1); render(); };
    cal.querySelector('[data-nav="1"]').onclick = () => { view = new Date(y, m + 1, 1); render(); };
    cal.querySelector('.cal-m').onchange = e => { view = new Date(y, +e.target.value, 1); render(); };
    cal.querySelector('.cal-y').onchange = e => { view = new Date(+e.target.value, m, 1); render(); };
    cal.querySelector('[data-today]').onclick = () => { const t = new Date(); pick(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`); };
    cal.querySelector('[data-clear]').onclick = () => pick('');
  };
  document.body.appendChild(cal);
  const r = input.getBoundingClientRect();
  cal.style.left = Math.min(r.left, window.innerWidth - 300) + 'px';
  cal.style.top = (r.bottom + 6) + 'px';
  render();
  _calEl = cal;
  setTimeout(() => document.addEventListener('mousedown', _calOutside, true), 0);
}

/* ================= KÉO GIÃN CỘT BẢNG ================= */
function _rzKey(table) {
  const heads = [...table.querySelectorAll('thead th')].map(th => (th.dataset.h || th.textContent).trim()).join('|');
  return 'rzw:' + (ST.view || location.pathname) + ':' + heads.slice(0, 140);
}
function _rzFreeze(table) {
  // Đóng băng độ rộng cột hiện tại -> chuyển sang table-layout:fixed (chỉ khi bắt đầu kéo)
  if (table.classList.contains('rz-fixed')) return;
  const ths = [...table.tHead.rows[0].cells];
  const widths = ths.map(th => th.getBoundingClientRect().width);
  ths.forEach((th, i) => { th.style.width = Math.max(56, Math.round(widths[i])) + 'px'; });
  table.classList.add('rz-fixed');
}
function _rzApplySaved(table) {
  let saved; try { saved = JSON.parse(localStorage.getItem(_rzKey(table)) || 'null'); } catch {}
  const ths = table.querySelectorAll('thead th');
  if (!saved || saved.length !== ths.length) return false;
  ths.forEach((th, i) => { th.style.width = saved[i] + 'px'; });
  table.classList.add('rz-fixed');
  return true;
}
function _rzSave(table) {
  const w = [...table.querySelectorAll('thead th')].map(th => Math.round(th.getBoundingClientRect().width));
  try { localStorage.setItem(_rzKey(table), JSON.stringify(w)); } catch {}
}
function setupResizable(table) {
  if (table.dataset.rz || !table.tHead || !table.tHead.rows.length) return;
  const ths = [...table.tHead.rows[0].cells];
  if (ths.length < 2) return;
  table.dataset.rz = '1'; table.classList.add('rz');
  ths.forEach(th => { if (!th.dataset.h) th.dataset.h = (th.textContent.trim() || th.className || 'c'); });
  _rzApplySaved(table); // Áp độ rộng đã lưu (nếu có); nếu chưa thì giữ mặc định 1 dòng
  ths.forEach((th, i) => {
    if (i === ths.length - 1) return; // cột cuối không cần tay cầm
    const h = document.createElement('span');
    h.className = 'rz-handle'; h.title = 'Kéo để chỉnh độ rộng cột · nhấp đúp để reset';
    h.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      _rzFreeze(table); // chỉ đóng băng khi bắt đầu kéo
      const startX = e.pageX, startW = th.getBoundingClientRect().width;
      document.body.classList.add('rz-active');
      const move = ev => { th.style.width = Math.max(56, startW + (ev.pageX - startX)) + 'px'; };
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        document.body.classList.remove('rz-active'); _rzSave(table);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
    // Nhấp đúp: xóa độ rộng đã lưu, trở về mặc định (1 dòng)
    h.addEventListener('dblclick', e => {
      e.preventDefault(); e.stopPropagation();
      table.querySelectorAll('thead th').forEach(t => t.style.width = '');
      table.classList.remove('rz-fixed');
      try { localStorage.removeItem(_rzKey(table)); } catch {}
    });
    th.appendChild(h);
  });
}
let _rzObs;
function startTableResize() {
  const scan = r => { if (r && r.querySelectorAll) r.querySelectorAll('.table-wrap table').forEach(setupResizable); };
  if (!_rzObs) {
    _rzObs = new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      if (n.tagName === 'TABLE' && n.closest('.table-wrap')) setupResizable(n); else scan(n);
    })));
  } else _rzObs.disconnect();
  ['content', 'modal'].forEach(id => { const e = el(id); if (e) { _rzObs.observe(e, { childList: true, subtree: true }); scan(e); } });
}

/* ================= KHỞI ĐỘNG ================= */
boot();
