/**
 * usePWA — Dynamic PWA setup for Loup-Garou.
 *
 * Uses the custom wolf icon for PWA manifest and touch icons,
 * injects a web app manifest via blob URL,
 * registers the service worker, adds mobile meta tags,
 * captures the beforeinstallprompt event (Android),
 * and detects standalone mode.
 *
 * Call once from a top-level layout component.
 */
import { useEffect, useRef, useState, useCallback } from 'react';

// Wolf icon for PWA manifest — inline SVG data URI to avoid blocking
// the module chain if a figma:asset is unavailable after a version restore.
const WOLF_ICON_URI = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="128" fill="#0a0e1a"/><text x="256" y="360" font-size="300" text-anchor="middle">🐺</text></svg>'
);

/* ── Inject or update a <meta> tag ── */
function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

/* ── Inject or update a <link> tag ── */
function setLink(rel: string, href: string, extra?: Record<string, string>) {
  // Build a selector that matches rel + any extra attributes
  let selector = `link[rel="${rel}"]`;
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      selector += `[${k}="${v}"]`;
    }
  }
  let el = document.querySelector(selector) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        el.setAttribute(k, v);
      }
    }
    document.head.appendChild(el);
  }
  el.href = href;
}

/* ── Ensure viewport meta includes viewport-fit=cover ── */
function ensureViewportFitCover() {
  let el = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
  if (el) {
    const current = el.content || '';
    if (!current.includes('viewport-fit=cover')) {
      el.content = current + ', viewport-fit=cover';
    }
  } else {
    el = document.createElement('meta');
    el.name = 'viewport';
    el.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover';
    document.head.appendChild(el);
  }
}

/* ── Inline Service Worker source ── */
const SW_SOURCE = `
const CACHE_NAME = 'loup-garou-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/']).catch(() => {})
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match('/')))
    );
    return;
  }

  if (['script', 'style', 'font'].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const net = fetch(request)
          .then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
            return res;
          })
          .catch(() => cached);
        return cached || net;
      })
    );
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch { data = { title: 'Loup-Garou', body: event.data.text() }; }
  const title = data.title || 'Loup-Garou';
  const options = {
    body: data.body || '',
    tag: data.tag || 'loup-garou-push',
    vibrate: [200, 100, 200],
    renotify: true,
    data: { url: data.url || '/' },
  };
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
`;

/* ── Register SW from blob if external file fails ── */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // Strategy 1: try the static /sw.js file (works in production builds)
  try {
    const res = await fetch('/sw.js', { method: 'HEAD' });
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('javascript')) {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('[PWA] Service Worker registered from /sw.js, scope:', reg.scope);
      return;
    }
  } catch {
    // /sw.js not available — fall through
  }

  // Strategy 2: inline SW via blob URL (works in preview / sandbox)
  try {
    const blob = new Blob([SW_SOURCE], { type: 'application/javascript' });
    const swURL = URL.createObjectURL(blob);
    const reg = await navigator.serviceWorker.register(swURL, { scope: '/' });
    console.log('[PWA] Service Worker registered from blob, scope:', reg.scope);
  } catch {
    // Blob SW registration is blocked by some browsers — that's OK.
    // The manifest + meta tags still enable iOS "Add to Home Screen".
    console.log('[PWA] Service Worker not available in this environment. PWA meta tags and manifest are still active.');
  }
}

/* ── Detect platform ── */
function getIsIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function getIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

/* ── Global ref for the deferred beforeinstallprompt event ── */
let deferredPromptGlobal: any = null;
let promptListenerAttached = false;

export interface PWAState {
  /** True when the app is running as an installed PWA (standalone mode) */
  isStandalone: boolean;
  /** True when the browser's install prompt is available (Android/desktop Chrome) */
  canInstall: boolean;
  /** True on iOS Safari (needs manual "Add to Home Screen" instructions) */
  isIOS: boolean;
  /** Trigger the native install prompt (Android/Chrome). Returns true if accepted. */
  promptInstall: () => Promise<boolean>;
}

/* ── The hook ── */
export function usePWA(): PWAState {
  const installedRef = useRef(false);
  const [isStandalone, setIsStandalone] = useState(getIsStandalone);
  const [canInstall, setCanInstall] = useState(deferredPromptGlobal !== null);
  const [isIOS] = useState(getIsIOS);

  useEffect(() => {
    if (installedRef.current) return;
    installedRef.current = true;

    // 0. Ensure viewport-fit=cover for safe area insets
    ensureViewportFitCover();

    // 1. Resolve the wolf icon to an absolute URL for the manifest
    const iconURL = WOLF_ICON_URI;

    // 2. Build manifest object
    const manifest = {
      name: 'Loup-Garou de Thiercelieux',
      short_name: 'Loup-Garou',
      description: 'Le jeu du Loup-Garou — version digitale avec gestion en temps reel.',
      start_url: '/',
      display: 'standalone' as const,
      orientation: 'portrait' as const,
      background_color: '#070b1a',
      theme_color: '#0a0e1a',
      categories: ['games', 'entertainment'],
      icons: [
        { src: iconURL, sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
        { src: iconURL, sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
      ],
    };

    // 3. Inject manifest via blob URL
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
    const manifestURL = URL.createObjectURL(blob);
    setLink('manifest', manifestURL);

    // 4. Mobile meta tags
    setMeta('theme-color', '#0a0e1a');
    setMeta('apple-mobile-web-app-capable', 'yes');
    setMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
    setMeta('apple-mobile-web-app-title', 'Loup-Garou');
    setMeta('mobile-web-app-capable', 'yes');
    setMeta('application-name', 'Loup-Garou');
    setMeta('msapplication-TileColor', '#0a0e1a');

    // 5. Apple touch icon
    setLink('apple-touch-icon', iconURL);

    // 6. Register Service Worker (graceful — tries file, then blob, then skips)
    registerServiceWorker();

    // Cleanup: revoke blob URL on unmount (shouldn't happen for root)
    return () => {
      URL.revokeObjectURL(manifestURL);
    };
  }, []);

  // 7. Capture beforeinstallprompt event (Android / desktop Chrome)
  useEffect(() => {
    if (promptListenerAttached) return;
    promptListenerAttached = true;

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptGlobal = e;
      setCanInstall(true);
      console.log('[PWA] beforeinstallprompt captured — install prompt available');
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Detect when the app gets installed
    const installedHandler = () => {
      setIsStandalone(true);
      setCanInstall(false);
      deferredPromptGlobal = null;
      console.log('[PWA] App installed');
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
      promptListenerAttached = false;
    };
  }, []);

  // 8. Listen for display-mode changes (user installs via browser menu)
  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)');
    const handler = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches);
      if (e.matches) setCanInstall(false);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPromptGlobal) return false;
    try {
      deferredPromptGlobal.prompt();
      const result = await deferredPromptGlobal.userChoice;
      if (result.outcome === 'accepted') {
        setIsStandalone(true);
        setCanInstall(false);
        deferredPromptGlobal = null;
        return true;
      }
    } catch (err) {
      console.log('[PWA] Install prompt error:', err);
    }
    return false;
  }, []);

  return { isStandalone, canInstall, isIOS, promptInstall };
}