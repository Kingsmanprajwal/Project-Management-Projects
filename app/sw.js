// Offline support: cache the app shell; always try the network first so updates show up quickly.
const CACHE = 'tasknest-v4';
const SHARE_CACHE = 'tasknest-share';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/app.js', './js/store.js', './js/saved.js', './js/firebase-config.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== SHARE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Android share sheet → "TaskNest" (Web Share Target, see manifest.webmanifest).
// The shared text/links/files are parked in a cache and the app picks them up at #share/<id>.
async function handleShare(request) {
  const scope = self.registration.scope;
  try {
    const form = await request.formData();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const cache = await caches.open(SHARE_CACHE);
    const files = form.getAll('files').filter((f) => f && typeof f === 'object' && 'size' in f);
    const meta = {
      title: String(form.get('title') || ''),
      text: String(form.get('text') || ''),
      url: String(form.get('url') || ''),
      files: files.map((f) => ({ name: f.name || 'shared-file', type: f.type || 'application/octet-stream', size: f.size })),
      at: Date.now(),
    };
    await Promise.all(files.map((f, i) => cache.put(`${scope}share-data/${id}/file/${i}`, new Response(f, { headers: { 'content-type': f.type || 'application/octet-stream' } }))));
    await cache.put(`${scope}share-data/${id}/meta`, new Response(JSON.stringify(meta), { headers: { 'content-type': 'application/json' } }));
    // Clean up shares that were never completed (older than a day).
    for (const req of await cache.keys()) {
      if (req.url.endsWith('/meta')) {
        const old = await (await cache.match(req)).json().catch(() => ({ at: 0 }));
        if (Date.now() - (old.at || 0) > 86400000) {
          const prefix = req.url.replace(/meta$/, '');
          for (const r of await cache.keys()) if (r.url.startsWith(prefix)) await cache.delete(r);
        }
      }
    }
    return Response.redirect(`${scope}#share/${id}`, 303);
  } catch (err) {
    return Response.redirect(`${scope}#saved`, 303);
  }
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.origin === location.origin && url.pathname.endsWith('/share-target')) {
    e.respondWith(handleShare(e.request));
    return;
  }
  if (e.request.method !== 'GET') return;
  const sameOrigin = url.origin === location.origin;
  const firebaseSdk = url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
  if (!sameOrigin && !firebaseSdk) return; // let Firestore/Auth traffic pass straight through

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))),
  );
});

// Clicking a reminder notification focuses (or opens) the app.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const client = list.find((c) => 'focus' in c);
      return client ? client.focus() : self.clients.openWindow('./#assign');
    }),
  );
});
