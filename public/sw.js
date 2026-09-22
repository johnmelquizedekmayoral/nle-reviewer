const CACHE = "nle-shell-v1";
const SHELL = ["/workspace", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith("nle-") && name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/login")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (url.pathname === "/workspace") caches.open(CACHE).then((cache) => cache.put("/workspace", response.clone()));
          return response;
        })
        .catch(() => caches.match("/workspace")),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/favicon.svg") {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
        return response;
      })),
    );
  }
});
