const CACHE_NAME = 'vestot-v1';
const STATIC_ASSETS = ['/', '/css/styles.css', '/js/app.js', '/js/api.js', '/js/auth.js', '/js/calendar.js', '/js/history.js', '/js/settings.js', '/lib/hebrew-date.js', '/favicon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) return; // Don't cache API calls
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
