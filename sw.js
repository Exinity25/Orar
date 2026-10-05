const CACHE = 'orar-v35-profile-google-login';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './student-hub.css', './student-hub.js', './classroom-config.js', './classroom-view.js'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  // Never cache private Google API responses, tokens or profile images.
  if (new URL(event.request.url).origin !== self.location.origin || event.request.headers.has('Authorization')) return;
  event.respondWith(fetch(event.request, {cache:'no-cache'}).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(r => r || caches.match('./index.html'))));
});
