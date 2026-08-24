const CACHE='equicare-shell-v13';
const SHELL=[
  './',
  './index.html',
  './manifest.webmanifest',
  './equicare-icon.svg',
  './style.css',
  './photo.css',
  './productscan.css',
  './historyplus.css',
  './overview.css',
  './calendarplus.css',
  './profileplus.css',
  './pwa.css',
  './app.js',
  './fixes.js',
  './photo.js',
  './productscan.js',
  './weather.js',
  './historyplus.js',
  './overview.js',
  './calendarplus.js',
  './profileplus.js',
  './pwa.js'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('equicare-shell-')&&k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;

  if(req.mode==='navigate'){
    event.respondWith(
      fetch(req).then(res=>{
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put('./index.html',copy));
        return res;
      }).catch(()=>caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req,{ignoreSearch:true}).then(cached=>{
      const network=fetch(req).then(res=>{
        if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}
        return res;
      }).catch(()=>cached);
      return cached||network;
    })
  );
});

self.addEventListener('message',event=>{
  if(event.data==='SKIP_WAITING')self.skipWaiting();
});
