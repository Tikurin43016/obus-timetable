import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {runInNewContext} from "node:vm";
const origin="https://nitocbus.pages.dev";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const source=read("sw.js");
const manifest=JSON.parse(read("manifest.webmanifest"));
const pages=["index.html","obus_2026_kosen_s2k.html","obus_2026_kosen_k2s.html","departure/index.html","departure/k2s/index.html","watch/index.html"];
test("manifest and page entry points",()=>{
  assert.equal(manifest.start_url,"/");
  assert.equal(manifest.display,"standalone");
  for(const icon of manifest.icons){
    const file=readFileSync(new URL(".."+icon.src,import.meta.url));
    assert.equal(file.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
    assert.equal(file.readUInt32BE(16)+"x"+file.readUInt32BE(20),icon.sizes);
  }
  for(const path of pages){
    const html=read(path);
    assert.match(html,/rel="manifest" href="\/manifest.webmanifest"/);
    assert.match(html,/assets\/js\/pwa\.js/);
    for(const match of html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)){
      const absolute=new URL(match[1],origin+"/"+path);
      assert.ok(existsSync(new URL(".."+absolute.pathname,import.meta.url)),absolute.pathname);
      assert.ok(source.includes(absolute.pathname+absolute.search),absolute.pathname+absolute.search);
    }
  }
});
function harness({timeoutMs, beforePut=async()=>{}}={}){
  const listeners={},store=new Map();
  let network=async()=>new Response("fresh",{headers:{"Content-Type":"application/json"}});
  const cache={put:async(key,value)=>{
    const bytes=await value.arrayBuffer();
    await beforePut();
    store.set(key,new Response(bytes,{status:value.status,headers:value.headers}));
  },match:async key=>store.get(key)?.clone(),addAll:async()=>{}};
  const self={location:{origin},clients:{claim:async()=>{}},addEventListener:(name,handler)=>{listeners[name]=handler;}};
  runInNewContext(source,{self,caches:{open:async()=>cache,keys:async()=>[],delete:async()=>true},URL,Request,Response,Headers,AbortController,setTimeout:(fn,ms)=>setTimeout(fn,timeoutMs??ms),clearTimeout,console,fetch:(...args)=>network(...args)});
  function request(path,{mode="cors",method="GET",headers={}}={}){
    let promise,background;
    listeners.fetch({request:{url:new URL(path,origin).href,mode,method,headers:new Headers(headers)},respondWith:value=>{promise=value;},waitUntil:value=>{background=value;}});
    return promise?{response:promise,background}:undefined;
  }
  return {store,request,setNetwork:fn=>{network=fn;}};
}
test("cached JSON returns before network finishes and updates next read",async()=>{
  const h=harness(),key="/obus_2026_kosen.json";
  h.store.set(key,new Response("old",{headers:{"Content-Type":"application/json"}}));
  let release;
  h.setNetwork(()=>new Promise(resolve=>{release=resolve;}));
  const first=h.request(key);
  assert.equal(await (await first.response).text(),"old");
  // Background fetch is deliberately unresolved while the cached response is read.
  release(new Response("new",{headers:{"Content-Type":"application/json"}}));
  await first.background;
  h.setNetwork(async()=>{throw Error("offline");});
  const second=h.request(key);
  assert.equal(await (await second.response).text(),"new");
  await second.background;
});
test("failed or invalid updates preserve cache; cache miss returns network status",async()=>{
  const h=harness(),key="/obus_2026_kosen.json";
  h.store.set(key,new Response("old",{headers:{"Content-Type":"application/json"}}));
  for(const response of [new Response("missing",{status:404}),new Response("unavailable",{status:503}),new Response("<html>wrong</html>",{headers:{"Content-Type":"text/html"}})]){
    h.setNetwork(async()=>response);
    const request=h.request(key);
    assert.equal(await (await request.response).text(),"old");
    await request.background;
    assert.equal(await h.store.get(key).clone().text(),"old");
  }
  h.store.delete(key);
  h.setNetwork(async()=>new Response("missing",{status:404}));
  const request=h.request(key);
  assert.equal((await request.response).status,404);
  await request.background;
});
test("offline navigation returns immediately and preserves migration query",async()=>{
  const h=harness();
  h.store.set("/",new Response("<html><body><main>old</main></body></html>",{headers:{"Content-Type":"text/html"}}));
  let seen;
  h.setNetwork(async req=>{seen=req.url;return new Response("unavailable",{status:503});});
  const cached=h.request("/?moved=obuskosen",{mode:"navigate"});
  assert.match(await (await cached.response).text(),/<main>old<\/main>/);
  await cached.background;
  assert.match(seen,/moved=obuskosen/);
  assert.equal(h.request("/unknown",{mode:"navigate"}),undefined);
  assert.equal(h.request("/obus_2026_kosen_s2k.pdf",{mode:"navigate"}),undefined);
  assert.equal(h.request("/obus_2026_kosen.json",{headers:{Range:"bytes=0-9"}}),undefined);
});
test("versioned assets are cache-first, unversioned assets revalidate",async()=>{
  const h=harness(),versioned="/assets/js/pwa.js?v=20261126-install",unversioned="/assets/css/site.css";
  h.store.set(versioned,new Response("old js",{headers:{"Content-Type":"text/javascript"}}));
  h.store.set(unversioned,new Response("old css",{headers:{"Content-Type":"text/css"}}));
  let count=0;
  h.setNetwork(async()=>{count++;return new Response("new css",{headers:{"Content-Type":"text/css"}});});
  const a=h.request(versioned);
  assert.equal(await (await a.response).text(),"old js");
  await a.background;
  assert.equal(count,0);
  const b=h.request(unversioned);
  assert.equal(await (await b.response).text(),"old css");
  await b.background;
  assert.equal(count,1);
  assert.equal(await h.store.get(unversioned).clone().text(),"new css");
});
test("cache miss response does not wait for cache.put",async()=>{
  let release;
  const h=harness({beforePut:()=>new Promise(resolve=>{release=resolve;})});
  const request=h.request("/obus_2026_kosen.json");
  assert.equal(await (await request.response).text(),"fresh");
  // A real cache write may still be outstanding when the page reads the body.
  while(!release)await new Promise(resolve=>setImmediate(resolve));
  release();
  await request.background;
  assert.equal(await h.store.get("/obus_2026_kosen.json").text(),"fresh");
});
test("stalled background body is aborted and last good cache survives",async()=>{
  const h=harness({timeoutMs:30}),key="/obus_2026_kosen.json";
  h.store.set(key,new Response("old",{headers:{"Content-Type":"application/json"}}));
  let aborted=false;
  h.setNetwork(async (_request,{signal})=>new Response(new ReadableStream({
    start(controller){
      signal.addEventListener("abort",()=>{
        aborted=true;
        controller.error(new Error("aborted"));
      },{once:true});
    }
  }),{headers:{"Content-Type":"application/json"}}));
  const request=h.request(key);
  assert.equal(await (await request.response).text(),"old");
  await request.background;
  assert.equal(aborted,true);
  assert.equal(await h.store.get(key).text(),"old");
});
test("stalled cache-miss body is aborted after headers have been delivered",async()=>{
  const h=harness({timeoutMs:30}),key="/obus_2026_kosen.json";
  h.setNetwork(async (_request,{signal})=>new Response(new ReadableStream({
    start(controller){
      signal.addEventListener("abort",()=>controller.error(new Error("aborted")),{once:true});
    }
  }),{headers:{"Content-Type":"application/json"}}));
  const request=h.request(key);
  const response=await request.response;
  assert.equal(response.status,200);
  await assert.rejects(response.text(),/aborted/);
  await request.background;
  assert.equal(h.store.has(key),false);
});

