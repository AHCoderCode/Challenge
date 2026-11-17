const CACHE = "chaat-rush-v2";
const CORE = ["/","/index.html","/styles.css","/game.js","/manifest.webmanifest","/icon.svg"];
const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.172.0/build/three.module.js";
const THREE_CORE_URL = "https://cdn.jsdelivr.net/npm/three@0.172.0/build/three.core.js";
self.addEventListener("install",(event)=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(CORE);
    // Three.js is cached separately so a temporary CDN outage cannot block installation.
    try { await cache.add(THREE_URL); } catch {}\n    try { await cache.add(THREE_CORE_URL); } catch {}
    await self.skipWaiting();
  })());
});
self.addEventListener("activate",(event)=>{
  event.waitUntil(caches.keys()
    .then((keys)=>Promise.all(keys.filter((key)=>key!==CACHE).map((key)=>caches.delete(key))))
    .then(()=>self.clients.claim()));
});
self.addEventListener("fetch",(event)=>{
  if(event.request.method!=="GET") return;
  const url=new URL(event.request.url);
  if(url.href===THREE_URL||url.href===THREE_CORE_URL){
    event.respondWith(caches.match(event.request).then((cached)=>cached||fetch(event.request)));
    return;
  }
  if(url.origin!==self.location.origin) return;
  event.respondWith(caches.match(event.request).then((cached)=>cached||fetch(event.request).then((response)=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then((cache)=>cache.put(event.request,copy));}
    return response;
  }).catch(()=>caches.match("/index.html"))));
});