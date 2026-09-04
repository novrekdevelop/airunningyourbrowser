/*
 * AI Running in Your Browser — Service Worker
 * ---------------------------------------------------------------
 * Makes the app installable (PWA) and caches the app shell so it
 * works offline. The heavy ONNX models are fetched from the Hugging
 * Face CDN at runtime and cached separately by the browser itself,
 * so we deliberately do NOT try to pre-cache those multi-MB files.
 *
 * Strategy: network-first for the app shell (so code fixes actually reach the
 * browser) with a cache fallback for offline use. The heavy ONNX models are
 * fetched from the Hugging Face CDN at runtime and cached separately by the
 * browser itself, so upstream requests from other origins are left alone.
 */
const CACHE = "in-browser-ai-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only handle GET, same-origin requests here.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // App shell: network-first (fresh code when online) with cache fallback for
  // offline use. Cache-first used to keep serving an old app.js forever, which
  // is exactly how stale "cpu" device bugs lingered after an update.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
