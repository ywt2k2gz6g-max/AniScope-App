const VERSION = "0.6.0";

const SHELL_CACHE = `aniscope-shell-${VERSION}`;
const RUNTIME_CACHE = `aniscope-runtime-${VERSION}`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./css/app.css",

  "./js/state.js",
  "./js/api.js",
  "./js/badges.js",
  "./js/franchise.js",
  "./js/app.js",
  "./js/ui.js",

  "./data/anime.json",
  "./manifest.webmanifest",

  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/favicon.png"
];

/* =========================
   Install
========================= */

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

/* =========================
   Activate
========================= */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName.startsWith("aniscope-") &&
                cacheName !== SHELL_CACHE &&
                cacheName !== RUNTIME_CACHE
            )
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* =========================
   Fetch
========================= */

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  /* Always get the newest page from the network */
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  /* Do not interfere with AniList API requests */
  if (url.hostname === "graphql.anilist.co") {
    return;
  }

  /* Local CSS, JS and data: network first */
  if (
    url.origin === self.location.origin &&
    ["script", "style"].includes(request.destination)
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (
    url.origin === self.location.origin &&
    url.pathname.endsWith(".json")
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  /* Images and other static files: cached, then refreshed */
  if (
    request.destination === "image" ||
    request.destination === "font"
  ) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

/* =========================
   Strategies
========================= */

async function networkFirstPage(request) {
  try {
    const response = await fetch(request, {
      cache: "no-store"
    });

    if (response && response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put("./index.html", response.clone());
    }

    return response;
  } catch {
    return (
      (await caches.match("./index.html")) ||
      new Response("AniScope is currently offline.", {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      })
    );
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);

    if (response && response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    return new Response("Resource unavailable while offline.", {
      status: 503,
      statusText: "Offline"
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);

  const networkResponse = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => null);

  return cachedResponse || networkResponse;
}