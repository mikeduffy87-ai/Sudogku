// Sudogku service worker: works offline once installed.
const CACHE = 'sudogku-toby-v27';
const FILES = ['./', 'splash/big-dave.webp', 'splash/background.jpg', 'index.html', 'engine.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'logo.webp', 'toby-home.webp', 'toby/tile.png', 'toby/tile-head.png', 'toby/face-happy.png', 'toby/face-focused.png', 'toby/face-excited.png', 'toby/face-sorry.png', 'toby/face-cheeky.png', 'toby/act-sniff.png', 'toby/act-hint.png', 'toby/act-complete.png', 'toby/act-oops.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Our own files: always ask GitHub for the newest copy (skips the phone's ~10-minute HTTP cache),
  // fall back to the saved copy when offline. Other files (fonts): normal network-first.
  const net = url.origin === location.origin
    ? fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' })
    : fetch(e.request);
  e.respondWith(net.then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
