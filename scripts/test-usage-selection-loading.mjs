import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const slots=[],pendingEffects=[],timers=new Map(),requests=[];
let cursor=0,timerId=0,individualReads=0,aggregation='Day',anchor='2026-09-01';
const usage=selection=>({...selection,points:[{at:'2026-09-01T12:00:00Z',kwh:1}],availableYears:[2026]});
const vault={data:{meters:[]}},auth={householdId:'synthetic'};
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const react={
 useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},
 useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial});},
 useCallback(fn){return fn;},
 useEffect(effect,deps){const i=cursor++;if(!same(slots[i]?.deps,deps))pendingEffects.push(()=>{slots[i]?.cleanup?.();slots[i]={deps,cleanup:effect()};});},
};
const dependencies={react,
 'react-native':{AppState:{addEventListener:()=>({remove(){}})}},
 './useHouseholdSession':{useHouseholdSession:()=>auth},
 '../components/EnergyVaultGate':{useEnergyVault:()=>vault},
 './useElectricityAgreements':{useElectricityAgreements:()=>({records:[]})},
 './useMeterConnection':{useMeterConnection:()=>({connected:true,refresh(){}})},
 './useDashboardViewState':{useDashboardViewState:()=>({electricAggregation:aggregation,electricAnchor:anchor,setElectricAggregation:value=>{aggregation=value;},setElectricAnchor:value=>{anchor=value;}})},
 '../utils/usagePeriods':{usageToday:()=> '2026-10-28',usagePeriod:(aggregation,from)=>({aggregation,from,to:'2026-11-01'})},
 '../services/electricity-cache.mjs':{nextElectricitySyncAt:()=>Date.now()+3600000},
 '../services/private-electricity':{
  cachedPrivateUsage:(_,selection)=>usage(selection),subscribePrivateElectricity:()=>()=>{},privateImportStatus:()=>({}),
  privateUsage:async(_,selection)=>{individualReads++;return {...usage(selection),tag:'manual'};},
  privateUsageBatch:(_,selections)=>new Promise(resolve=>requests.push({selections,resolve:tag=>resolve(selections.map(s=>({...usage(s),tag})))})),
 },
};
const code=ts.transpileModule(readFileSync('src/hooks/useElectricityUsage.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};vm.runInNewContext(code,{exports,Date,require:name=>{assert.ok(name in dependencies,name);return dependencies[name];},setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)});
function render(){cursor=0;const result=exports.useElectricityUsage(true);while(pendingEffects.length)pendingEffects.shift()();return result;}
function startLoads(){for(const [id,timer] of timers)if(timer.ms===0){timers.delete(id);timer.fn();}}
let hook=render();startLoads();assert.equal(requests.length,1);
await hook.load('Hour','2026-09-02');assert.equal(individualReads,0,'Selection does not start a competing single-range request');
hook=render();startLoads();assert.equal(requests.length,2,'Exactly one new batch starts after selection');assert.ok(requests[1].selections.some(s=>s.aggregation==='Hour'&&s.from==='2026-09-02'));
requests[1].resolve('new');await new Promise(setImmediate);hook=render();assert.equal(hook.usage.tag,'new');
requests[0].resolve('old');await new Promise(setImmediate);hook=render();assert.equal(hook.usage.tag,'new','Late result cannot overwrite the selected range');
await hook.load();hook=render();assert.equal(individualReads,1,'Explicit same-period refresh still fetches');assert.equal(hook.usage.tag,'manual');
for(const slot of slots)slot?.cleanup?.();assert.equal(timers.size,0);
console.log('PASS: actual usage hook starts one batch per period change, rejects late old results, retains explicit refresh and cleans up timers. Synthetic React/vault/network.');
