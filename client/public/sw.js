/* ==========================================================================
   TravelSync Service Worker — Offline App Shell & Resilient Asset Cache
   ========================================================================== */

const CACHE_NAME = 'travelsync-app-v2';

// 1. Essential application shell assets required to load offline
const ESSENTIAL_ASSETS = [
  '/',
  '/index.html'
];

// 2. Optional visual and manifest assets (precached with graceful failure)
const OPTIONAL_ASSETS = [
  '/manifest.webmanifest',
  '/favicon.ico',
  '/favicon.svg',
  '/logo.png'
];

// 1. Installation: pre-cache application shell with resilient asset handling
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Precaching essential assets
      for (const asset of ESSENTIAL_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.error(`[SW] Error precaching essential app shell asset '${asset}':`, err);
        }
      }

      // Precaching optional static assets resiliently
      const optionalResults = await Promise.allSettled(
        OPTIONAL_ASSETS.map(async (asset) => {
          try {
            await cache.add(asset);
          } catch (err) {
            console.warn(`[SW] Notice: Optional asset '${asset}' could not be precached:`, err);
            throw err;
          }
        })
      );

      const successfulOptional = optionalResults.filter(r => r.status === 'fulfilled').length;
      console.log(`[SW] Shell installation completed. ${successfulOptional}/${OPTIONAL_ASSETS.length} optional assets cached.`);
    })().then(() => self.skipWaiting())
  );
});

// 2. Activation: purge stale caches from previous versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging outdated cache version:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // CRITICAL SECURITY RULE:
  // NEVER cache API requests, Socket.IO polling, or Firebase authentication endpoints in static cache.
  // Sensitive user trip and authentication data is handled securely via IndexedDB
  // with strict per-user authorization scoping.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/socket.io/') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    request.method !== 'GET'
  ) {
    return; // Pass through to network directly without SW caching
  }

  // Navigation requests (HTML pages): Network-first with cache fallback to app shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // If valid response, update shell cache
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          // Network failed (offline) -> serve cached shell so client-side Vue Router takes over
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match('/index.html');
          if (fallback) return fallback;
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>TravelSync — Offline</title></head>' +
            '<body style="font-family:sans-serif;text-align:center;padding:50px;">' +
            '<h2>You are currently offline</h2>' +
            '<p>Your downloaded trips are available under <a href="/offline-trips">Offline Trips</a>.</p>' +
            '</body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // Static assets (CSS, JS, Fonts, Images): Cache-first with network background revalidation
  if (
    url.origin === self.location.origin ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Revalidate in background to keep cache fresh
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          }).catch(() => {});
          return cachedResponse;
        }

        // Not in cache, fetch from network and cache
        return fetch(request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        });
      })
    );
  }
});

// 4. Manual update trigger
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