function installHarness({standalone=false}={}){
  const listeners={},buttonEvents={},alerts=[];
  const button={hidden:true,disabled:false,addEventListener:(name,fn)=>{buttonEvents[name]=fn;}};
  const window={matchMedia:()=>({matches:standalone}),addEventListener:(name,fn)=>{listeners[name]=fn;},alert:message=>alerts.push(message)};
  const document={getElementById:()=>button};
  runInNewContext(read("assets/js/pwa.js"),{window,document,navigator:{onLine:true},console});
  function offer(event){
    listeners.beforeinstallprompt({preventDefault(){},...event});
  }
  return {button,alerts,offer,click:()=>buttonEvents.click(),installed:()=>listeners.appinstalled()};
}
test("install button stays in place during prompt and after dismissal",async()=>{
  const h=installHarness();
  let finish,calls=0;
  h.offer({prompt:async()=>{calls++;},userChoice:new Promise(resolve=>{finish=resolve;})});
  assert.equal(h.button.hidden,false);
  const pending=h.click();
  assert.equal(h.button.hidden,false);
  assert.equal(h.button.disabled,true);
  await h.click();
  assert.equal(calls,1);
  finish({outcome:"dismissed"});
  await pending;
  assert.equal(h.button.hidden,false);
  assert.equal(h.button.disabled,false);
  await h.click();
  assert.equal(h.alerts.length,1);
  h.offer({prompt:async()=>{calls++;},userChoice:Promise.resolve({outcome:"dismissed"})});
  await h.click();
  assert.equal(calls,2);
});
test("install button hides only after appinstalled and stays hidden in standalone",async()=>{
  const h=installHarness();
  let finish;
  h.offer({prompt:async()=>{},userChoice:new Promise(resolve=>{finish=resolve;})});
  const pending=h.click();
  finish({outcome:"accepted"});
  await pending;
  assert.equal(h.button.hidden,false);
  h.installed();
  assert.equal(h.button.hidden,true);
  const app=installHarness({standalone:true});
  app.offer({prompt:async()=>{},userChoice:Promise.resolve({outcome:"accepted"})});
  assert.equal(app.button.hidden,true);
});
test("install prompt errors restore the button",async()=>{
  const h=installHarness();
  h.offer({prompt:async()=>{throw Error("unavailable");}});
  await h.click();
  assert.equal(h.button.hidden,false);
  assert.equal(h.button.disabled,false);
});
