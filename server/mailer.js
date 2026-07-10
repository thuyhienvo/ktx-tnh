// ===== Gửi email cho nhà trường khi học viên vi phạm nhiều lần =====
// nodemailer nạp động: nếu chưa cài (npm i nodemailer) hoặc chưa cấu hình SMTP,
// hàm trả về { sent:false, reason } thay vì làm sập app.
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (_) { /* chưa cài — bỏ qua */ }

const { getSettings } = require('./db');

const SEV = { minor: 'Nhẹ', major: 'Nặng', severe: 'Nghiêm trọng' };
const fmt = d => { if (!d) return '—'; const p = String(d).slice(0, 10).split('-'); return `${p[2]}/${p[1]}/${p[0]}`; };

function smtpReady(s) {
  return !!(s.smtp_host && s.smtp_user && s.smtp_pass && s.school_email);
}

// Kiểm tra có gửi được không (dùng để hiển thị cảnh báo trên UI)
async function mailStatus() {
  const s = await getSettings();
  if (!nodemailer) return { ready: false, reason: 'Server chưa cài nodemailer (chạy: npm i nodemailer)' };
  if (!smtpReady(s)) return { ready: false, reason: 'Chưa cấu hình SMTP / email nhà trường trong Cài đặt' };
  return { ready: true };
}

// Gửi thông báo vi phạm cho nhà trường
// student: { name, code, class_name, phone }, violations: [{date,type_name,severity,note}]
async function sendViolationMail(student, violations) {
  const s = await getSettings();
  if (!nodemailer) return { sent: false, reason: 'Server chưa cài nodemailer (npm i nodemailer)' };
  if (!smtpReady(s)) return { sent: false, reason: 'Chưa cấu hình SMTP / email nhà trường' };

  const list = (violations || []).map((v, i) =>
    `${i + 1}. ${fmt(v.date)} — ${v.type_name || 'Vi phạm'} [${SEV[v.severity] || v.severity}]${v.note ? ': ' + v.note : ''}`
  ).join('\n');

  const dorm = s.dorm_name || 'Ký túc xá';
  const subject = `[${dorm}] Thông báo vi phạm nội trú — Học viên ${student.name}`;
  const text =
`Kính gửi ${s.school_name || 'Nhà trường'},

Ban quản lý ${dorm} xin thông báo: học viên ${student.name}` +
`${student.code ? ' (MSHV ' + student.code + ')' : ''}${student.class_name ? ', lớp ' + student.class_name : ''}` +
` đã vi phạm nội quy ký túc xá ${violations.length} lần:

${list}

Kính đề nghị Nhà trường phối hợp nhắc nhở, xử lý. Trân trọng cảm ơn.

--
Ban quản lý ${dorm}${s.hotline ? '\nHotline: ' + s.hotline : ''}`;

  const html = text.replace(/\n/g, '<br>');

  try {
    const transporter = nodemailer.createTransport({
      host: s.smtp_host,
      port: +s.smtp_port || 587,
      secure: String(s.smtp_secure) === 'true',
      auth: { user: s.smtp_user, pass: s.smtp_pass },
    });
    await transporter.sendMail({
      from: s.smtp_from || s.smtp_user,
      to: s.school_email,
      subject, text, html,
    });
    return { sent: true, to: s.school_email };
  } catch (e) {
    return { sent: false, reason: 'Lỗi gửi mail: ' + (e.message || e) };
  }
}

module.exports = { sendViolationMail, mailStatus };
