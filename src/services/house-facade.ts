import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_URL,getSupabase} from './supabase';
import {validateFacadeAnalysis,type FacadeAnalysis} from './facade-analysis.mjs';
import type {CaptureScope} from './house-capture-store';
import type {HousePhotoFace} from '../utils/house-photo-guide';
import {validateFacadePlacement,type FacadePlacement} from '../utils/facade-placement';
export type FacadeModel={id:string;face:HousePhotoFace;analysis:FacadeAnalysis;placement?:FacadePlacement;anchor?:{base:number;height:number}};
const storageKey=(s:CaptureScope)=>`house-facade-v1:${s.userId}:${s.householdId}:${s.addressId}`;
export async function loadFacades(scope:CaptureScope,faces:HousePhotoFace[]):Promise<FacadeModel[]>{
 const raw=await AsyncStorage.getItem(storageKey(scope));if(!raw)return [];
 try{if(raw.length>200000)return [];const entries=JSON.parse(raw);if(!Array.isArray(entries)||entries.length>60)return [];
 return entries.flatMap(entry=>{const face=faces.find(f=>f.id===entry.faceId);if(!face||typeof entry.id!=='string')return [];try{return [{id:entry.id,face,analysis:validateFacadeAnalysis(entry.analysis),placement:validateFacadePlacement(entry.placement)}];}catch{return [];}});
 }catch{return [];}
}
export async function saveFacades(scope:CaptureScope,models:FacadeModel[]){await AsyncStorage.setItem(storageKey(scope),JSON.stringify(models.map(m=>({id:m.id,faceId:m.face.id,analysis:validateFacadeAnalysis(m.analysis),placement:validateFacadePlacement(m.placement)}))));}
export async function analyzeHouseFacade(image:string,householdId:string):Promise<FacadeAnalysis>{
 const client=await getSupabase(),{data}=await client.auth.getSession();if(!data.session)throw Error('Log ind igen.');
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),58000);
 try{const response=await fetch(`${API_URL}/api/energy/vault`,{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({operation:'facade-analysis',facadeVersion:3,householdId,image}),signal:abort.signal});
 const result=await response.json();if(!response.ok)throw Error(result.error||'Billedanalysen kunne ikke gennemføres.');return validateFacadeAnalysis(result.analysis);
 }finally{clearTimeout(timer);}
}
