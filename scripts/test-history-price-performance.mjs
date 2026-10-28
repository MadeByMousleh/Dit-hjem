import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

let now=Date.parse('2026-10-28T12:00:00Z'),reads=0,calls=0,fail=false,responsePoints=1;
class Clock extends Date {static now(){return now;}}
const disk=new Map();
const storage={getItem:async key=>{reads++;return disk.get(key)??null;}};
const dependencies={
 '@react-native-async-storage/async-storage':{default:storage},
 './services/local-storage-cache.mjs':{writeOptionalCache:async(_,key,value)=>{disk.set(key,value);}},
 './services/supabase':{API_URL:'https://synthetic.invalid'},
 './services/energinet-tariff-catalog.mjs':{ENERGINET_GRID_SUPPLIERS:[]},
};
const code=ts.transpileModule(readFileSync('src/prices.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function restart(){const exports={};vm.runInNewContext(code,{exports,require:name=>{assert.ok(name in dependencies,name);return dependencies[name];},Date:Clock,URLSearchParams,AbortController,setTimeout,clearTimeout,fetch:async url=>{calls++;if(fail)throw Error('offline');const q=new URL(url).searchParams;return {ok:true,json:async()=>({source:{id:'energinet-v1'},points:Array.from({length:responsePoints},(_,i)=>({startsAt:new Clock(Date.parse(q.get('from'))+i*900000).toISOString(),priceDkkMwh:800,totalOrePerKwh:150,gridAndTaxOrePerKwh:50}))})};}});return exports;}
let prices=restart();
const load=(supplier='fixture',area='DK1',from='2026-09-01T00:00:00Z',to='2026-10-01T00:00:00Z')=>prices.fetchHistoricalPrices(area,supplier,from,to);
const [a,b]=await Promise.all([load(),load()]);assert.equal(a,b);assert.equal(calls,1);assert.equal(reads,1);
const warm=await load();assert.equal(warm,a);assert.equal(reads,1,'Warm screen reopen avoids disk read/JSON decode/date rehydration');assert.equal(calls,1);
await load('other');await load('fixture','DK2');assert.equal(calls,3,'Supplier and price area stay isolated');
now+=7*86400000;await load();assert.equal(calls,4,'Historical entry expires at seven days');
const recentFrom=new Clock(now-86400000).toISOString(),recentTo=new Clock(now).toISOString();
await load('recent','DK1',recentFrom,recentTo);const recentCalls=calls;now+=15*60000;await load('recent','DK1',recentFrom,recentTo);assert.equal(calls,recentCalls+1,'Recent history keeps the existing 15-minute TTL');
for(let i=0;i<13;i++)await load('bounded-'+i);
const beforeEvicted=reads;await load('bounded-0');assert.equal(reads,beforeEvicted+1,'Evicted public history falls back to disk');
const beforeRestart=calls;prices=restart();const restored=await load('bounded-0');assert.equal(calls,beforeRestart);assert.equal(typeof restored[0].startsAt.getTime(),'number');
fail=true;await assert.rejects(load('retry'));fail=false;await load('retry');
responsePoints=4000;for(let i=0;i<11;i++)await load('bulky-'+i);
const beforePointBudget=reads;await load('bulky-0');assert.equal(reads,beforePointBudget+1,'Point budget evicts large payloads even below the entry limit');
console.log('PASS: actual public price loader coalesces requests, avoids warm disk/decoding work, isolates areas/suppliers, expires old/recent ranges, bounds memory, restores dates after restart and retries failures. Synthetic storage/network.');
