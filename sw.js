const CACHE_NAME = 'pwa-cache-v10';

const FILES_TO_CACHE = [
  '.',
  'index.html',
  'style.css',
  'app.js',
  'manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching app shell');
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

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

self.addEventListener('fetch', (event) => {
  // ✅ ADDED THIS CHECK: Only handle http/https requests. Ignore chrome-extension:// etc.
  if (!event.request.url.startsWith('http')) {
      return;
  }
    
  // Ignore non-GET requests (like the POST to Make.com)
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);
      const fetchedResponsePromise = fetch(event.request).then(
        (networkResponse) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }
      ).catch(error => {
        console.warn(`[ServiceWorker] Network request for ${event.request.url} failed.`, error);
      });
      return cachedResponse || fetchedResponsePromise;
    })
  );
});