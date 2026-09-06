const CACHE_NAME = 'mosny-zapisnik-v2.1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
  '/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => {
        // Offline fallback if needed
        return caches.match('/');
      });
    })
  );
});

// Handle notification clicks to focus or open PWA window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Receive background messages to display reminders
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_SHIFT_REMINDER') {
    const title = event.data.title || '⚠️ Nezapomněl sis ukončit směnu?';
    const options = {
      body: event.data.body || 'Mošnýho zápisník: Směna běží už dlouho. Nezapomeň ji ukončit!',
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      tag: 'shift-reminder-anti-forget',
      renotify: true,
      data: {
        url: '/'
      }
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }
});
