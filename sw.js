// Sudogku service worker: works offline once installed.
const CACHE = 'sudogku-toby-v11';
const FILES = ['./', 'index.html', 'engine.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'logo.png', 'toby-full.png', 'toby/tile.png', 'toby/tile-head.png', 'toby/face-happy.png', 'toby/face-focused.png', 'toby/face-excited.png', 'toby/face-sorry.png', 'toby/face-cheeky.png', 'toby/act-sniff.png', 'toby/act-hint.png', 'toby/act-complete.png', 'toby/act-oops.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // network first so updates arrive; fall back to the cache when offline (fonts included)
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
