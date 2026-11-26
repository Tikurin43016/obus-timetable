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
function harness(){
  const listeners={},store=new Map();
  let network=async()=>new Response("fresh",{headers:{"Content-Type":"application/json"}});
  const cache={put:async(key,value)=>{store.set(key,value);},match:async key=>store.get(key)?.clone(),addAll:async()=>{}};
  const self={location:{origin},clients:{claim:async()=>{}},addEventListener:(name,handler)=>{listeners[name]=handler;}};
  runInNewContext(source,{self,caches:{open:async()=>cache,keys:async()=>[],delete:async()=>true},URL,Request,Response,Headers,AbortController,setTimeout,clearTimeout,console,fetch:(...args)=>network(...args)});
  function request(path,{mode="cors",method="GET",headers={}}={}){
    let promise;
    listeners.fetch({request:{url:new URL(path,origin).href,mode,method,headers:new Headers(headers)},respondWith:value=>{promise=value;}});
    return promise;
  }
  return {store,request,setNetwork:fn=>{network=fn;}};
}
test("fresh JSON supersedes cache; outage is labelled; 404 is not hidden",async()=>{
  const h=harness(),key="/obus_2026_kosen.json";
  h.store.set(key,new Response("old",{headers:{"Content-Type":"application/json"}}));
  assert.equal(await (await h.request(key)).text(),"fresh");
  h.setNetwork(async()=>{throw Error("offline");});
  const cached=await h.request(key);
  assert.equal(cached.headers.get("X-NITOC-Cached"),"1");
  assert.equal(await cached.text(),"fresh");
  h.setNetwork(async()=>new Response("missing",{status:404}));
  assert.equal((await h.request(key)).status,404);
});
test("offline navigation is labelled; migration query remains on network request",async()=>{
  const h=harness();
  h.store.set("/",new Response("<html><body><main>old</main></body></html>",{headers:{"Content-Type":"text/html"}}));
  h.setNetwork(async req=>{assert.match(req.url,/moved=obuskosen/);return new Response("unavailable",{status:503});});
  const cached=await h.request("/?moved=obuskosen",{mode:"navigate"});
  assert.match(await cached.text(),/<body data-pwa-cached>/);
  assert.equal(h.request("/unknown",{mode:"navigate"}),undefined);
  assert.equal(h.request("/obus_2026_kosen_s2k.pdf",{mode:"navigate"}),undefined);
  assert.equal(h.request("/obus_2026_kosen.json",{headers:{Range:"bytes=0-9"}}),undefined);
});
