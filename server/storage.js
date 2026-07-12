// ===== Object storage (S3) — MỘT client duy nhất cho mọi môi trường =====
// local dev -> MinIO;  staging/UAT/prod -> Supabase Storage / AWS S3.
// Chỉ khác endpoint + credentials qua ENV; KHÔNG rẽ nhánh framework theo môi trường.
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Fail-fast: bắt buộc cấu hình S3 ở MỌI môi trường (không có fallback base64/đĩa)
const NEED = ['S3_ENDPOINT', 'S3_REGION', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_CCCD_BUCKET', 'S3_INTRO_BUCKET'];
const missing = NEED.filter(k => !process.env[k]);
if (missing.length) {
  throw new Error('Thiếu cấu hình object storage (S3): ' + missing.join(', ') +
    '. Local: chạy "docker compose up -d" (MinIO) rồi điền S3_* trong .env.');
}

const CCCD_BUCKET = process.env.S3_CCCD_BUCKET;
const INTRO_BUCKET = process.env.S3_INTRO_BUCKET;

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY },
  forcePathStyle: true, // MinIO & Supabase Storage đều dùng path-style
});

// CHỈ chấp nhận ảnh raster an toàn. KHÔNG nhận SVG (có thể chứa <script> -> XSS khi proxy).
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

function parseDataUrl(dataUrl) {
  const m = /^data:(image\/[\w.+-]+);base64,(.+)$/s.exec(dataUrl || '');
  if (!m) return null;
  const ext = EXT[m[1]];
  if (!ext) return null; // loại type ngoài whitelist (vd svg) -> caller sẽ báo "Ảnh không hợp lệ"
  return { contentType: m[1], ext, buffer: Buffer.from(m[2], 'base64') };
}

async function putBuffer(bucket, key, buffer, contentType) {
  await s3.send(new PutObjectCommand({
    Bucket: bucket, Key: key, Body: buffer, ContentType: contentType, CacheControl: 'public, max-age=3600',
  }));
  return key;
}

async function putDataUrl(bucket, key, dataUrl) {
  const p = parseDataUrl(dataUrl);
  if (!p) { const e = new Error('Ảnh không hợp lệ (chỉ nhận JPG/PNG/WEBP/GIF)'); e.status = 400; throw e; }
  return putBuffer(bucket, key, p.buffer, p.contentType);
}

// Lấy object để stream ra client (proxy). Trả stream + metadata; ném lỗi nếu không có.
async function getObject(bucket, key) {
  const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return { body: r.Body, contentType: r.ContentType, contentLength: r.ContentLength, etag: r.ETag };
}

async function deleteObject(bucket, key) {
  if (!key) return;
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

// Link ký hạn (không dùng cho luồng hiển thị mặc định — app proxy — nhưng để sẵn tiện ích)
async function signedGetUrl(bucket, key, expiresIn = 3600) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
}

module.exports = {
  s3, CCCD_BUCKET, INTRO_BUCKET,
  parseDataUrl, putBuffer, putDataUrl, getObject, deleteObject, signedGetUrl,
};
