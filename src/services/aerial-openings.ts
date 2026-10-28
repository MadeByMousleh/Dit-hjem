import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_URL,getSupabase} from './supabase';
import type {HomeModelPhotos} from './home-insights';
export type WallOpening={kind:'window'|'door'|'garage';wallId:string;p0:[number,number];p1:[number,number];z0:number;z1:number;confidence:number;support:number};
export type AerialOpenings={version:1;views:{viewId:string;openings:{kind:'window'|'door'|'garage';quad:[number,number][];confidence:number;frameColor:string;panelColor:string}[]}[];method?:string;walls?:WallOpening[]};
const MULTIVIEW_TTL=30*86400000;
const validWall=(o:unknown):o is WallOpening=>{
 const w=o as WallOpening;
 return !!w&&['window','door','garage'].includes(w.kind)&&[w.p0,w.p1].every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))&&[w.z0,w.z1,w.confidence,w.support].every(Number.isFinite)&&w.z1>w.z0;
};
/** Windows/doors fused from every available survey year, in wall coordinates. Null when the backend does not support it or finds nothing. */
async function loadMultiviewOpenings(householdId:string,addressId:string,token:string,userId:string,refresh:boolean):Promise<AerialOpenings|null>{
 const key=`aerial-openings-multiview-v2:${userId}:${householdId}:${addressId}`;
 const raw=refresh?null:await AsyncStorage.getItem(key).catch(()=>null);
 if(raw&&raw.length<200000)try{const cached=JSON.parse(raw);if(Date.now()-cached.at<MULTIVIEW_TTL&&cached.analysis?.walls?.length)return cached.analysis;}catch{/* refetch */}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),58000);
 try{
  const r=await fetch(`${API_URL}/api/energy/vault`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({operation:'aerial-openings-multiview',householdId,addressId}),signal:controller.signal});
  if(!r.ok)return null;
  const result=await r.json(),walls=Array.isArray(result.analysis?.walls)?result.analysis.walls.filter(validWall):[];
  if(result.analysis?.method!=='multiview-v1'||!walls.length)return null;
  const analysis:AerialOpenings={version:1,views:[],method:'multiview-v1',walls};
  await AsyncStorage.setItem(key,JSON.stringify({at:Date.now(),analysis})).catch(()=>{});
  return analysis;
 }catch{return null;}finally{clearTimeout(timer);}
}
export async function loadAerialOpenings(photos:HomeModelPhotos,householdId:string,refresh=false):Promise<AerialOpenings>{
 const client=await getSupabase(),{data}=await client.auth.getSession();if(!data.session)throw Error('Log ind igen.');
 const fused=await loadMultiviewOpenings(householdId,photos.addressId,data.session.access_token,data.session.user.id,refresh);if(fused)return fused;
 const patches=photos.photos.map((p,i)=>({id:`photo-${i}`,viewId:`photo-${i}`,buildingId:'property',faceId:'photo',year:p.capturedAt.slice(0,4),pixels:p.width*p.height,width:p.width,height:p.height,image:p.image.replace(/^data:image\/jpeg;base64,/,''),direction:p.direction})).filter(p=>p.direction!=='nadir').slice(0,8);
 if(patches.length<2)throw Error('Der mangler skråfotos til vinduesanalysen.');
 let hash=2166136261;for(const c of JSON.stringify(patches))hash=Math.imul(hash^c.charCodeAt(0),16777619);
 const key=`aerial-openings-v1:${data.session.user.id}:${householdId}:${photos.addressId}`,signature=hash>>>0;
 const raw=refresh?null:await AsyncStorage.getItem(key).catch(()=>null);if(raw&&raw.length<200000)try{const cached=JSON.parse(raw);if(cached.signature===signature&&cached.analysis?.version===1&&Array.isArray(cached.analysis.views))return cached.analysis;}catch{}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),58000);
 try{const r=await fetch(`${API_URL}/api/energy/vault`,{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({operation:'aerial-openings',householdId,addressId:photos.addressId,patches}),signal:controller.signal}),result=await r.json();if(!r.ok||result.analysis?.version!==1||!Array.isArray(result.analysis.views))throw Error(result.error||'Vinduer og døre kunne ikke aflæses.');await AsyncStorage.setItem(key,JSON.stringify({signature,analysis:result.analysis})).catch(()=>{});return result.analysis;}finally{clearTimeout(timer);}
}
