// ClassMate+ service worker
// Caches the app shell for offline load; everything data-related (Firestore,
// RTDB, Cloudinary) goes over the network and is NOT touched here — Firebase
// SDKs already handle their own offline persistence/caching.

const CACHE_NAME = "classmate-shell-v1";

// Relative to this file's own location (project root), so caching still
// works correctly if the whole site is deployed under a subpath, e.g.
// a GitHub Pages project site at username.github.io/classmate-plus/.
const APP_SHELL = [
  "./index.html",
  "./public/manifest.json",
  "./src/css/tokens.css",
  "./src/css/base.css",
  "./src/css/layout.css",
  "./src/css/components.css",
  "./src/js/app.js",
  "./public/icons/icon-192.png",
  "./public/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for navigation & JS/CSS (so deploys aren't stuck behind a
// stale cache); cache-first fallback keeps the shell available offline.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // CRITICAL: only handle same-origin app-shell files here. Firestore's
  // Listen/Write streaming channels, Firebase Auth iframes, Cloudinary,
  // FCM, etc. are all cross-origin and use long-lived streamed
  // connections that a generic cache-and-respond handler breaks —
  // ("ServiceWorker intercepted the request and encountered an
  // unexpected error"). Letting the event fall through with no
  // respondWith() means the browser handles it normally, untouched.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Don't try to cache redirects, errors, or opaque responses.
        if (!response.ok || response.type === "opaque") return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
  );
});
