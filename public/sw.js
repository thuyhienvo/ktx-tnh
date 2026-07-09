// Service worker: cache vỏ ứng dụng để chạy offline (dữ liệu API luôn lấy mới)
const CACHE = 'ktx-shell-v1';
const SHELL = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/api.js',
  '/js/ui.js',
  '/js/app.js',
  '/manifest.webmanifest',
  '/icons/icon.svg',
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

  // API: luôn ưu tiên mạng (không cache để dữ liệu luôn mới)
  if (url.pathname.startsWith('/api/')) return;

  // Vỏ ứng dụng: cache-first, cập nhật nền
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetched = fetch(e.request).then(res => {
        if (res && res.status === 200 && url.origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
