// Service worker: ưu tiên MẠNG cho giao diện (luôn có bản mới nhất khi online),
// dùng cache làm dự phòng khi offline. API luôn lấy trực tiếp từ mạng.
const CACHE = 'ktx-shell-v37';
const SHELL = [
  '/', '/index.html', '/css/styles.css?v=25',
  '/js/icons.js?v=25', '/js/api.js?v=25', '/js/ui.js?v=25', '/js/app.js?v=25',
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
