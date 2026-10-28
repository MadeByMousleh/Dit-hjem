import {API_URL,getSupabase} from './supabase';
import {decodePropertyModel,encodePropertyModel,type PropertyModel} from './property-model-format';
export type SavedPropertyModel={revision:number;model:PropertyModel};
async function request(householdId:string,addressId:string,action:string,body:Record<string,unknown>={},signal?:AbortSignal){
 const client=await getSupabase(),{data}=await client.auth.getSession();if(!data.session)throw Error('Log ind igen.');
 const controller=new AbortController(),abort=()=>controller.abort();if(signal?.aborted)throw Error('Afbrudt');signal?.addEventListener('abort',abort);const timer=setTimeout(abort,45000);
 try{const response=await fetch(`${API_URL}/api/energy/vault`,{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({operation:'property-model',action,householdId,addressId,...body}),signal:controller.signal});const result=await response.json();if(!response.ok){const error=new Error(result.error??'Husmodellen kunne ikke hentes.');Object.assign(error,{status:response.status});throw error;}return result;}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export async function loadPropertyModel(householdId:string,addressId:string,signal?:AbortSignal):Promise<SavedPropertyModel|null>{const result=await request(householdId,addressId,'read',{},signal);return result.model?{revision:result.model.revision,model:decodePropertyModel(result.model.payload,addressId)}:null;}
export async function savePropertyModel(householdId:string,model:PropertyModel,expectedRevision:number,signal?:AbortSignal):Promise<number>{const payload=encodePropertyModel(model);const result=await request(householdId,model.addressId,'save',{expectedRevision,payload},signal);return result.revision;}
