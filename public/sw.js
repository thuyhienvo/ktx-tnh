// Service worker: ưu tiên MẠNG cho giao diện (luôn có bản mới nhất khi online),
// dùng cache làm dự phòng khi offline. API luôn lấy trực tiếp từ mạng.
const CACHE = 'ktx-shell-v82';
// Số phiên bản SUY RA TỪ TÊN CACHE — tuyệt đối không ghi tay lần thứ hai.
// Trước đây SHELL ghi cứng '?v=25' trong khi index.html nạp '?v=71': service worker tải sẵn
// nguyên bộ asset cũ 46 phiên bản mà KHÔNG lần nào dùng tới (trang chỉ xin ?v=71) — máy học viên
// tải thừa gần gấp đôi ngay lần mở app đầu tiên. Đúng nhóm dùng điện thoại đời thấp, mạng yếu.
// Lệch được vì số phải sửa tay ở 2 file; sửa index.html rồi quên sw.js là xong.
// tests/unit/version.test.js canh việc này, hỏng là npm test đỏ ngay.
const V = (CACHE.match(/-v(\d+)$/) || [, '1'])[1];
const SHELL = [
  '/', '/index.html',
  `/css/styles.css?v=${V}`,
  `/js/icons.js?v=${V}`, `/js/api.js?v=${V}`, `/js/ui.js?v=${V}`,
  `/js/qrcode.min.js?v=${V}`, `/js/vietqr.js?v=${V}`, `/js/app.js?v=${V}`,
  '/manifest.webmanifest', '/icons/icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return; // API: luôn qua mạng

  // Giao diện: network-first → luôn cập nhật khi online, cache khi offline
  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.status === 200 && url.origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
