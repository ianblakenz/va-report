// A name for our cache
const CACHE_NAME = 'pwa-cache-v5'; // Incremented version

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

// ✅ CORRECTED Fetch Handler
self.addEventListener('fetch', (event) => {
  // We only want the service worker to handle navigation requests (page loads).
  // For all other requests (like the POST to Make.com), we do nothing
  // and let the browser handle it normally.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // If the network fails for a page load, serve the cached page
        return caches.match('index.html');
      })
    );
  }
});