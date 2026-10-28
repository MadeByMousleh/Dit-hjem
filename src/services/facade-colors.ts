import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_URL,getSupabase} from './supabase';
export type WallColorPatch={id:string;buildingId:string;faceId:string;viewId:string;year:string;pixels:number;width:number;height:number;image:string;contextImage?:string;contextSize?:[number,number];contextCrop?:[number,number,number,number];samplingVersion?:2;maskRuns?:number[][];photoKey?:string;quality?:{accepted:boolean;reason?:string|null;margin?:number}};
export type WallColorRegion={color:string;faceIds:string[];patchIds:string[];confidence:'low'|'medium';material:string};
export type WallColorAnalysis={version:1;method?:'original-pixels-v2';buildings:{id:string;uniform:boolean;regions:WallColorRegion[]}[];note:string};
export async function analyzeWallColors(patches:WallColorPatch[],householdId:string,addressId:string,refresh=false):Promise<WallColorAnalysis>{
 const client=await getSupabase(),{data}=await client.auth.getSession();if(!data.session)throw Error('Log ind igen.');
 // User + household + address + actual masked image content prevent cross-house reuse.
 let hash=2166136261;for(const p of patches)for(const c of JSON.stringify(p))hash=Math.imul(hash^c.charCodeAt(0),16777619);
 const key=`wall-colors-pixels-v2:${data.session.user.id}:${householdId}:${addressId}`;
 const saved=refresh?null:await AsyncStorage.getItem(key).catch(()=>null);if(saved){try{const cached=JSON.parse(saved);if(saved.length<100000&&cached.signature===(hash>>>0)&&cached.expires>Date.now()&&cached.analysis?.version===1&&Array.isArray(cached.analysis.buildings))return cached.analysis;}catch{}}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),58000);
 try{
 const r=await fetch(`${API_URL}/api/energy/vault`,{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({operation:'wall-colors',householdId,addressId,patches}),signal:controller.signal});
 const result=await r.json();if(!r.ok||result.analysis?.version!==1)throw Error(result.error||'Facadefarven kunne ikke analyseres.');
 if(result.analysis.method!=='original-pixels-v2')throw Error('Den nye murstensanalyse er endnu ikke klar på serveren.');
 await AsyncStorage.setItem(key,JSON.stringify({signature:hash>>>0,expires:Date.now()+30*86400000,analysis:result.analysis})).catch(()=>{});return result.analysis;
 }finally{clearTimeout(timer);}
}
