const CACHE = "rentflow-static-v1";
const STATIC_FILE = /\.(?:css|js|svg|png|webp|woff2?)$/i;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("message", (event) => { if (event.data === "CLEAR_SENSITIVE_CACHES") event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))); });
self.addEventListener("fetch", (event) => {
  const request = event.request; const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || !STATIC_FILE.test(url.pathname)) return;
  event.respondWith(caches.open(CACHE).then(async (cache) => { const cached = await cache.match(request); const network = fetch(request).then((response) => { if (response.ok && response.type === "basic") cache.put(request, response.clone()); return response; }); return cached || network; }));
});
