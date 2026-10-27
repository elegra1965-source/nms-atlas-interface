/* ================= ATLAS — service worker =================
   Cache static shell for offline UI. AI + weather calls
   always go to network.
=========================================================== */
const CACHE = 'atlas-v128'; // v4.5 NMS archive (free, no key)

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/orb.css',
  './css/panels.css',
  './css/mobile.css',
  './js/atlas.js',
  './js/voice.js',
  './js/api.js',
  './js/memory.js',
  './js/pulse.js',
  './js/widgets.js',
  './js/hud.js',
  './js/orbwrap.js',
'./js/heartbeat.js',
  './js/scrollhints.js',
  './js/codex.js',
  './assets/atlas-orb.gif',
  './assets/atlas-orb-small.gif',
  './assets/bg-spaceport.jpg',
  './assets/lore/facts.json',
  './assets/haven-worlds.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/og-image.jpg',
  './assets/fonts/nms-alphabet.ttf'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // never cache API calls (Claude, weather, expedition progress)
  if (url.hostname.includes('anthropic.com') || url.hostname.includes('open-meteo.com') ||
      url.hostname.includes('nomanssky.com') || url.hostname.includes('allorigins.win') ||
      url.hostname.includes('corsproxy.io') || url.hostname.includes('azureedge.net') ||
      url.hostname.includes('elevenlabs.io') || url.hostname.includes('fandom.com') ||
      url.hostname.includes('nmsalmanac.com') || url.hostname === 'map.nomansskyhub.app' ||
      url.pathname.startsWith('/nms-api/') || url.pathname.startsWith('/haven-api/')) {
    return; // straight to network
  }
  // network-first for the static shell (HTML/JS/CSS), so a fresh deploy shows immediately;
  // cache is only used offline or if the network request fails
  e.respondWith(
    fetch(e.request).then(resp => {
      if (resp && resp.status === 200) {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return resp;
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
  );
});

// 2026-10-09: RETIRED_HOST — on the old *.netlify.app address this worker cleans up after itself:
// drops any push sign-up (so alerts don't arrive twice once the app is reinstalled from
// https://atlas.nomansskyhub.app), clears its caches, unregisters and sends open windows to the new address.
if (/\.netlify\.app$/.test(self.location.hostname)) {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', e => e.waitUntil((async () => {
    try {
      const s = self.registration.pushManager && await self.registration.pushManager.getSubscription();
      if (s) {
        await fetch('/api/push-subscribe', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: s.endpoint }) }).catch(() => {});
        await s.unsubscribe();
      }
    } catch (err) {}
    try { for (const k of await caches.keys()) await caches.delete(k); } catch (err) {}
    await self.registration.unregister();
    const wins = await self.clients.matchAll({ type: 'window' });
    wins.forEach(c => { const u = new URL(c.url); c.navigate('https://atlas.nomansskyhub.app' + u.pathname + u.search).catch(() => {}); });
  })()));
}

// --- Push alerts (2026-10-23): sent by the Weather station's alert server, signed up via nms-push.js ---
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: '◈ No Man\'s Sky Hub', body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(data.title || '◈ No Man\'s Sky Hub', {
    body: data.body || '', icon: data.icon || 'assets/icons/icon-192.png', badge: 'badge-96.png', tag: data.tag || 'nms-alert', data: data.url || './'
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const abs = new URL(event.notification.data || './', self.registration.scope);
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if (c.url.split('#')[0] === abs.href && 'focus' in c) return c.focus(); }
    return clients.openWindow ? clients.openWindow(abs.href) : null;
  }));
});
