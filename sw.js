// Offline support: network-first for the game files (so updates show up), cache fallback when offline.
const CACHE='relay-rigger-v10';
const FILES=['./','index.html','styles.css','rooms.js','sections.js','levels.js','game.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET') return;
  const url=new URL(req.url);
  const font=url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com';
  if(url.origin!==location.origin&&!font) return;
  e.respondWith(
    fetch(req).then(res=>{ if(res.ok||res.type==='opaque'){ const copy=res.clone(); caches.open(CACHE).then(c=>c.put(req,copy)); } return res; })
      .catch(()=>caches.match(req,{ignoreSearch:true}).then(r=>r||caches.match('index.html')))
  );
});
