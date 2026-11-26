"use strict";
// Network-first: cached timetables are only a fallback.
const PREFIX="nitocbus-pwa-";
const CACHE=PREFIX+"v1-20261126-pwa";
const PAGES=new Set(["/","/obus_2026_kosen_s2k","/obus_2026_kosen_k2s","/departure/","/departure/k2s/","/watch/"]);
const ASSETS=new Set(["/assets/favicon.svg","/assets/icons/icon-180.png","/assets/icons/icon-192.png","/assets/icons/icon-512.png","/manifest.webmanifest","/obus_2026_kosen.json","/assets/css/pwa.css?v=20261126-pwa","/assets/js/pwa.js?v=20261126-pwa","/assets/css/site.css","/assets/css/migration-notice.css","/assets/js/migration-notice.js","/assets/css/timetable.css?v=20260929-1705","/assets/js/timetable.js?v=20261126-pwa","/assets/css/departure.css?v=20261007-security","/assets/js/departure.js?v=20261126-pwa","/assets/css/watch.css?v=20261007-dot-center","/assets/js/watch.js?v=20261126-pwa"]);
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

async function fetchFresh(request){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{return await fetch(request,{cache:"no-cache",signal:controller.signal});}
  finally{clearTimeout(timer);}
}

async function fallbackResponse(response,key){
  if(!PAGES.has(key)&&key!==DATA)return response;
  const headers=new Headers(response.headers);
  headers.set("X-NITOC-Cached","1");
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  headers.delete("ETag");
  if(PAGES.has(key)){
    const html=(await response.text()).replace(/<body(?=[\s>])/i,"<body data-pwa-cached");
    return new Response(html,{status:200,headers});
  }
  return new Response(response.body,{status:200,headers});
}

async function networkFirst(request,key){
  let response;
  try{response=await fetchFresh(request);}catch{}
  if(response&&response.status<500){
    if(validResponse(response,key)){
      try{const cache=await caches.open(CACHE);await cache.put(key,response.clone());}catch(error){console.warn("Cache write:",error);}
    }
    return response;
  }
  try{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(key);
    if(cached)return await fallbackResponse(cached,key);
  }catch(error){console.warn("Cache read:",error);}
  return response||Response.error();
}

self.addEventListener("fetch",event=>{
  const key=cacheKey(event.request);
  if(key!==null)event.respondWith(networkFirst(event.request,key));
});
