const CACHE_NAME = 'aguasanmiguel-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/operador.html',
    '/style.css',
    '/app.js'
  ];

// Instalacion del SW (Cache preliminar)
self.addEventListener('install', event => {
    event.waitUntil(
          caches.open(CACHE_NAME)
            .then(cache => {
                      console.log('Opened cache');
                      return cache.addAll(urlsToCache);
            })
        );
});

// Interceptacion de solicitudes de Red
self.addEventListener('fetch', event => {
    event.respondWith(
          caches.match(event.request)
            .then(response => {
                      // Retorna el archivo desde cache si existe (incluso sin internet)
                          if (response) {
                                      return response;
                          }
                      // De lo contrario va por la red normal
                          return fetch(event.request);
            }
                      )
        );
});

// Limpieza de Caches antiguos al activar
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
          caches.keys().then(cacheNames => {
                  return Promise.all(
                            cacheNames.map(cacheName => {
                                        if (cacheWhitelist.indexOf(cacheName) === -1) {
                                                      return caches.delete(cacheName);
                                        }
                            })
                          );
          })
        );
});
