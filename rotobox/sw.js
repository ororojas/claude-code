// Rotobox offline support. Keeps the app, its icons, its fonts and the video library it loads from
// a CDN, so a hosted or installed copy opens and works without a connection. Your animations live
// in IndexedDB, not here.
const CACHE = 'rotobox-1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=DM+Mono:wght@400;500&family=Instrument+Sans:wght@400..700&display=swap';
const LIBS = ['https://cdn.jsdelivr.net/npm/mediabunny@1.61.1/dist/bundles/mediabunny.min.mjs', FONT_CSS];
const CDN = new Set(['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com']);
const cors = (url) => new Request(url, { mode: 'cors', credentials: 'omit' });

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    // Good to have offline, but a failed download here shouldn't stop the install.
    await Promise.allSettled(LIBS.map((u) => cache.add(cors(u))));
    const css = await cache.match(FONT_CSS, { ignoreVary: true });
    if (css) {
      const files = [...(await css.text()).matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)\s]+)\)/g)].map((m) => m[1]);
      await Promise.allSettled(files.map((u) => cache.add(cors(u))));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('rotobox-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) e.respondWith(req.mode === 'navigate' ? page(e) : fresh(e));
  else if (CDN.has(url.hostname)) e.respondWith(kept(e));
});

// The page itself: the network when it answers quickly, so updates arrive, and the saved copy
// when it's offline or slow.
async function page(e) {
  const cache = await caches.open(CACHE);
  const net = fetch(e.request).then((res) => {
    if (res.ok) e.waitUntil(cache.put('./index.html', res.clone()).catch(() => {}));
    return res;
  });
  const saved = await cache.match('./index.html');
  if (!saved) return net;
  const slow = new Promise((resolve) => setTimeout(resolve, 3000, null));
  return (await Promise.race([net.catch(() => null), slow])) || saved;
}

// Icons and the manifest: the saved copy straight away, refreshed in the background.
async function fresh(e) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(e.request, { ignoreSearch: true });
  const net = fetch(e.request).then((res) => {
    if (res.ok) e.waitUntil(cache.put(e.request, res.clone()).catch(() => {}));
    return res;
  });
  if (!saved) return net;
  e.waitUntil(net.catch(() => {}));
  return saved;
}

// Pinned library versions and font files never change, so a saved copy always wins.
async function kept(e) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(e.request, { ignoreVary: true });
  if (saved) return saved;
  const res = await fetch(e.request);
  if (res.ok && res.type !== 'opaque') e.waitUntil(cache.put(e.request, res.clone()).catch(() => {}));
  return res;
}
