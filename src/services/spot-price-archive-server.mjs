import {createAdminClient} from '@supabase/server/core';
import {timingSafeEqual} from 'node:crypto';
import {advance,danishDate} from './consumption-data.mjs';
import {fetchSpotPriceRange} from './spot-price-archive.mjs';
import {refreshEnerginetTariffs} from './energinet-prices-server.mjs';
import{captureForecastAudit,withForecastAuditJob}from'./forecast-audit-server.mjs';
export async function runSpotPriceArchive({admin,mode='recent',now=Date.now(),fetcher=fetch}){
 const today=danishDate(new Date(now));let from,to,cursor=null,next=null;
 if(mode==='recent'){
  from=new Date(Date.parse(today+'T12:00:00Z')-7*86400000).toISOString().slice(0,10);to=advance(advance(today,'day'),'day');
 }else if(mode==='history'){
  const state=await admin.from('spot_price_archive_state').select('cursor').eq('id',true).single();if(state.error||!state.data?.cursor)throw Error('Spotprisarkivet er ikke klargjort.');
  cursor=state.data.cursor;const month=today.slice(0,7)+'-01';
  if(cursor<month){from=cursor;to=advance(cursor.slice(0,7)+'-01','month');next=to;}
  else{
   const gap=await admin.from('spot_price_archive_ranges').select('date_from,date_to').eq('kind','history').eq('complete',false).lte('retry_after',new Date(now).toISOString()).order('checked_at').limit(1).maybeSingle();
   if(gap.error)throw Error('Prisarkivets huller kunne ikke læses.');if(!gap.data)return {status:'caught-up',rows:0};from=gap.data.date_from;to=gap.data.date_to;cursor=null;
  }
 }else throw Error('Ukendt arkivjob');
 const {rows,expectedCount}=await fetchSpotPriceRange(from,to,{fetcher});
 const saved=await admin.rpc('archive_spot_price_batch',{p_rows:rows,p_kind:mode,p_from:from,p_to:to,p_expected_count:expectedCount,p_cursor:cursor,p_next:next});
 if(saved.error)throw Error('Spotpriserne kunne ikke gemmes. Fremdriften er bevaret.');
 return {status:rows.length===expectedCount?'saved':'saved-with-gaps',from,to,rows:saved.data,expectedCount};
}
export async function spotPriceCronResponse(request,{adminFactory=createAdminClient,env=process.env,fetcher=fetch,now=Date.now(),tariffRefresher=refreshEnerginetTariffs,capture=captureForecastAudit,job=withForecastAuditJob}={}){
 const secret=env.CRON_SECRET,provided=request.headers.get('authorization')??'';
 if(!secret||secret.length<16)return {status:503,body:{error:'Prisarkivets jobnøgle mangler.'}};
 const expected=Buffer.from('Bearer '+secret),actual=Buffer.from(provided);
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return {status:401,body:{error:'Unauthorized'}};
 if(request.method!=='GET')return {status:405,body:{error:'Method not allowed'}};
 try{
  const mode=new URL(request.url).searchParams.get('mode')??'recent';if(!['recent','history','forecast-capture','forecast-retry'].includes(mode))return {status:400,body:{error:'Ugyldigt prisjob'}};
  const admin=adminFactory();
  if(mode.startsWith('forecast-'))return {status:200,body:await job(admin,'capture',()=>capture({admin,fetcher,now}))};
  const body=mode==='recent'?await job(admin,'actuals',()=>runSpotPriceArchive({admin,mode,fetcher,now})):await runSpotPriceArchive({admin,mode,fetcher,now});
  if(mode==='recent'){const rows=await tariffRefresher({admin,fetcher,now});body.tariffRows=rows.length;}return {status:200,body};
 }
 catch(error){return {status:error.status===429?429:503,body:{error:error.status===429?error.message:'Spotprisarkivet kunne ikke opdateres. Fremdriften er bevaret.'}};}
}
