const CACHE = 'orar-v50-gemini-oauth';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './student-hub.css', './student-hub.js', './classroom-config.js', './classroom-view.js', './student-planner.js', './gemini-view.js', './student-planner.css', './theme-glass.css'];
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

self.addEventListener('notificationclick',event=>{
  event.notification.close();event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{
    const existing=windows.find(client=>client.url.startsWith(self.registration.scope));
    return existing?existing.focus():clients.openWindow(self.registration.scope);
  }));
});
