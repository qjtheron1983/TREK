// TREK Service Worker v6 — pass-through only (no caching to prevent iOS 404s)
// Caching disabled: GitHub Pages handles CDN. Re-enable once domain is stable.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  // Clear ALL old caches from previous versions
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  self.clients.claim();
});
// No fetch handler = browser handles all requests natively
