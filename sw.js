const CACHE='pediaq-pwa-v13';const ASSETS=['./','./index.html','./app.js','./practice.js','./push.js','./sync.js','./config.js','./questions.json','./comic-q1.png','./icon-192.png','./icon-512.png'];self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(e.request.method==='GET'&&new URL(e.request.url).origin===self.location.origin)e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)))});

self.addEventListener('push',event=>{
  let payload={};try{payload=event.data?.json()||{};}catch(e){}
  const title=typeof payload.title==='string'?payload.title:'PediaQ — 演習のお知らせ / Quiz reminder';
  const url=payload.data?.url||'https://kokikubota1-oss.github.io/pediaq/';
  const options={body:payload.body||'30問の演習を始めよう / Start your 30-question session',
    icon:payload.icon||'./icon-192.png',badge:'./icon-192.png',
    tag:payload.tag||'pediaq-daily',data:{url},renotify:false};
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const requested=event.notification.data?.url||'https://kokikubota1-oss.github.io/pediaq/';
    let url;
    try{url=new URL(requested,self.location.origin);}catch{return;}
    if(url.origin!==self.location.origin||!url.pathname.startsWith('/pediaq/'))return;
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      if(new URL(client.url).origin===url.origin&&new URL(client.url).pathname.startsWith('/pediaq/')){
        await client.navigate(url.href);return client.focus();
      }
    }
    return self.clients.openWindow(url.href);
  })());
});
