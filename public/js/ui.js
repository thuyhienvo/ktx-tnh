// ---- Tiện ích giao diện dùng chung ----
const $ = s => document.querySelector(s);
const el = id => document.getElementById(id);

const esc = s => (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => (Number(n) || 0).toLocaleString('vi-VN') + ' đ';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const curMonth = () => today().slice(0, 7);
function fmtDate(d) { if (!d) return '—'; const p = String(d).slice(0, 10).split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }
function monthLabel(m) { const [y, mm] = m.split('-'); return `Tháng ${mm}/${y}`; }
function initials(name) { const p = (name || '?').trim().split(/\s+/); return ((p[0] || '')[0] || '') + ((p[p.length - 1] || '')[0] || ''); }

function toast(msg, type = 'ok') {
  const t = el('toast');
  t.className = 'toast show ' + type;
  t.innerHTML = (type === 'err' ? '⚠️ ' : '✅ ') + esc(msg);
  clearTimeout(t._t);
  t._t = setTimeout(() => (t.className = 'toast'), 2800);
}

function openModal(html, wide) {
  el('modal').className = 'modal' + (wide ? ' wide' : '');
  el('modal').innerHTML = html;
  el('overlay').classList.add('show');
}
function closeModal() { el('overlay').classList.remove('show'); }

el('overlay').addEventListener('click', e => { if (e.target.id === 'overlay') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// Bọc lời gọi API trong try/catch + toast lỗi
async function guard(fn) {
  try { return await fn(); }
  catch (e) { toast(e.message || 'Có lỗi xảy ra', 'err'); throw e; }
}
