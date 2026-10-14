// La Maison Paris : lecture hors connexion.
// Coquille et liste des numéros en « réseau d'abord » (les nouveaux numéros arrivent dès qu'il y a du réseau),
// versions lecture de TOUS les numéros et pages des 4 plus récents téléchargées à l'avance, le reste gardé au fil de la lecture.
const CACHE = "lmp-v1";
const SHELL = ["./", "index.html", "editions.json", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png",
  "fonts/playfair-display-latin-700-normal.woff2", "fonts/playfair-display-latin-900-normal.woff2",
  "fonts/playfair-display-latin-400-italic.woff2", "fonts/playfair-display-latin-700-italic.woff2",
  "fonts/source-serif-4-latin-400-normal.woff2", "fonts/source-serif-4-latin-400-italic.woff2",
  "fonts/source-serif-4-latin-600-normal.woff2", "fonts/libre-franklin-latin-400-normal.woff2",
  "fonts/libre-franklin-latin-600-normal.woff2", "fonts/libre-franklin-latin-800-normal.woff2"];
const RECENT_PAGES = 4;

self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()).then(sync)));

async function sync() {
  const c = await caches.open(CACHE);
  let d;
  try { const r = await fetch("editions.json", {cache: "no-cache"}); if (!r.ok) return; await c.put("editions.json", r.clone()); d = await r.json(); }
  catch (_) { return; }
  const want = [];
  d.editions.forEach((e, i) => {
    want.push(e.lecture, ...(e.extras || []), e.prefix + String(1).padStart(e.pad, "0") + ".jpg");
    if (i < RECENT_PAGES) for (let p = 2; p <= e.pages; p++) want.push(e.prefix + String(p).padStart(e.pad, "0") + ".jpg");
  });
  for (const u of want) {
    if (await c.match(u)) continue;
    try { const r = await fetch(u); if (r.ok) await c.put(u, r); } catch (_) {}
  }
}
self.addEventListener("message", e => { if (e.data === "sync") e.waitUntil(sync()); });

self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  const path = u.pathname.split("/").pop();
  const networkFirst = e.request.mode === "navigate" || path === "" || path === "index.html" || path === "editions.json";
  if (networkFirst) {
    e.respondWith(fetch(e.request).then(r => { const k = r.clone(); caches.open(CACHE).then(c => c.put(e.request.mode === "navigate" ? "index.html" : e.request, k)); return r; })
      .catch(() => caches.match(e.request, {ignoreSearch: true}).then(r => r || caches.match("index.html"))));
  } else {
    e.respondWith(caches.match(e.request, {ignoreSearch: true}).then(hit => hit || fetch(e.request).then(r => {
      if (r.ok) { const k = r.clone(); caches.open(CACHE).then(c => c.put(e.request, k)); }
      return r;
    })));
  }
});
