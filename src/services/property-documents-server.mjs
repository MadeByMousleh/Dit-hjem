import {createSupabaseContext} from '@supabase/server';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(status,error)=>({status,body:{error}});
export function floorPlanDownloadName(name,mime){
 const extension={'application/pdf':'.pdf','image/png':'.png','image/jpeg':'.jpg'}[mime];
 if(!extension)throw Error('Type');
 const clean=String(name??'Plantegning').replace(/[\x00-\x1f\x7f/\\\u202a-\u202e\u2066-\u2069]/g,'_').trim().replace(/[. ]+$/g,'')||'Plantegning';
 const matching=mime==='image/jpeg'?/\.jpe?g$/i:new RegExp('\\'+extension+'$','i');
 const stem=clean.replace(matching,'');return (stem.slice(0,120-extension.length)||'Plantegning')+extension;
}
export function validateFloorPlan(body){
 if(typeof body.name!=='string'||!body.name.trim()||body.name.length>120||/[\x00-\x1f/\\]/.test(body.name))throw Error('Name');
 if(typeof body.payload!=='string'||body.payload.length>2796204||body.payload.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(body.payload))throw Error('Size');
 const bytes=Buffer.from(body.payload,'base64');if(bytes.length>2097152||bytes.toString('base64')!==body.payload)throw Error('Size');
 const valid=body.mime==='application/pdf'?bytes.subarray(0,5).toString()==='%PDF-':body.mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):body.mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:false;
 if(!valid)throw Error('Type');return {name:floorPlanDownloadName(body.name,body.mime),mime:body.mime,payload:body.payload};
}
export async function propertyDocumentsResponse(request,body,{contextFactory=createSupabaseContext}={}){
 try{
  if(request.method!=='POST')return fail(405,'Method not allowed');
  if(!request.headers.get('authorization')?.startsWith('Bearer '))return fail(401,'Log ind igen.');
  const url=process.env.SUPABASE_URL?.replace(/\/$/,'');if(!url)return fail(503,'Plantegninger er endnu ikke tilgængelige.');
  const {data:ctx,error}=await contextFactory(request,{auth:'user',audience:'authenticated',issuer:`${url}/auth/v1`});if(error||!ctx?.userClaims?.id)return fail(401,'Log ind igen.');
  if(!uuid.test(body?.householdId??'')||!uuid.test(body?.addressId??'')||!['list','read','save','delete'].includes(body.action))return fail(400,'Ugyldig plantegning.');
  const member=await ctx.supabase.from('household_members').select('household_id').eq('household_id',body.householdId).eq('user_id',ctx.userClaims.id).maybeSingle();if(member.error)return fail(503,'Adgang kunne ikke kontrolleres.');if(!member.data)return fail(403,'Ingen adgang til husstanden.');
  const query=()=>ctx.supabase.from('property_documents').select('id,name,mime,revision,updated_at'+(body.action==='read'?',payload':'')).eq('household_id',body.householdId).eq('address_id',body.addressId).not('payload','is',null);
  if(body.action==='list'){const result=await query().order('updated_at',{ascending:false});return result.error?fail(503,'Plantegninger er endnu ikke tilgængelige. Prøv igen senere.'):{status:200,body:{documents:result.data}};}
  if(!uuid.test(body.id??''))return fail(400,'Ugyldig plantegning.');
  if(body.action==='read'){const result=await query().eq('id',body.id).maybeSingle();return result.error?fail(503,'Plantegningen kunne ikke hentes.'):result.data?{status:200,body:{document:{...result.data,name:floorPlanDownloadName(result.data.name,result.data.mime)}}}:fail(404,'Plantegningen findes ikke længere.');}
  if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)return fail(400,'Ugyldig revision.');
  let file;try{file=body.action==='save'?validateFloorPlan(body):{name:'Slettet plantegning',mime:'application/pdf',payload:null};}catch{return fail(400,'Vælg en PDF, JPG eller PNG på højst 2 MB.');}
  const result=await ctx.supabaseAdmin.rpc('save_property_document',{p_household:body.householdId,p_address:body.addressId,p_id:body.id,p_actor:ctx.userClaims.id,p_expected:body.expectedRevision,p_name:file.name,p_mime:file.mime,p_payload:file.payload});
  if(result.error)return fail(result.error.code==='40001'?409:result.error.code==='54000'?413:503,result.error.code==='40001'?'Plantegningen er ændret. Genindlæs listen.':result.error.code==='54000'?'Der er ikke plads til flere plantegninger. Slet en gammel først.':'Plantegningen kunne ikke gemmes.');
  return {status:200,body:{revision:result.data}};
 }catch{return fail(503,'Plantegningen kunne ikke behandles.');}
}
