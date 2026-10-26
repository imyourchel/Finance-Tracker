/* DailyTrack service worker
 * - Halaman (navigasi): network-first, fallback ke shell yang tersimpan saat offline.
 * - Aset statis (JS/CSS/gambar/font dari origin ini): stale-while-revalidate.
 * - Permintaan API (/api, atau origin lain) TIDAK PERNAH disimpan.
 */
const VERSION = "dt-v1";
const SHELL = "/index.html";
const PRECACHE = ["/", SHELL, "/manifest.webmanifest", "/brand/pwa-192.png", "/brand/logo-128.webp"];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
            .open(VERSION)
            .then((cache) => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
            .then(() => self.clients.claim()),
    );
});

const isApi = (url) => url.pathname.startsWith("/api") || url.pathname.startsWith("/uploads");

self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET") return;
    const url = new URL(request.url);
    // Hanya origin sendiri; API dan server lain dibiarkan lewat apa adanya
    if (url.origin !== self.location.origin || isApi(url)) return;

    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(VERSION).then((c) => c.put(SHELL, copy));
                    return res;
                })
                .catch(() => caches.match(SHELL)),
        );
        return;
    }

    if (/\.(js|css|png|webp|svg|jpg|jpeg|woff2?|webmanifest)$/.test(url.pathname)) {
        event.respondWith(
            caches.open(VERSION).then(async (cache) => {
                const cached = await cache.match(request);
                const network = fetch(request)
                    .then((res) => {
                        if (res.ok) cache.put(request, res.clone());
                        return res;
                    })
                    .catch(() => cached);
                return cached || network;
            }),
        );
    }
});
