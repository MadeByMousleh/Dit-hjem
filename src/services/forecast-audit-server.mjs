import{cachedEnergySource}from'./energinet-source-cache.mjs';
import{fetchPriceForecastPacket}from'./price-forecast-server.mjs';
import{forecastAuditSnapshot}from'./forecast-audit.mjs';
import{priceLocalTime}from'./energinet-prices-core.mjs';
export async function captureForecastAudit({admin,fetcher=fetch,now=Date.now(),cache=cachedEnergySource}){
 const day=priceLocalTime(now).slice(0,10);
 const existing=await admin.from('energy_forecast_capture_runs').select('id,point_count').eq('source','elpriser-v1').eq('capture_day',day).maybeSingle();
 if(existing.error)throw Error('Prognosearkivet er ikke klargjort.');
 if(existing.data)return {status:'already-captured',captureId:existing.data.id,points:existing.data.point_count};
 const packet=await cache({admin,key:'elpriser-v1:forecast',after:now-3600000,now,load:()=>fetchPriceForecastPacket({fetcher,now})});
 if(!Array.isArray(packet)||packet.length!==1)throw Error('Ugyldig prognosepakke');
 const snapshot=forecastAuditSnapshot(packet[0],{now});
 const saved=await admin.rpc('archive_energy_forecast_capture',{p_generated_at:snapshot.generatedAt,p_points:snapshot.points,p_metadata:snapshot.metadata});
 if(saved.error||!saved.data?.capture_id)throw Error('Prognosen kunne ikke arkiveres.');
 return {status:saved.data.inserted?'captured':'already-captured',captureId:saved.data.capture_id,points:saved.data.point_count};
}
export async function withForecastAuditJob(admin,kind,work){
 const start=await admin.from('energy_forecast_job_runs').insert({kind,status:'running'}).select('id').single();
 if(start.error||!start.data?.id)throw Error('Prognosejobbets status kunne ikke gemmes.');
 try{
  const result=await work(),status=result.status==='saved-with-gaps'?'partial':'complete';
  const saved=await admin.from('energy_forecast_job_runs').update({status,completed_at:new Date().toISOString(),result}).eq('id',start.data.id);
  if(saved.error)throw Error('Prognosejobbets resultat kunne ikke gemmes.');return result;
 }catch(error){
  await admin.from('energy_forecast_job_runs').update({status:'failed',completed_at:new Date().toISOString(),error_code:kind==='capture'?'FORECAST_CAPTURE_FAILED':'ACTUAL_ARCHIVE_FAILED'}).eq('id',start.data.id);
  throw error;
 }
}
