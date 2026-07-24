const CACHE_NAME = "little-bear-words-home-v12";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/game.css?v=12",
  "./js/campaign-300.js?v=12",
  "./js/game-v3.js?v=12",
  "./js/pwa.js?v=12",
  "./assets/act-1-home-v3.png",
  "./assets/act-2-land-v3.png",
  "./assets/act-3-time-v3.png",
  "./assets/act-4-community-v3.png",
  "./assets/act-5-meaning-v3.png",
  "./assets/bear-sprites-v2.png",
  "./assets/object-sprites-300.png",
  "./assets/fonts/balsamiq-sans-latin-400-normal.woff",
  "./assets/fonts/balsamiq-sans-latin-400-normal.woff2",
  "./assets/fonts/balsamiq-sans-latin-700-normal.woff",
  "./assets/fonts/balsamiq-sans-latin-700-normal.woff2",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./preview-gameplay-v3.jpg",
  "./preview-five-acts-v3.jpg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("little-bear-words-home-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
