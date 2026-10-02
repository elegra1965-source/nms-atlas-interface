/* ================= ATLAS — service worker =================
   Cache static shell for offline UI. AI + weather calls
   always go to network.
=========================================================== */
const CACHE = 'atlas-v95'; // v4.0 incoming-transmission greeting

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
  './assets/atlas-orb.gif',
  './assets/atlas-orb-small.gif',
  './assets/bg-spaceport.jpg',
  './assets/lore/facts.json',
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
      url.hostname.includes('elevenlabs.io') ||
      url.pathname.startsWith('/nms-api/')) {
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
