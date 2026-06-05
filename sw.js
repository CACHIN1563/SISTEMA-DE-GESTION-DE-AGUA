const CACHE_NAME = 'aguasanmiguel-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/familias.html',
  '/averias.html',
  '/turnos.html',
  '/operador.html',
  '/style.css',
  '/app.js'
];

// Instalación del SW (Cache preliminar)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  // Fuerza a que el SW activo actual tome el control inmediatamente
  self.skipWaiting();
});

// Interceptación de solicitudes de Red (Network First)
self.addEventListener('fetch', event => {
  // Evitar interceptar peticiones de la API o métodos que no sean GET
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si la red responde bien, actualizamos la caché con la copia fresca
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Si no hay internet (offline), servimos desde la caché local
        return caches.match(event.request);
      })
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
            console.log('Eliminando caché vieja:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Reclamar clientes inmediatamente
  );
});
