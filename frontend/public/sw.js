const CACHE_NAME = 'z-station-v2';
const STATIC_CACHE = 'z-station-static-v2';
const DYNAMIC_CACHE = 'z-station-dynamic-v2';
const API_CACHE = 'z-station-api-v2';

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Installation...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('✅ Cache statique ouvert');
        return cache.addAll(urlsToCache.map(url => {
          return new Request(url, { cache: 'reload' });
        }));
      })
      .catch((error) => {
        console.error('❌ Erreur lors de la mise en cache:', error);
      })
  );
  self.skipWaiting();
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Activation...');
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!currentCaches.includes(cacheName)) {
            console.log('🗑️ Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Helper pour déterminer le type de requête
function isAPIRequest(url) {
  return url.includes('/api/') || url.includes('localhost:8000');
}

function isStaticAsset(url) {
  return url.match(/\.(js|css|png|jpg|jpeg|svg|gif|woff|woff2|ttf|ico)$/);
}

// Interception des requêtes réseau
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Stratégie pour les requêtes API
  if (isAPIRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Mettre en cache seulement les requêtes GET réussies
          if (request.method === 'GET' && response.status === 200) {
            const responseClone = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // En cas d'échec, retourner depuis le cache API
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              console.log('📦 Données API depuis le cache:', url);
              return cachedResponse;
            }
            // Retourner une réponse d'erreur JSON
            return new Response(
              JSON.stringify({
                error: 'Mode hors ligne',
                message: 'Cette fonctionnalité nécessite une connexion internet'
              }),
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
        })
    );
    return;
  }

  // Stratégie Cache-First pour les assets statiques
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((response) => {
          return caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, response.clone());
            return response;
          });
        });
      })
    );
    return;
  }

  // Stratégie Network-First pour le HTML
  event.respondWith(
    fetch(request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(request, responseClone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          return cachedResponse || caches.match('/index.html');
        });
      })
  );
});

// Gestion des messages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
