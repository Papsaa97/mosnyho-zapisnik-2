/**
 * Custom Service Worker extensions for Montážní zápisník 2.0
 * These handlers are imported by the Workbox-generated SW via importScripts.
 */

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Shift reminder notification from app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_SHIFT_REMINDER') {
    const title = event.data.title || '\u26a0\ufe0f Nezapomn\u011bl sis ukon\u010dit sm\u011bnu?';
    const options = {
      body: event.data.body || 'Mo\u0161n\u00fdho z\u00e1pisn\u00edk: Sm\u011bna b\u011b\u017e\u00ed u\u017e dlouho. Nezapome\u0148 ji ukon\u010dit!',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'shift-reminder-anti-forget',
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: '/' }
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }
});
