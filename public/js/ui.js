// ---- Tiện ích giao diện dùng chung ----
const $ = s => document.querySelector(s);
const el = id => document.getElementById(id);

const esc = s => (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => (Number(n) || 0).toLocaleString('vi-VN');  // số tiền — KHÔNG kèm đơn vị "đ" (bỏ đơn vị toàn app theo yêu cầu)
const moneyN = money;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const curMonth = () => today().slice(0, 7);
function fmtDate(d) { if (!d) return '—'; const p = String(d).slice(0, 10).split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }
function monthLabel(m) { const [y, mm] = m.split('-'); return `Tháng ${mm}/${y}`; }
function initials(name) { const p = (name || '?').trim().split(/\s+/); return ((p[0] || '')[0] || '') + ((p[p.length - 1] || '')[0] || ''); }

function toast(msg, type = 'ok') {
  const t = el('toast');
  t.className = 'toast show ' + type;
  t.innerHTML = (type === 'err' ? IC.alert+' ' : IC.checkCircle+' ') + esc(msg);
  clearTimeout(t._t);
  t._t = setTimeout(() => (t.className = 'toast'), 2800);
}

/* ---- Bảo vệ công sức nhập liệu ----
   Form học viên có ~20 ô. Điền dở rồi lỡ bấm X / Esc / bấm ra nền / đổi menu là MẤT SẠCH,
   phải gõ lại từ đầu — trên điện thoại thì bỏ cuộc luôn.
   Cách làm: chụp lại nội dung form lúc MỞ, so lúc ĐÓNG. Có khác thì mới hỏi.
   Cờ window._dangLuu do chongBam2Lan (app.js) bật trong lúc hàm lưu chạy — nhờ vậy 126 chỗ gọi
   closeModal() sau khi lưu xong KHÔNG bị hỏi nhầm, mà không phải sửa 126 chỗ đó. */
function _chupForm() {
  return [...el('modal').querySelectorAll('input,select,textarea')]
    .map(f => (f.type === 'checkbox' || f.type === 'radio') ? (f.checked ? '1' : '0') : f.value).join('');
}
let _formLucMo = null;
function formDangDo() { return _formLucMo !== null && el('overlay').classList.contains('show') && _chupForm() !== _formLucMo; }

function openModal(html, wide) {
  el('modal').className = 'modal' + (wide ? ' wide' : '');
  el('modal').innerHTML = html;
  el('overlay').classList.add('show');
  _formLucMo = _chupForm();
}
function closeModal() {
  if (!window._dangLuu && formDangDo()
      && !confirm('Bạn có dữ liệu chưa lưu.\n\nĐóng lại và bỏ những gì vừa nhập?')) return;
  closeModalNgay();
}
// Đóng thẳng, không hỏi — dùng khi người dùng ĐÃ đồng ý bỏ (vd đã xác nhận ở adminGo)
function closeModalNgay() { _formLucMo = null; el('overlay').classList.remove('show'); }

el('overlay').addEventListener('click', e => { if (e.target.id === 'overlay') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// Bọc lời gọi API trong try/catch + toast lỗi
async function guard(fn) {
  try { return await fn(); }
  catch (e) { toast(e.message || 'Có lỗi xảy ra', 'err'); throw e; }
}

// Trì hoãn gọi hàm cho tới khi ngừng gõ
function debounce(fn, ms = 180) {
  let t;
  return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
}

// Tìm kiếm tức thì: chỉ ẩn/hiện các hàng <tr data-s="..."> — KHÔNG dựng lại cả bảng
// (mượt, không chớp, không mất con trỏ). countId: id ô hiển thị số kết quả.
function attachRowSearch(input, countId) {
  if (!input) return;
  const panel = input.closest('.panel') || document;
  const run = () => {
    const q = input.value.trim().toLowerCase();
    const rows = panel.querySelectorAll('tbody tr[data-s]');
    let n = 0;
    for (const tr of rows) {
      const show = !q || tr.dataset.s.indexOf(q) !== -1;
      tr.style.display = show ? '' : 'none';
      if (show) n++;
    }
    if (countId) { const c = el(countId); if (c) c.textContent = n; }
    const er = panel.querySelector('.no-result');
    if (er) er.style.display = n === 0 ? '' : 'none';
  };
  input.addEventListener('input', run);
  if (input.value) run();
}
