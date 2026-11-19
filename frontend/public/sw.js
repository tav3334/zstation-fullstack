const STATIC_CACHE = 'z-station-static-v3';
const PUBLIC_FILES = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(PUBLIC_FILES);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith('z-station-') && name !== STATIC_CACHE)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const isApi = url.pathname === '/api' || url.pathname.startsWith('/api/');

  // Private data always requires a fresh response, including browser HTTP caches.
  if (isApi || request.headers.has('Authorization')) {
    event.respondWith(fetch(request, { cache: 'no-store' }).catch(() => new Response(
      JSON.stringify({ error: 'Mode hors ligne', message: 'Cette fonctionnalité nécessite une connexion internet.' }),
      { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } }
    )));
    return;
  }

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(STATIC_CACHE);
      return await cache.match('/index.html') || Response.error();
    }));
    return;
  }

  // Only Vite's versioned build assets and explicitly public files are cached.
  if (url.pathname.startsWith('/assets/') || PUBLIC_FILES.includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type === 'basic' && !response.headers.get('Cache-Control')?.includes('no-store')) {
        event.waitUntil(cache.put(request, response.clone()));
      }
      return response;
    })());
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});
