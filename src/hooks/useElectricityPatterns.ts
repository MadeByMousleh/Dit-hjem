import {useEffect,useState} from 'react';
import {useEnergyVault} from '../components/EnergyVaultGate';
import {subscribePrivateElectricity} from '../services/private-electricity';
import {eligibleThrough} from '../services/electricity-periods.mjs';
import {loadElectricityPatterns,type ElectricityPatterns} from '../services/electricity-patterns.mjs';

const patternSnapshots=new WeakMap<object,{through:string;at:number;result:ElectricityPatterns}>();

export function useElectricityPatterns(now=Date.now()){
 const vault=useEnergyVault(),through=eligibleThrough(now),[result,setResult]=useState<ElectricityPatterns|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[progress,setProgress]=useState(0),[revision,setRevision]=useState(0);
 useEffect(()=>{
  let alive=true,timer:ReturnType<typeof setTimeout>|undefined,current:AbortController|undefined;
  const cached=patternSnapshots.get(vault);
  const fresh=revision===0&&cached?.through===through&&Date.now()-cached.at<60000;
  setResult(fresh?cached!.result:null);setProgress(0);
  async function load(){
   current?.abort();const controller=new AbortController();current=controller;setLoading(true);setError('');
   try{
    let stateLoadFailed=false;try{await vault.loadElectricityRecords(['state/import']);}catch{stateLoadFailed=true;}
    if(controller.signal.aborted||!alive)return;
    const begin=new Date(through+'T12:00:00Z');begin.setUTCFullYear(begin.getUTCFullYear()-1);let from=begin.toISOString().slice(0,10);
    const meters=vault.cachedElectricityRecord('state/import')?.meters??[],bounds=meters.map((meter:{from:string})=>meter.from).filter((date:unknown):date is string=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
    if(bounds[0]&&bounds[0]>from)from=bounds[0];
    if(from>=through){if(alive)setResult(null);return;}
    const value=await loadElectricityPatterns(vault,{from,to:through,signal:controller.signal,onProgress:(loaded,total)=>{if(alive&&!controller.signal.aborted)setProgress(Math.round(loaded/total*100));}});
    if(alive&&!controller.signal.aborted){
     const result={...value,loadFailed:value.loadFailed||stateLoadFailed};setResult(result);
     if(!result.loadFailed)patternSnapshots.set(vault,{through,at:Date.now(),result});
     const baseline=value.baseline;
     if(baseline&&baseline.status!=='insufficient_data'&&!value.loadFailed&&!stateLoadFailed){
      try{await vault.mutateElectricityRecords(['state/import'],latest=>{
       if(!alive||controller.signal.aborted)return {};
       const state=latest['state/import'];if(!state)return {};
       const history=Array.isArray(state.baselineHistory)?state.baselineHistory:[];
       if(history.at(-1)?.to>baseline.to||JSON.stringify(history.at(-1))===JSON.stringify(baseline))return {};
       return {'state/import':{...state,baselineHistory:[...history.filter((row:{to:string})=>row.to!==baseline.to),baseline].slice(-90)}};
      });}catch{if(alive&&!controller.signal.aborted)setError('Grundforbruget er beregnet, men kunne ikke gemmes. Prøv Opdater igen.');}
     }
    }
   }catch(e){if(alive&&!controller.signal.aborted)setError(e instanceof Error?e.message:'Forbrugsmønsteret kunne ikke hentes.');}
   finally{if(alive&&!controller.signal.aborted)setLoading(false);}
  }
  if(fresh)setLoading(false);else timer=setTimeout(()=>void load(),180);
  const unsubscribe=subscribePrivateElectricity(vault,()=>{patternSnapshots.delete(vault);clearTimeout(timer);timer=setTimeout(()=>void load(),1200);});
  return()=>{alive=false;current?.abort();clearTimeout(timer);unsubscribe();};
 },[vault,through,revision]);
 return {result,loading,error,progress,refresh:()=>setRevision(v=>v+1)};
}
