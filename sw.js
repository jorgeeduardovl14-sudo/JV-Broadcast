const CACHE='jv-broadcast-v16-4';
const ASSETS=['./','./index.html','./studio.html','./control.html','./assets/css/styles.css','./assets/js/landing.js','./assets/js/studio.js','./assets/js/control.js','./assets/js/realtime.js','./assets/js/config.js','./assets/js/whip-publisher.js','./CHANGELOG.md'];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).catch(()=>{}))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{event.respondWith(fetch(event.request).catch(()=>caches.match(event.request))) });
