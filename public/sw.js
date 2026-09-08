const CACHE_NAME = 'vestot-v4';
const STATIC_ASSETS = ['/', '/css/styles.css', '/js/app.js', '/js/api.js', '/js/auth.js', '/js/calendar.js', '/js/history.js', '/js/settings.js', '/js/i18n.js', '/js/hebrew-datepicker.js', '/lib/hebrew-date.js', '/favicon.svg'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) return;
  e.respondWith(
    fetch(e.request).then(response => {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      return response;
    }).catch(() => caches.match(e.request))
  );
});
