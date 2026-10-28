import {useEffect,useState} from 'react';
import {useEnergyVault} from '../components/EnergyVaultGate';
import {subscribePrivateElectricity} from '../services/private-electricity';
import {eligibleThrough,daysBetween} from '../services/electricity-periods.mjs';
import {expectedIntervals} from '../services/consumption-data.mjs';
import {electricityPriceShare,type PriceShare} from '../services/electricity-price-share.mjs';
import {getSupabase} from '../services/supabase';
import {loadProfile} from '../services/storage';
import type {GridSupplier} from '../prices';

export function useElectricityPriceShare(supplier:GridSupplier,now:number){
 const vault=useEnergyVault(),to=eligibleThrough(now),[result,setResult]=useState<PriceShare|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[archiveUnavailable,setArchiveUnavailable]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{
  let alive=true,generation=0,timer:ReturnType<typeof setTimeout>|undefined;
  const controller=new AbortController();
  let priceCache:Parameters<typeof electricityPriceShare>[1]|undefined;
  setResult(null);
  async function load(){
   const run=++generation;setLoading(true);setError('');setArchiveUnavailable(false);
   try{
    const profile=await loadProfile(vault.userId);
    if(!supplier.id||(!supplier.meterVerified&&!supplier.evidenceSource&&profile?.gridSupplierId!==supplier.id))throw Error('Vælg og gem dit netselskab i profilen, så vi bruger det rigtige prisområde.');
    const begin=new Date(to+'T12:00:00Z');begin.setUTCDate(begin.getUTCDate()-30);const from=begin.toISOString().slice(0,10);
    const records=await vault.loadElectricityRecords(daysBetween(from,to).map(day=>'hour/'+day));
    if(!priceCache){
     const intervals=expectedIntervals(from,to,'hour'),client=await getSupabase(),rows:Parameters<typeof electricityPriceShare>[1]=[];
     for(let offset=0;offset<4000;offset+=1000){
      if(!alive||run!==generation)return;
      const {data,error:queryError}=await client.from('spot_price_archive').select('price_area,starts_at,ends_at,price_dkk_mwh').eq('price_area',supplier.area).gte('starts_at',intervals[0]!.starts_at).lt('starts_at',intervals[intervals.length-1]!.ends_at).order('starts_at').range(offset,offset+999).abortSignal(controller.signal);
      if(queryError){
       if(['42P01','PGRST205'].includes(queryError.code)){
        if(alive&&run===generation){setArchiveUnavailable(true);setResult(null);}return;
       }
       throw Error('Vi kunne ikke hente dine data lige nu. Kortet opdateres, når forbindelsen er tilbage.');
      }
      rows.push(...data??[]);if((data?.length??0)<1000)break;
     }
     if(alive&&run===generation&&rows.length)priceCache=rows;
     if(alive&&run===generation)setResult(electricityPriceShare(records,rows,{from,to,area:supplier.area}));
    }else if(alive&&run===generation)setResult(electricityPriceShare(records,priceCache,{from,to,area:supplier.area}));
   }catch(e){if(alive&&run===generation){setResult(null);setError(e instanceof Error?e.message:'Andelene kunne ikke beregnes.');}}
   finally{if(alive&&run===generation)setLoading(false);}
  }
  void load();
  const unsubscribe=subscribePrivateElectricity(vault,()=>{clearTimeout(timer);timer=setTimeout(()=>void load(),1200);});
  return()=>{alive=false;controller.abort();clearTimeout(timer);unsubscribe();};
 },[vault,to,supplier.id,supplier.area,supplier.meterVerified,supplier.evidenceSource,revision]);
 return {result,loading,error,archiveUnavailable,refresh:()=>setRevision(v=>v+1)};
}
