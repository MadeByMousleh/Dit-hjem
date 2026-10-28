import {API_URL, getSupabase} from './supabase';
export type DeletionHome = {householdId:string; name:string; role:string; lastMember:boolean; needsSuccessor:boolean; members:{id:string;name:string;role:string}[]};
export async function accountPrivacy(action:'preview'|'delete', extra:Record<string,unknown>={}) {
  const client=await getSupabase(),{data:{session}}=await client.auth.getSession();
  if(!session)throw Error('Log ind igen.');
  const response=await fetch(API_URL+'/api/energy/vault',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({operation:'account-privacy',action,...extra}),signal:AbortSignal.timeout(30000)});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'Kontohandlingen kunne ikke gennemføres.');
  return result as {homes?:DeletionHome[];deleted?:boolean};
}
