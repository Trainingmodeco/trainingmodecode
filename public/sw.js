// Training Mode service worker — offline app shell + runtime asset caching.
//
// Update model (safe): the cache name carries a build id stamped at build
// time by scripts/copy-public-assets.mjs, so every deploy ships a byte-new
// sw.js and the browser installs it. The new worker does NOT call
// skipWaiting — it stays waiting until the app is fully closed, so a running
// session is never disturbed; the update activates cleanly on next launch
// and old caches are deleted then.
const BUILD_ID = '__TM_BUILD_ID__'; // literal in dev; replaced per build
const CACHE = 'tm-cache-' + (BUILD_ID.indexOf('__') === 0 ? 'dev' : BUILD_ID);
const SHELL = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Expo writes content-hashed bundle files — immutable, safe to cache forever.
function isImmutable(url) {
  return url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/index.html', copy)); return res; })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  // Hashed bundle assets: cache-first (immutable).
  if (isImmutable(url)) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached)),
    );
    return;
  }

  // Everything else (art at stable paths like /static/…): stale-while-
  // revalidate — serve the cached copy instantly, refresh it in the
  // background so same-path image swaps propagate without a version bump
  // or manual cache clear.
  event.respondWith(
    caches.open(CACHE).then((c) =>
      c.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok && res.type === 'basic') c.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    ),
  );
});
