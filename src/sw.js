// Simple service worker: cache shell + background sync for queued requests
const CACHE = 'fouquest-v9-shell-v1';
const SHELL = [
  '/fouquest-suite-v9.0/',
  '/fouquest-suite-v9.0/index.html',
  '/fouquest-suite-v9.0/manifest.json',
  '/fouquest-suite-v9.0/assets/logo.svg',
  '/fouquest-suite-v9.0/src/app.js',
  '/fouquest-suite-v9.0/src/api.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request).then(res=>res || fetch(e.request)));
  }
});
