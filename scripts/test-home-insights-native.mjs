import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import legacy from 'abort-controller';
const source=await readFile(new URL('../src/services/home-insights.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const timers=new Set();let timeoutCallback;
function client(fetcher){const exports={};new Function('exports','require','AbortController','AbortSignal','fetch','setTimeout','clearTimeout',code)(exports,()=>({API_URL:'https://dit-hjem-five.vercel.app'}),legacy.AbortController,legacy.AbortSignal,fetcher,callback=>{timeoutCallback=callback;const id={};timers.add(id);return id;},id=>timers.delete(id));return exports;}
assert.equal(typeof legacy.AbortSignal.timeout,'undefined');
let calls=0;
const api=client(async(url,options)=>{calls++;assert.ok(options.signal instanceof legacy.AbortSignal);const mode=new URL(url).searchParams.get('mode');return {ok:true,json:async()=>mode==='geometry'?{addressId:'fixture',parcels:[],buildings:[],bbox:[1,2,3,4]}:mode==='air'?{readings:[]}:{status:'access_not_configured',labels:[]}};});
await Promise.all([api.homeInsight('geometry',{id:'fixture'}),api.homeInsight('geometry',{id:'fixture'})]);assert.equal(calls,1);assert.equal(timers.size,0);
await api.homeInsight('geometry',{id:'fixture'});assert.equal(calls,1);
await api.homeInsight('geometry',{id:'fixture'},true);assert.equal(calls,2);
await api.homeInsight('air',{id:'fixture'});await api.homeInsight('energy-label',{buildingId:'fixture'});assert.equal(timers.size,0);
for(const response of [{ok:false},{ok:true,json:async()=>[]},{ok:true,json:async()=>{throw Error('bad JSON');}}]){const c=client(async()=>response);await assert.rejects(c.homeInsight('air',{id:'fixture'}));assert.equal(timers.size,0);}
const timeoutClient=client(async(_,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted')))));
const request=timeoutClient.homeInsight('air',{id:'fixture'});timeoutCallback();await assert.rejects(request,/aborted/);assert.equal(timers.size,0);
if(process.argv.includes('--live')){
 // Node fetch requires Node's own signal; bridge only the test transport.
 const live=client(async(url,options)=>{const controller=new AbortController();const abort=()=>controller.abort();options.signal.addEventListener('abort',abort);try{return await fetch(url,{...options,signal:controller.signal});}finally{options.signal.removeEventListener('abort',abort);}});
 const id='0a3f50b7-b15d-32b8-e044-0003ba298018';
 const geometry=await live.homeInsight('geometry',{id});assert.equal(geometry.parcels[0].registeredArea,754);assert.ok(geometry.buildings.some(b=>b.main));
 const air=await live.homeInsight('air',{id});assert.equal(air.readings.filter(r=>r.status==='available').length,4);
 const label=await live.homeInsight('energy-label',{buildingId:'d61f8bf0-332a-4c90-b293-cadcafdcf436'});assert.equal(label.status,'access_not_configured');
 assert.equal(timers.size,0);
}
console.log('PASS: actual client with React Native AbortController, requests, cache, retry, failure cleanup, timeout'+(process.argv.includes('--live')?' and deployed geometry/air/energy contracts':''));
