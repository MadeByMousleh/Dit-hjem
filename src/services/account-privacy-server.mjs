import {createSupabaseContext} from '@supabase/server';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(status,error)=>({status,body:{error}});

export async function accountPrivacyResponse(request,body,{contextFactory=createSupabaseContext,env=process.env,now=Date.now}={}) {
 try {
  if(request.method!=='POST')return fail(405,'Method not allowed');
  if(!request.headers.get('authorization')?.startsWith('Bearer '))return fail(401,'Log ind igen.');
  if(env.ACCOUNT_DELETION_ENABLED!=='true')return fail(503,'Kontosletning afventer aktivering. Kontakt info@huslyg.dk.');
  if(!env.SUPABASE_URL)return fail(503,'Kontoadgang er ikke konfigureret.');
  const {data:ctx,error}=await contextFactory(request,{auth:'user',audience:'authenticated',issuer:env.SUPABASE_URL.replace(/\/$/,'')+'/auth/v1'});
  if(error||!ctx?.userClaims?.id)return fail(401,'Log ind igen.');
  // Check the live Auth user as well as the JWT, which may outlive a deletion.
  const current=await ctx.supabase.auth.getUser(request.headers.get('authorization').slice(7));
  const user=current.data?.user;
  if(current.error||!user||user.id!==ctx.userClaims.id)return fail(401,'Log ind igen.');
  if(!['preview','delete'].includes(body?.action))return fail(400,'Ugyldig kontohandling.');
  if(body.action==='preview') {
   const memberships=await ctx.supabase.from('household_members').select('household_id,family_role').eq('user_id',user.id);
   if(memberships.error)return fail(503,'Husstandene kunne ikke hentes.');
   const homes=[];
   for(const membership of memberships.data??[]) {
    const members=await ctx.supabaseAdmin.rpc('family_manage',{p_home:membership.household_id,p_actor:user.id,p_action:'list'});
    if(members.error||!Array.isArray(members.data?.members))return fail(503,'Husstandens medlemmer kunne ikke kontrolleres.');
    // No other members' emails, sessions or Auth metadata are returned.
    const others=members.data.members.filter(member=>member.id!==user.id);
    homes.push({householdId:membership.household_id,name:members.data.name,role:membership.family_role,lastMember:others.length===0,
     needsSuccessor:membership.family_role==='owner'&&others.length>0&&!others.some(member=>member.role==='owner'),
     members:others.map(member=>({id:member.id,name:member.name,role:member.role}))});
   }
   return {status:200,body:{homes}};
  }
  if(body.confirmation!=='SLET MIN KONTO')return fail(400,'Bekræft sletningen ved at skrive SLET MIN KONTO.');
  const signedIn=Date.parse(user.last_sign_in_at??'');
  if(!user.email_confirmed_at||!Number.isFinite(signedIn)||signedIn>now()+30000||now()-signedIn>10*60000)return fail(403,'Log ind igen med en ny kode, før du sletter kontoen.');
  const successors=body.successors??{};
  if(!successors||typeof successors!=='object'||Array.isArray(successors)||Object.keys(successors).length>20||Object.entries(successors).some(([home,member])=>!uuid.test(home)||typeof member!=='string'||!uuid.test(member)))return fail(400,'Vælg en gyldig ny administrator.');
  const prepared=await ctx.supabaseAdmin.from('account_deletion_choices').upsert({user_id:user.id,successors,requested_at:new Date(now()).toISOString()});
  if(prepared.error)return fail(503,'Sletningen kunne ikke forberedes. Intet er bekræftet slettet.');
  // Hard-delete through the supported Auth API. The database trigger performs
  // household cleanup atomically; invalid successor/DB errors roll it all back.
  const deleted=await ctx.supabaseAdmin.auth.admin.deleteUser(user.id,false);
  if(deleted.error){
   // A transport failure can occur after Auth committed the deletion. Confirm
   // absence rather than incorrectly claiming that the account still exists.
   const checked=await ctx.supabaseAdmin.auth.admin.getUserById(user.id);
   if(checked.error?.status!==404)return fail(409,'Sletningen kunne ikke bekræftes. Kontroller valg af ny administrator, og prøv igen eller kontakt info@huslyg.dk.');
  }
  return {status:200,body:{deleted:true,sharedData:'Fælles husstandsdata bevares for tilbageværende medlemmer. Leverandørlogs og backups håndteres efter deres særskilte frister.'}};
 } catch { return fail(503,'Kontohandlingen kunne ikke gennemføres. Prøv igen.'); }
}
