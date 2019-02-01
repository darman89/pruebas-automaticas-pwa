var cacheName = 'stationPWA-pruebas-1-1';
var dataCacheName = 'stationData-v1';

var filesToCache = [
    '/',
    '/index.html',
    '/scripts/app.js',
    '/styles/inline.css',
    '/images/ic_add_white_24px.svg',
    '/images/ic_refresh_white_24px.svg'
];

self.addEventListener('install', function(e) {
  console.log('[ServiceStation] Install');
  e.waitUntil(
    caches.open(cacheName).then(function(cache) {
      console.log('[ServiceStation] Caching app shell');
      return cache.addAll(filesToCache);
    })
  );
});

self.addEventListener('activate', function(e) {
    console.log('[ServiceStation] Activate');
    e.waitUntil(
      caches.keys().then(function(keyList) {
        return Promise.all(keyList.map(function(key) {
            if (key !== cacheName && key !== dataCacheName) {
            console.log('[ServiceStation] Removing old cache', key);
            return caches.delete(key);
          }
        }));
      })
    );
    return self.clients.claim();
  });
  
  self.addEventListener('fetch', function(e) {
    console.log('[ServiceStation] Fetch', e.request.url);
    var dataUrl = 'https://api-ratp.pierre-grimaud.fr/v3/schedules';
    if (e.request.url.indexOf(dataUrl) > -1) {
      e.respondWith(
        caches.open(dataCacheName).then(function(cache) {
          return fetch(e.request).then(function(response){
            cache.put(e.request.url, response.clone());
            return response;
          });
        })
      );
    } else {
      e.respondWith(
        caches.match(e.request).then(function(response) {
          return response || fetch(e.request);
        })
      );
    }
  });
  
  