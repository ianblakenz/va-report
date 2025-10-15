// A name for our cache - version incremented to v4 to ensure updates
const CACHE_NAME = 'pwa-cache-v5';

// A list of all the files we want to cache, using relative paths
const FILES_TO_CACHE = [
  '.',
  'index.html',
  'style.css',
  'app.js',
  'manifest.json'
];

// This event fires when the service worker is installed
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching app shell');
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// This event fires when the service worker is activated
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[ServiceWorker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

// ✅ NEW Fetch Handler using Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
  // Ignore non-GET requests (like the POST to Make.com)
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Respond with the cached version (stale) if available
      const cachedResponse = await cache.match(event.request);
      
      // 2. Fetch a fresh version from the network (revalidate)
      const fetchedResponsePromise = fetch(event.request).then(
        (networkResponse) => {
          // If the fetch is successful, update the cache
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }
      ).catch(error => {
        // The network failed, but we don't need to throw an error
        // because we've already served the cached version.
        console.warn(`[ServiceWorker] Network request for ${event.request.url} failed.`, error);
      });
      
      // Return the cached response immediately, or wait for the network
      // if the resource wasn't in the cache.
      return cachedResponse || fetchedResponsePromise;
    })
  );
});