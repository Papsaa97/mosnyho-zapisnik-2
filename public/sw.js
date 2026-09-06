/**
 * Mošnýho zápisník 2.0 – Service Worker
 * Strategy: Cache-First for static assets, Network-First for API, offline fallback
 * 
 * Cache buckets:
 *  - SHELL_CACHE: App shell (HTML, JS, CSS, manifest, icons) – Cache-First
 *  - FONT_CACHE:  Web fonts – Cache-First with long TTL
 *  - RUNTIME_CACHE: Dynamic fetched resources – Network-First
 */

const CACHE_VERSION = 'v2.3';
const SHELL_CACHE = `mosny-shell-${CACHE_VERSION}`;
const FONT_CACHE = `mosny-fonts-${CACHE_VERSION}`;
const RUNTIME_CACHE = `mosny-runtime-${CACHE_VERSION}`;

// All known static assets to pre-cache on install
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
  '/favicon.svg',
  '/icons.svg'
];

// Origins to treat as fonts (cache aggressively)
const FONT_ORIGINS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// ───────────────────────── INSTALL ─────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      // Add all shell assets, skip failing ones to avoid blocking install
      await Promise.allSettled(
        SHELL_ASSETS.map(url => cache.add(url).catch(err => {
          console.warn(`[SW] Could not cache ${url}:`, err);
        }))
      );
    }).then(() => {
      console.log('[SW] Install complete – shell cached');
      // Skip waiting so new SW activates immediately
      return self.skipWaiting();
    })
  );
});

// ───────────────────────── ACTIVATE ─────────────────────────
self.addEventListener('activate', (event) => {
  const currentCaches = [SHELL_CACHE, FONT_CACHE, RUNTIME_CACHE];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => !currentCaches.includes(name))
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Activated and claiming clients');
      return self.clients.claim();
    })
  );
});

// ───────────────────────── FETCH ─────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignore non-GET requests (POST, etc.)
  if (request.method !== 'GET') return;

  // Ignore chrome-extension and other non-http schemes
  if (!request.url.startsWith('http')) return;

  const url = new URL(request.url);

  // ── Strategy 1: Font requests → Cache-First with very long TTL
  if (FONT_ORIGINS.some(origin => url.hostname.includes(origin))) {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(() => new Response('', { status: 503, statusText: 'Offline' }))
    );
    return;
  }

  // ── Strategy 2: Shell assets (same origin HTML/JS/CSS/icons) → Cache-First
  const isShellAsset = url.origin === self.location.origin;
  if (isShellAsset) {
    event.respondWith(
      caches.match(request).then(async (cached) => {
        if (cached) {
          // Revalidate in background (stale-while-revalidate)
          fetch(request).then(response => {
            if (response && response.status === 200 && response.type === 'basic') {
              caches.open(SHELL_CACHE).then(cache => cache.put(request, response));
            }
          }).catch(() => {/* ignore network error in background */});
          return cached;
        }

        // Not cached – fetch and cache
        try {
          const response = await fetch(request);
          if (response.status === 200) {
            const cache = await caches.open(SHELL_CACHE);
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          // Full offline – serve index.html as SPA fallback for navigation requests
          if (request.mode === 'navigate') {
            const indexFallback = await caches.match('/index.html') || await caches.match('/');
            if (indexFallback) return indexFallback;
          }
          // Return meaningful offline response
          return new Response(
            '<html><body style="font-family:sans-serif;padding:40px;background:#090d16;color:#f1f5f9"><h2>⚡ Mošnýho zápisník</h2><p>Aplikace běží offline. Všechna data jsou uložena lokálně.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' }, status: 200 }
          );
        }
      })
    );
    return;
  }

  // ── Strategy 3: External resources → Network-First with cache fallback
  event.respondWith(
    fetch(request).then(response => {
      if (response && response.status === 200) {
        caches.open(RUNTIME_CACHE).then(cache => cache.put(request, response.clone()));
      }
      return response;
    }).catch(() => {
      return caches.match(request).then(cached => {
        return cached || new Response('', { status: 503, statusText: 'Offline' });
      });
    })
  );
});

// ───────────────────────── NOTIFICATION CLICK ─────────────────────────
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

// ───────────────────────── BACKGROUND MESSAGES ─────────────────────────
self.addEventListener('message', (event) => {
  // Shift reminder notification
  if (event.data && event.data.type === 'SHOW_SHIFT_REMINDER') {
    const title = event.data.title || '⚠️ Nezapomněl sis ukončit směnu?';
    const options = {
      body: event.data.body || 'Mošnýho zápisník: Směna běží už dlouho. Nezapomeň ji ukončit!',
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      tag: 'shift-reminder-anti-forget',
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: '/' }
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
    return;
  }

  // Instant cache refresh (called after new deploy)
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
