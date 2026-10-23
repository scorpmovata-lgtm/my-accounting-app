// Service Worker برای PWA
// - کش کردن app shell (HTML, JS, CSS, فونت, آیکون‌ها) برای کار آفلاین
// - استراتژی: network-first برای navigation، cache-first برای assets

const CACHE_VERSION = "accounting-v1";
const APP_SHELL = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => console.error("SW install error:", err))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_VERSION)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // فقط GET را کش کن
  if (req.method !== "GET") return;

  // درخواست‌های API (Supabase، Edge Functions) را رد کن — باید زنده باشند
  const url = new URL(req.url);
  if (
    url.hostname.endsWith(".supabase.co") ||
    url.hostname === "api.telegram.org"
  ) {
    return;
  }

  // navigation: network-first با fallback به cache
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("/")))
    );
    return;
  }

  // assets: cache-first با fallback به network
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // کش کن برای دفعه بعد
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
