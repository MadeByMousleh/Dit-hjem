import {useEffect,useState} from 'react';
import {useEnergyVault} from '../components/EnergyVaultGate';
import {privateMeterGrid,privateMeterStatus} from '../services/private-electricity';
import {loadProfile,subscribeProfileChanges} from '../services/storage';
import {API_URL} from '../services/supabase';
import {readHomeDetail,saveHomeDetail} from '../services/home-overview-cache';
import {resolveMeterSupplier,type MeterGridEvidence} from '../utils/meter-grid';
import type {GridSupplier} from '../prices';
import {matchAddressSupplier} from '../services/grid-supplier-match.mjs';
const gridByBoundaryId:Record<string,string>={'3159':'n1_c','3220':'n1_344','3167':'trefor_el-net_c','3596':'trefor_el-net_oest_c','3100':'radius_c','3592':'radius_c','3143':'cerius_c','3544':'cerius_c','3558':'cerius_c','3559':'cerius_c'};
const company=(s:string)=>s.toLowerCase().replace(/\s*-\s*\d+$/,'').replace(/\ba\s*\/\s*s\b/g,'').replace(/[^a-z0-9æøå]/g,'');
type Vault=ReturnType<typeof useEnergyVault>;
const sessions=new WeakMap<Vault,Map<string,Promise<GridSupplier>>>();
export function resetGridSupplierResolution(vault:Vault){sessions.delete(vault);}
export function useResolvedGridSupplier(suppliers:GridSupplier[],_candidate:string){
 const vault=useEnergyVault(),[revision,setRevision]=useState(0),[snapshot,setSnapshot]=useState<{vault:Vault;supplier:GridSupplier}|null>(null);
 useEffect(()=>subscribeProfileChanges(userId=>{if(!userId||userId===vault.userId)setRevision(v=>v+1);}),[vault.userId]);
 useEffect(()=>{
  let alive=true;
  void(async()=>{
   const profile=await loadProfile(vault.userId);if(!alive)return;
   const manual=profile?.gridSupplierOverrideId;
   const chosen=manual?suppliers.find(s=>s.id===manual):undefined;
   if(chosen){setSnapshot({vault,supplier:{...chosen,meterVerified:false,evidenceSource:'Selvvalgt netselskab'}});return;}
   if(manual){setSnapshot({vault,supplier:{id:'',name:'Netselskab utilg\u00e6ngeligt',area:'DK1',resolutionIssue:'Dit valgte netselskab findes ikke i prislisten. V\u00e6lg et andet eller gendan dit netselskab.'}});return;}
   const key=JSON.stringify([profile?.addressId,profile?.addressX,profile?.addressY,suppliers.map(s=>s.id)]);
   let cache=sessions.get(vault);if(!cache){cache=new Map();sessions.set(vault,cache);}
   let request=cache.get(key);
   if(!request){setSnapshot(null);request=resolve();cache.set(key,request);request.catch(()=>cache!.delete(key));}
   const supplier=await request;if(alive)setSnapshot({vault,supplier});
   async function resolve():Promise<GridSupplier>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
    function fail(message:string):never{throw Error(message);}
    try{
   if(!profile?.addressId){fail('Vælg en præcis boligadresse for at beregne korrekte priser.');}
   const status=await privateMeterStatus(vault);
   if(status.connected){
    await vault.loadElectricityRecords(['state/import']);
    let evidence=vault.cachedElectricityRecord('state/import')?.gridEvidence as MeterGridEvidence|undefined;
    const age=evidence?Date.now()-Date.parse(evidence.checkedAt):Infinity;
    if(!evidence||evidence.version!==1||!Array.isArray(evidence.meters)||age<0||age>15*60000){
     const value=await privateMeterGrid(vault);
     if(!Array.isArray(value.meters)||!Number.isFinite(Date.parse(value.checkedAt)))throw Error('Ugyldige netselskabsoplysninger.');
     evidence={version:1,checkedAt:value.checkedAt,meters:value.meters};
     const snapshot=evidence;
     await vault.mutateElectricityRecords(['state/import'],latest=>({'state/import':{...(latest['state/import']??{v:1,meters:[],gaps:{}}),gridEvidence:snapshot}}));
    }

    const match=resolveMeterSupplier(evidence.meters,profile.addressId,suppliers);
    if(!match.supplier){fail(match.reason??'Målerens netselskab kunne ikke matches sikkert.');}
    return ({...match.supplier,meterVerified:true,evidenceSource:'Bekræftet via Eloverblik · privatkundetarif C'});
   }
   if(!Number.isFinite(profile.addressX)||!Number.isFinite(profile.addressY)){fail('Adressen mangler oplysninger til netselskabsopslag.');}
   const cacheKey='grid-supplier-v1:'+profile.addressId+':'+profile.addressX+':'+profile.addressY;
   let grid=await readHomeDetail<{name:string;cvr:string}>(cacheKey);
   if(!grid){const r=await fetch(API_URL+'/api/grid/lookup?'+new URLSearchParams({x:String(profile.addressX),y:String(profile.addressY)}),{signal:controller.signal});if(!r.ok)throw Error('Netselskabet kunne ikke findes fra adressen.');grid=await r.json();if(!grid?.name||!grid.cvr)throw Error('Ugyldigt netselskabsopslag.');void saveHomeDetail(cacheKey,grid);}

   const match=matchAddressSupplier(grid,suppliers);
   if(!match){fail('Adresseopslaget har ikke ét sikkert tarifmatch. Forbind Eloverblik.');}
   return ({...match,meterVerified:false,evidenceSource:'Adresseopslag · privatkundetarif C'});

    }finally{clearTimeout(timer);}
   }
  })().catch(e=>{if(alive)setSnapshot({vault,supplier:{id:'',name:'Netselskab ikke afklaret',area:'DK1',resolutionIssue:e instanceof Error?e.message:'Netselskabet kunne ikke afklares.'}});});
  return()=>{alive=false;};
 },[vault,suppliers,revision]);
 return snapshot?.vault===vault?snapshot.supplier:null;
}
