import {API_URL,getSupabase} from './supabase';
export type PropertyDocument={id:string;name:string;mime:'application/pdf'|'image/jpeg'|'image/png';revision:number;updated_at:string;payload?:string};
export async function propertyDocuments(householdId:string,addressId:string,action:'list'|'read'|'save'|'delete',body:Record<string,unknown>={},signal?:AbortSignal){
 const client=await getSupabase(),{data}=await client.auth.getSession();if(!data.session)throw Error('Log ind igen.');
 const controller=new AbortController(),abort=()=>controller.abort();if(signal?.aborted)throw Error('Afbrudt');signal?.addEventListener('abort',abort);const timer=setTimeout(abort,45000);
 try{const response=await fetch(`${API_URL}/api/energy/vault`,{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({operation:'property-documents',action,householdId,addressId,...body}),signal:controller.signal});const value=await response.json();if(!response.ok)throw Error(action==='list'&&[400,404,501].includes(response.status)?'Upload af plantegninger er endnu ikke aktiveret.':value.error??'Plantegningen kunne ikke gemmes.');return value as {documents?:PropertyDocument[];document?:PropertyDocument;revision?:number};}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
