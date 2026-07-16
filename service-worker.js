const CACHE = 'aniscope-v1-1';
const ASSETS = [
  './','index.html','css/app.css','js/app.js','data/anime.json',
  'manifest.webmanifest','assets/icons/icon-192.png','assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png','assets/icons/apple-touch-icon.png',
  'assets/thumbnails/fullmetal-alchemist-brotherhood.jpg',
  'assets/thumbnails/frieren.jpg',
  'assets/thumbnails/haikyu.jpg',
  'assets/thumbnails/86.jpg',
  'assets/thumbnails/hunter-x-hunter.jpg',
  'assets/thumbnails/lord-of-mysteries.jpg',
  'assets/thumbnails/fire-force.jpg',
  'assets/thumbnails/kurokos-basketball.jpg',
  'assets/thumbnails/mushoku-tensei.jpg',
  'assets/thumbnails/gachiakuta.jpg',
  'assets/thumbnails/re-zero.jpg',
  'assets/thumbnails/apothecary-diaries.jpg',
  'assets/thumbnails/dr-stone.jpg',
  'assets/thumbnails/black-clover.jpg',
  'assets/thumbnails/hells-paradise.jpg',
  'assets/thumbnails/wind-breaker.jpg',
  'assets/thumbnails/aoashi.jpg',
  'assets/thumbnails/slam-dunk.jpg',
  'assets/thumbnails/eyeshield-21.jpg',
  'assets/thumbnails/hajime-no-ippo.jpg',
  'assets/thumbnails/overtake.jpg',
  'assets/thumbnails/mashle.jpg',
  'assets/thumbnails/akame-ga-kill.jpg',
  'assets/thumbnails/shield-hero.jpg',
  'assets/thumbnails/jojos-bizarre-adventure.jpg',
  'assets/artwork/fullmetal-alchemist-brotherhood.jpg',
  'assets/artwork/frieren.jpg',
  'assets/artwork/haikyu.jpg',
  'assets/artwork/86.jpg',
  'assets/artwork/hunter-x-hunter.jpg',
  'assets/artwork/lord-of-mysteries.jpg',
  'assets/artwork/fire-force.jpg',
  'assets/artwork/kurokos-basketball.jpg',
  'assets/artwork/mushoku-tensei.jpg',
  'assets/artwork/gachiakuta.jpg',
  'assets/artwork/re-zero.jpg',
  'assets/artwork/apothecary-diaries.jpg',
  'assets/artwork/dr-stone.jpg',
  'assets/artwork/black-clover.jpg',
  'assets/artwork/hells-paradise.jpg',
  'assets/artwork/wind-breaker.jpg',
  'assets/artwork/aoashi.jpg',
  'assets/artwork/slam-dunk.jpg',
  'assets/artwork/eyeshield-21.jpg',
  'assets/artwork/hajime-no-ippo.jpg',
  'assets/artwork/overtake.jpg',
  'assets/artwork/mashle.jpg',
  'assets/artwork/akame-ga-kill.jpg',
  'assets/artwork/shield-hero.jpg',
  'assets/artwork/jojos-bizarre-adventure.jpg'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
  ));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match('index.html')))
  );
});
