/**
 * Service Worker for Loup-Garou PWA.
 *
 * This provides:
 *  - PWA installability (browser requires a SW to show "Add to Home Screen")
 *  - Basic offline shell caching (app shell strategy)
 *  - Runtime caching for navigation requests
 *  - Web Push Notification handling (push + notificationclick)
 */

const CACHE_NAME = 'loup-garou-v1';

// Pre-cache the app shell on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
      ]).catch(() => {
        // Silently fail if offline during install
      });
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Clean up old caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Claim all clients immediately
  self.clients.claim();
});

// Network-first strategy for navigations, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  if (!request.url.startsWith(self.location.origin)) return;

  // Navigation requests: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the latest version
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/');
          });
        })
    );
    return;
  }

  // Static assets: stale-while-revalidate
  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'font') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    );
  }
});

// ─── Web Push Notifications ───

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Loup-Garou', body: event.data.text() };
  }

  const title = data.title || 'Loup-Garou';
  const options = {
    body: data.body || '',
    tag: data.tag || 'loup-garou-push',
    icon: data.icon || undefined,
    badge: data.badge || undefined,
    vibrate: [200, 100, 200],
    renotify: true,
    data: {
      url: data.url || '/',
    },
  };

  // Always show push notification (both foreground & background).
  // The in-app toast system also fires for GM alerts via state polling,
  // so the player gets notified even without Web Push support.
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Open the app when the user clicks a push notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});