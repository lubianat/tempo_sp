const CACHE_NAME = 'tempo-sp-v3';
const API_CACHE_NAME = 'tempo-sp-api-v1';
const API_MAX_ENTRIES = 3;
const ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME && key !== API_CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
});

async function trimApiCache(cache) {
  const keys = await cache.keys();
  if (keys.length > API_MAX_ENTRIES) {
    await Promise.all(keys.slice(0, keys.length - API_MAX_ENTRIES).map((key) => cache.delete(key)));
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  // Cache INMET API meteogram requests
  if (requestUrl.hostname === 'apiprevmet3.inmet.gov.br') {
    event.respondWith(
      caches.open(API_CACHE_NAME).then(async (cache) => {
        // Cache-first: same date/cycle URL always returns identical data
        const cached = await cache.match(event.request);
        if (cached) return cached;

        try {
          const response = await fetch(event.request);
          if (response.ok) {
            await cache.put(event.request, response.clone());
            await trimApiCache(cache);
          }
          return response;
        } catch (_err) {
          // Offline: return the most recently cached meteogram as fallback
          const keys = await cache.keys();
          if (keys.length > 0) {
            const fallback = await cache.match(keys[keys.length - 1]);
            const headers = new Headers(fallback.headers);
            headers.set('X-Served-From-Cache', 'true');
            return new Response(fallback.body, { status: fallback.status, headers });
          }
          throw new TypeError('Offline e sem meteograma em cache.');
        }
      })
    );
    return;
  }

  // App shell: cache-first for same-origin assets
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
