var CACHE_NAME = 'lamatrak-v1';
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
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
    event.respondWith(fetch(event.request).catch(function() {
      return new Response(JSON.stringify({ error: 'offline' }), { headers: { 'Content-Type': 'application/json' }, status: 503 });
    }));
    return;
  }
  event.respondWith(caches.match(event.request).then(function(cached) {
    if (cached) return cached;
    return fetch(event.request).then(function(resp) {
      if (resp.ok) { var c = resp.clone(); caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, c); }); }
      return resp;
    }).catch(function() { if (event.request.mode === 'navigate') return caches.match('/index.html'); });
  }));
});
