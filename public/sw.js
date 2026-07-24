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
// Every JS/CSS chunk of THIS build, stamped in at build time. Precached
// atomically at install so a running session can always lazy-load its own
// chunks from its own cache — even after a newer deploy replaced the files
// on the server. This is what prevents mixed-build "Requiring unknown
// module N" crashes. (Placeholder is a literal in dev; filtered out.)
const PRECACHE = ['__TM_PRECACHE__'].filter((p) => p.indexOf('__') === -1 && p.indexOf('/_') === 0);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.concat(PRECACHE))));
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

  // Hashed bundle assets: cache-first (immutable). Never cache an HTML
  // response under a bundle URL — that's the SPA fallback for a missing
  // chunk from an older deploy, and storing it would poison the cache.
  if (isImmutable(url)) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const type = (res && res.headers.get('content-type')) || '';
        if (res && res.ok && res.type === 'basic' && type.indexOf('text/html') === -1) {
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
