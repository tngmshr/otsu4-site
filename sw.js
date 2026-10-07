'use strict';
const VERSION = '1.1.2';
const PREFIX = 'otsu4-study-';
const CACHE = `${PREFIX}${VERSION}`;
const BASE = new URL('./', self.location.href);
const SHELL = ['index.html', 'css/app.css', 'js/core.js', 'js/ui.js', 'js/views.js', 'js/lock.js', 'js/app.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'SOURCES.md'];
const OPTIONAL = ['data/hourei.js', 'data/butsuka.js', 'data/seishou.js', 'data/bundle.enc.json'];
const url = path => new URL(path, BASE).href;
function timeoutFetch(request, duration = 4500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), duration);
  return fetch(request, { signal: controller.signal, cache: 'no-cache' }).finally(() => clearTimeout(timeout));
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL.map(path => new Request(url(path), { cache: 'reload' })));
    // Optional data never prevents installation. Do not cache missing stubs.
    await Promise.all(OPTIONAL.map(async path => {
      try { const response = await timeoutFetch(url(path)); if (response.ok) await cache.put(url(path), response); } catch { /* not supplied yet */ }
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, parsed = new URL(request.url);
  if (request.method !== 'GET' || parsed.origin !== BASE.origin || !parsed.pathname.startsWith(BASE.pathname)) return;
  const relative = parsed.pathname.slice(BASE.pathname.length);
  if (OPTIONAL.includes(relative) || relative === 'data/dev-sample.js') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await timeoutFetch(request);
        if (response.ok) { await cache.put(url(relative), response.clone()); return response; }
        if (response.status === 404) {
          await cache.delete(url(relative));
          return new Response('/* Optional subject data not supplied. */', { headers: { 'Content-Type': 'text/javascript; charset=utf-8' } });
        }
      } catch { /* offline: use saved real data */ }
      return (await cache.match(url(relative))) || new Response('/* No cached subject data. */', { headers: { 'Content-Type': 'text/javascript; charset=utf-8' } });
    })());
    return;
  }
  if (request.mode === 'navigate' && (relative === '' || relative === 'index.html')) {
    event.respondWith((async () => {
      try {
        const response = await timeoutFetch(request);
        if (response.ok) { const cache = await caches.open(CACHE); await cache.put(url('index.html'), response.clone()); return response; }
      } catch { /* offline */ }
      return (await caches.match(url('index.html'))) || Response.error();
    })());
  } else if (SHELL.includes(relative)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(url(relative))) || fetch(request);
    })());
  }
});
