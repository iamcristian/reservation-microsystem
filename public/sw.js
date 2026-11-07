// Service Worker para soporte PWA instalable (Android / iOS / Chrome Desktop)
const CACHE_NAME = "reservas-pwa-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Network-first strategy para mantener disponibilidad de citas siempre en tiempo real
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
