/* =====================================================================
   service-worker.js – et lite program nettleseren kjører i bakgrunnen.

   Det tar vare på en kopi av appens filer, slik at appen kan åpnes
   selv uten nett. Vi henter alltid den nyeste versjonen fra nettet
   først ("network first"), og bruker kopien bare hvis nettet er borte.
   Da ser du endringene dine med en gang etter at du har publisert.
   ===================================================================== */

const CACHE_NAVN = 'gjoremal-v1';

const FILER = [
  './',
  './index.html',
  './style.css',
  './storage.js',
  './app.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

// Første gang: lagre en kopi av alle filene
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAVN).then((cache) => cache.addAll(FILER)));
  self.skipWaiting();
});

// Rydd bort gamle kopier hvis CACHE_NAVN er endret
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((navn) => Promise.all(navn.filter((n) => n !== CACHE_NAVN).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Bare våre egne filer. Forespørsler til f.eks. en database slipper rett gjennom.
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((svar) => {
        const kopi = svar.clone();
        caches.open(CACHE_NAVN).then((cache) => cache.put(e.request, kopi));
        return svar;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
