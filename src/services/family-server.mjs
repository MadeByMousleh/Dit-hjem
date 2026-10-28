import {createSupabaseContext} from '@supabase/server';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields=['address','addressId','addressX','addressY','municipalityCode','postcode','gridSupplierId','gridSupplierName','wasteCalendarUrl'];
const fail=(status,error)=>({status,body:{error}});
const resendKey=env=>env.RESEND_API_KEY||env.resend||env.RESEND;
export function sharedHomeProfile(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid home');
 const result=Object.fromEntries(fields.filter(key=>value[key]!==undefined).map(key=>[key,value[key]]));
 if(!uuid.test(result.addressId??'')||typeof result.address!=='string'||!result.address.trim()||result.address.length>300||!Number.isFinite(result.addressX)||!Number.isFinite(result.addressY))throw Error('Invalid address');
 for(const [key,val] of Object.entries(result))if(!['addressX','addressY'].includes(key)&&(typeof val!=='string'||val.length>2000))throw Error('Invalid home value');
 return result;
}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function sendFamilyInvitation({email,householdId,name},env=process.env,fetcher=fetch){
 if(!resendKey(env)||!env.EMAIL_FROM)throw Error('Mailafsender er ikke aktiveret endnu.');
 const url='https://huslyg.dk/family.html?home='+encodeURIComponent(householdId);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetcher('https://api.resend.com/emails',{method:'POST',signal:controller.signal,headers:{Authorization:'Bearer '+resendKey(env),'Content-Type':'application/json'},body:JSON.stringify({from:env.EMAIL_FROM,to:[email],subject:'Du er inviteret til familiens hjem i Huslyg',text:`${name} har inviteret dig til familiens hjem i Huslyg. Åbn invitationen: ${url}\nI deler boligoplysninger, forbrug og fælles plantegninger. Du beholder din egen konto; navn og e-mail vises i familiens medlemsoversigt.\nHar du ikke appen, kan du hente Android-appen fra siden. Log ind med denne e-mailadresse, og accepter for at få adgang. Invitationen gælder i 7 dage.\nHvis invitationen ikke er til dig, skal du ikke acceptere. Spørgsmål: info@huslyg.dk.`,html:`<p>${escape(name)} har inviteret dig til familiens hjem i Huslyg.</p><p>I deler boligoplysninger, forbrug og fælles plantegninger. Du beholder din egen konto; navn og e-mail vises i familiens medlemsoversigt.</p><p><a href="${escape(url)}">Åbn invitationen eller hent Android-appen</a></p><p>Log ind med den e-mailadresse, denne invitation er sendt til, og accepter for at få adgang. Invitationen gælder i 7 dage.</p><p>Hvis invitationen ikke er til dig, skal du ikke acceptere. Spørgsmål: <a href="mailto:info@huslyg.dk">info@huslyg.dk</a>.</p>`})});
  if(!response.ok)throw Error('Invitationen kunne ikke sendes. Prøv igen senere.');
 }finally{clearTimeout(timer);}
}
export async function familyResponse(request,body,{contextFactory=createSupabaseContext,env=process.env,sendMail=sendFamilyInvitation}={}){
 try{
  if(request.method!=='POST')return fail(405,'Method not allowed');
  if(!request.headers.get('authorization')?.startsWith('Bearer '))return fail(401,'Log ind igen.');
  if(!env.SUPABASE_URL)return fail(503,'Familiedeling er endnu ikke aktiveret.');
  const {data:ctx,error}=await contextFactory(request,{auth:'user',audience:'authenticated',issuer:env.SUPABASE_URL.replace(/\/$/,'')+'/auth/v1'});
  if(error||!ctx?.userClaims?.id)return fail(401,'Log ind igen.');
  if(!uuid.test(body?.householdId??'')||!['list','invite','profile','revoke','remove'].includes(body.action))return fail(400,'Ugyldig familiehandling.');
  const args={p_home:body.householdId,p_actor:ctx.userClaims.id,p_action:body.action};
  if(['invite','revoke'].includes(body.action)){
   if(typeof body.email!=='string'||body.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))return fail(400,'Indtast en gyldig e-mail.');
   args.p_email=body.email.trim().toLowerCase();
  }
  if(body.action==='remove'){if(!uuid.test(body.userId??''))return fail(400,'Ugyldigt medlem.');args.p_target=body.userId;}
  if(body.action==='profile'){try{args.p_profile=sharedHomeProfile(body.profile);}catch{return fail(400,'Vælg en præcis boligadresse først.');}}
  // All membership/role checks and mutations are locked inside the service-only RPC.
  if(body.action==='invite'&&(!resendKey(env)||!env.EMAIL_FROM))return fail(503,'Mailafsender til familieinvitationer er endnu ikke aktiveret.');
  const result=await ctx.supabaseAdmin.rpc('family_manage',args);
  if(result.error)return fail(result.error.code==='42501'?403:result.error.code==='54000'?429:result.error.code==='23505'?409:503,result.error.code==='42501'?'Kun en administrator kan ændre familien.':result.error.code==='54000'?'Vent et minut mellem invitationer. Der kan højst være 10 personer i hjemmet.':result.error.code==='23505'?'Personen er allerede medlem.':'Familiedeling kunne ikke gennemføres.');
  if(body.action==='invite'){
   const actor=result.data.members.find(m=>m.id===ctx.userClaims.id);
   try{await sendMail({email:args.p_email,householdId:body.householdId,name:actor?.name||'Et familiemedlem'},env);}
   catch{
    await ctx.supabaseAdmin.rpc('family_manage',{...args,p_action:'failed'});
    return fail(502,'Invitationen blev ikke sendt. Prøv igen senere.');
   }
   const sent=await ctx.supabaseAdmin.rpc('family_manage',{...args,p_action:'sent'});
   if(sent.error)return fail(503,'Mailen er sendt, men adgangen kunne ikke aktiveres. Prøv igen om et minut.');
   return {status:200,body:sent.data};
  }
  return {status:200,body:result.data};
 }catch{return fail(503,'Familiedeling kunne ikke gennemføres. Prøv igen.');}
}
