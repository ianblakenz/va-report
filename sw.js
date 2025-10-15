// A name for our cache
const CACHE_NAME = 'pwa-cache-v3'; // Incremented version to force update

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
// Using a "Network First" strategy for easy debugging. It tries the
// network first, and if that fails, it serves from the cache.
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
