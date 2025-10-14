// A name for our cache
const CACHE_NAME = 'pwa-cache-v1';

// This is the NEW list with correct relative paths
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
        // Deletes old caches that are not our current CACHE_NAME
        if (key !== CACHE_NAME) {
          console.log('[ServiceWorker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

// This event fires every time the app makes a network request
self.addEventListener('fetch', (event) => {
  // We only want to handle navigation requests (page loads)
  if (event.request.mode !== 'navigate') {
    return;
  }
  event.respondWith(
      // Try to find a match in the cache first
      caches.match(event.request)
          .then((response) => {
            // If we find a match in the cache, return it.
            // Otherwise, try to fetch it from the network.
            return response || fetch(event.request);
          })
  );
});
