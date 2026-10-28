import {API_URL,getSupabase} from './supabase';
import {loadProfile,type StoredProfile} from './storage';
export type FamilyState={householdId:string;name:string;home:Partial<StoredProfile>;canManage:boolean;members:{id:string;name:string;email:string;role:'owner'|'member'}[];invitations:{email:string;expiresAt:string;delivery:'pending'|'sent'|'failed'}[]};
export async function familyRequest(householdId:string,action:string,extra:Record<string,unknown>={}):Promise<FamilyState>{
 const client=await getSupabase(),{data:{session}}=await client.auth.getSession();
 if(!session)throw Error('Log ind igen.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 try{
  const response=await fetch(API_URL+'/api/energy/vault',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({...extra,operation:'family',householdId,action})});
  const value=await response.json();if(action==='list'&&[400,404,405].includes(response.status))throw Error('Familiedeling er klar i appen og afventer aktivering p\u00e5 serveren.');if(!response.ok)throw Error(value.error||'Familiedeling kunne ikke hentes.');return value;
 }finally{clearTimeout(timer);}
}
export async function syncFamilyHome(householdId:string,userId:string){return familyRequest(householdId,'profile',{profile:await loadProfile(userId)});}
export function invitedHome(url:string):string|null{
 try{const value=new URL(url);if(!(value.protocol==='stromblik:'&&value.hostname==='family')&&!(value.protocol==='https:'&&['huslyg.dk','dit-hjem-five.vercel.app'].includes(value.hostname)&&['/family.html','/'].includes(value.pathname)))return null;const id=value.searchParams.get('home');return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id??'')?id:null;}catch{return null;}
}
