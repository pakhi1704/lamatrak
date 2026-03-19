var CACHE_NAME = 'lamatrak-app';
var ASSETS = ['/', '/index.html', '/styles.css', '/db.js', '/sync.js', '/app.js', '/manifest.json'];

self.addEventListener('install', function(event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function(cache) { return cache.addAll(ASSETS); }));
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // API and uploads: network-only, offline error fallback
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
    event.respondWith(fetch(event.request).catch(function() {
      return new Response(JSON.stringify({ error: 'offline' }), { headers: { 'Content-Type': 'application/json' }, status: 503 });
    }));
    return;
  }

  // App shell: stale-while-revalidate
  // Serve cache immediately, update cache in background — instant load even offline/slow satellite
  event.respondWith(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.match(event.request).then(function(cached) {
        var networkFetch = fetch(event.request).then(function(resp) {
          if (resp.ok) cache.put(event.request, resp.clone());
          return resp;
        }).catch(function() { return null; });

        // Return cached immediately if available, otherwise wait for network
        return cached || networkFetch.then(function(resp) {
          if (resp) return resp;
          if (event.request.mode === 'navigate') return cache.match('/index.html');
        });
      });
    })
  );
});
