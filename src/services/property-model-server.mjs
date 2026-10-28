import {createSupabaseContext} from '@supabase/server';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(status,error)=>({status,body:{error}});
export function validateModelPayload(payload,addressId){
 if(typeof payload!=='string'||payload.length>3900000||payload.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(payload))throw Error('Invalid payload');
 const raw=gunzipSync(Buffer.from(payload,'base64'),{maxOutputLength:32*1024*1024}),model=JSON.parse(raw);
 if(model.version!==1||model.addressId!==addressId||model.geometry?.addressId!==addressId||!Number.isFinite(model.createdAt)||!model.scene||!Array.isArray(model.scene.buildings)||model.scene.buildings.length>2000)throw Error('Invalid model');
 const geometry=g=>{if(!g||!g.attributes?.position||!Object.entries(g.attributes).every(([name,a])=>['position','normal','uv','color'].includes(name)&&[2,3].includes(a.size)&&Array.isArray(a.values)&&a.values.length<=4000000&&a.values.length%a.size===0&&a.values.every(v=>Number.isFinite(v)&&Math.abs(v)<1e8)))throw Error('Invalid geometry');const count=g.attributes.position.values.length/3;if(g.attributes.position.size!==3||!Object.values(g.attributes).every(a=>a.values.length/a.size===count)||g.index!==null&&(!Array.isArray(g.index)||g.index.length>4000000||g.index.some(i=>!Number.isInteger(i)||i<0||i>=count)))throw Error('Invalid indices');};
 geometry(model.scene.floor);if(model.scene.environment)geometry(model.scene.environment);if(model.scene.terrain){geometry(model.scene.terrain.geometry);geometry(model.scene.terrain.contours);}for(const b of model.scene.buildings){geometry(b.geometry);if(!/^#[0-9a-f]{6}$/i.test(b.color))throw Error('Invalid material');}
 if(!Number.isFinite(model.scene.origin)||Math.abs(model.scene.origin)>10000||!Array.isArray(model.scene.weatherCeiling)||model.scene.weatherCeiling.length!==625||!model.scene.weatherCeiling.every(v=>Number.isFinite(v)&&v>=0&&v<10000))throw Error('Invalid weather ceiling');
 if(model.environment&&model.environment.geometry?.addressId!==addressId||model.heights&&model.heights.addressId!==addressId)throw Error('Wrong address');
 const image=s=>s===null||typeof s==='string'&&s.length<=4000000&&/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(s);
 if(!image(model.texture)||model.environment&&!image(model.environment.texture)||!model.scene.colors||!Array.isArray(model.scene.automatic)||model.scene.automatic.length>500||!Array.isArray(model.facades)||model.facades.length>60)throw Error('Invalid assets');
 return {digest:createHash('sha256').update(raw).digest('hex'),rawBytes:raw.length};
}
export async function propertyModelResponse(request,body,{contextFactory=createSupabaseContext}={}){
 try{
  if(request.method!=='POST')return fail(405,'Method not allowed');if(!request.headers.get('authorization')?.startsWith('Bearer '))return fail(401,'Log ind igen.');
  const url=process.env.SUPABASE_URL?.replace(/\/$/,'');if(!url)return fail(503,'Husmodeller er ikke konfigureret.');
  const {data:ctx,error}=await contextFactory(request,{auth:'user',audience:'authenticated',issuer:`${url}/auth/v1`});if(error||!ctx?.userClaims?.id)return fail(401,'Log ind igen.');
  if(!uuid.test(body?.householdId??'')||!uuid.test(body?.addressId??'')||!['read','save'].includes(body.action))return fail(400,'Ugyldig husmodel.');
  const member=await ctx.supabase.from('household_members').select('household_id').eq('household_id',body.householdId).eq('user_id',ctx.userClaims.id).maybeSingle();if(member.error)return fail(503,'Adgang kunne ikke kontrolleres.');if(!member.data)return fail(403,'Ingen adgang til husstanden.');
  if(body.action==='read'){const result=await ctx.supabase.from('property_models').select('revision,payload,digest,updated_at').eq('household_id',body.householdId).eq('address_id',body.addressId).maybeSingle();if(result.error)return fail(503,'Gemte husmodeller er endnu ikke tilgængelige.');return {status:200,body:{model:result.data}};}
  let checked;try{checked=validateModelPayload(body.payload,body.addressId);if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)throw Error();}catch{return fail(400,'Ugyldig eller for stor husmodel.');}
  const result=await ctx.supabaseAdmin.rpc('save_property_model',{p_household:body.householdId,p_address:body.addressId,p_actor:ctx.userClaims.id,p_expected:body.expectedRevision,p_payload:body.payload,p_digest:checked.digest,p_raw_bytes:checked.rawBytes});
  if(result.error)return fail(result.error.code==='40001'?409:503,result.error.code==='40001'?'Husmodellen er blevet opdateret på en anden enhed.':'Husmodellen kunne ikke gemmes.');
  return {status:200,body:{revision:result.data}};
 }catch{return fail(503,'Husmodellen kunne ikke behandles.');}
}
