"use strict";
// Serve cached pages and timetable data immediately; refresh in the background.
const PREFIX="nitocbus-pwa-";
const CACHE=PREFIX+"v4-20261126-install";
const PAGES=new Set(["/","/obus_2026_kosen_s2k","/obus_2026_kosen_k2s","/departure/","/departure/k2s/","/watch/"]);
const ASSETS=new Set(["/assets/favicon.svg","/assets/icons/icon-180.png","/assets/icons/icon-192.png","/assets/icons/icon-512.png","/manifest.webmanifest","/obus_2026_kosen.json","/assets/css/pwa.css?v=20261126-pwa","/assets/js/pwa.js?v=20261126-install","/assets/css/site.css","/assets/css/migration-notice.css","/assets/js/migration-notice.js","/assets/css/timetable.css?v=20260929-1705","/assets/js/timetable.js?v=20261126-pwa","/assets/css/departure.css?v=20261007-security","/assets/js/departure.js?v=20261126-pwa","/assets/css/watch.css?v=20261007-dot-center","/assets/js/watch.js?v=20261126-pwa"]);
const DATA="/obus_2026_kosen.json";
const ASSET_PATHS=new Set([...ASSETS].map(path=>path.split("?")[0]));
const PRECACHE=[...PAGES,...ASSETS];
const TIMEOUT_MS=4000;

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(PRECACHE.map(path=>new Request(path,{cache:"reload"})));
  })());
  // Wait for old tabs to close before replacing their cache.
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    for(const name of await caches.keys()){
      if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

function cacheKey(request){
  const url=new URL(request.url);
  if(request.method!=="GET"||url.origin!==self.location.origin||request.headers.has("Range"))return null;
  if(request.mode==="navigate")return PAGES.has(url.pathname)?url.pathname:null;
  if(!ASSET_PATHS.has(url.pathname))return null;
  if([...url.searchParams.keys()].some(key=>key!=="v"))return null;
  return url.pathname+url.search;
}

function validResponse(response,key){
  if(!response.ok||response.status!==200||response.type==="opaque")return false;
  const type=(response.headers.get("Content-Type")||"").toLowerCase();
  if(PAGES.has(key))return type.includes("text/html");
  if(key===DATA||key==="/manifest.webmanifest")return type.includes("json");
  if(key.split("?")[0].endsWith(".js"))return type.includes("javascript")||type.includes("ecmascript");
  if(key.split("?")[0].endsWith(".css"))return type.includes("text/css");
  return type.startsWith("image/");
}

// Versioned assets and app icons are immutable for the lifetime of this cache.
// Unversioned CSS/JS also revalidate so edits need not wait for a worker release.
function cacheFirst(key){
  return key.startsWith("/assets/")&&(key.includes("?v=")||key.startsWith("/assets/icons/"));
}

async function readCached(key){
  try{return await (await caches.open(CACHE)).match(key);}
  catch(error){console.warn("Cache read:",error);return undefined;}
}

async function refresh(request,key,hasCached){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  let response;
  try{
    response=await fetch(request,{cache:"no-cache",signal:controller.signal});
  }catch{
    clearTimeout(timer);
    return {response:undefined,done:Promise.resolve()};
  }

  // Start the cache write independently of the response returned to the page.
  // Keep the abort timer active until the body has been consumed, not just headers.
  const done=(async()=>{
    try{
      if(validResponse(response,key)){
        const copy=hasCached?response:response.clone();
        await (await caches.open(CACHE)).put(key,copy);
      }else if(response.body){
        if(hasCached)await response.body.cancel();
        else await response.clone().arrayBuffer();
      }
    }catch(error){console.warn("Cache refresh:",error);}
    finally{clearTimeout(timer);}
  })();
  // A failed background update never replaces the last good response.
  return {response,done};
}

self.addEventListener("fetch",event=>{
  const key=cacheKey(event.request);
  if(key===null)return;
  const cached=readCached(key);
  const update=cached.then(response=>response&&cacheFirst(key)?undefined:refresh(event.request,key,Boolean(response)));
  event.waitUntil(update.then(result=>result?.done).catch(error=>console.warn("Cache refresh:",error)));
  event.respondWith(cached.then(async response=>response||(await update)?.response||Response.error()));
});
