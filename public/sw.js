const CACHE_NAME = 'geotelemetry-cache-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Skip caching non-GET requests
  if (event.request.method !== 'GET') return;

  // Normalize request URLs (e.g., skip extensions, chrome-extension:// schemes)
  if (!event.request.url.startsWith(self.location.origin)) {
    // For external APIs like open-meteo, try network first, then return static offline fallback if needed
    if (event.request.url.includes('api.open-meteo') || event.request.url.includes('weather')) {
      event.respondWith(
        fetch(event.request).catch(() => {
          return new Response(JSON.stringify({ 
            current:{ temperature_2m: 18.5, weather_code: 0 },
            daily:{ temperature_2m_max: [22.0], temperature_2m_min: [14.0] }
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
      );
    }
    return;
  }

  // Intercept application files with a Cache-First, Fallback-to-Network, stale-revalidate hybrid approach
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in background to update cache for next time
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {/* Ignore background sync failures when offline */});
        
        return cachedResponse;
      }

      // No cached value, query network
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch((error) => {
        // Offline and not in cache
        console.warn('Network request failed and asset is not cached:', error);
      });
    })
  );
});
