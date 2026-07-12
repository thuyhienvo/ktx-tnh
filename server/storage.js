// ===== Lưu ảnh trên Supabase Storage (S3) =====
// CCCD -> bucket riêng tư (đọc bằng link ký hạn); ảnh giới thiệu -> bucket công khai.
// Nếu chưa cấu hình SUPABASE_URL/SERVICE_KEY thì enabled=false (route sẽ fallback / báo lỗi rõ ràng).

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const CCCD_BUCKET = process.env.SUPABASE_CCCD_BUCKET || 'cccd';
const INTRO_BUCKET = process.env.SUPABASE_INTRO_BUCKET || 'intro';

const enabled = !!(SUPABASE_URL && SERVICE_KEY);

function parseDataUrl(dataUrl) {
  const m = /^data:(image\/[\w.+-]+);base64,(.+)$/s.exec(dataUrl || '');
  if (!m) return null;
  const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[m[1]] || 'bin';
  return { contentType: m[1], ext, buffer: Buffer.from(m[2], 'base64') };
}

function headers(extra = {}) {
  return { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, ...extra };
}

// Tải ảnh (data URL) lên bucket, ghi đè nếu đã tồn tại. Trả về path đã lưu.
async function uploadDataUrl(bucket, path, dataUrl) {
  const p = parseDataUrl(dataUrl);
  if (!p) throw new Error('Ảnh không hợp lệ (không phải data URL base64)');
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURI(path)}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': p.contentType, 'x-upsert': 'true', 'cache-control': '3600' }),
    body: p.buffer,
  });
  if (!res.ok) throw new Error(`Upload Storage lỗi ${res.status}: ${await res.text()}`);
  return path;
}

// Link ký hạn để xem ảnh ở bucket riêng tư (mặc định 1 giờ)
async function signedUrl(bucket, path, expiresIn = 3600) {
  if (!path) return null;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${encodeURI(path)}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  return j.signedURL ? SUPABASE_URL + '/storage/v1' + j.signedURL : null;
}

// URL công khai (bucket public)
function publicUrl(bucket, path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURI(path)}`;
}

async function remove(bucket, paths) {
  const list = Array.isArray(paths) ? paths : [paths];
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
    method: 'DELETE',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prefixes: list }),
  });
  return res.ok;
}

// Thay path CCCD trong 1 bản ghi bằng link ký hạn (để client hiển thị ảnh bucket riêng tư)
const CCCD_FIELDS = ['cccd_front', 'cccd_back', 'cccd_image'];
async function signRowCccd(row, expiresIn = 3600) {
  if (!row) return row;
  for (const f of CCCD_FIELDS) {
    const v = row[f];
    if (v && enabled && !/^data:/.test(v) && !/^https?:/.test(v)) {
      row[f] = (await signedUrl(CCCD_BUCKET, v, expiresIn)) || null;
    }
  }
  return row;
}

module.exports = {
  enabled, CCCD_BUCKET, INTRO_BUCKET, CCCD_FIELDS,
  parseDataUrl, uploadDataUrl, signedUrl, publicUrl, remove, signRowCccd,
};
