import{forecastSpotHours}from'./price-forecast-core.mjs';
// Training/audit prices are raw spot DKK/MWh. No representative grid total is retained here.
export function forecastAuditSnapshot(body,{now=Date.now()}={}){
 const points=[],regions=[];
 for(const area of['DK1','DK2']){
  const hours=forecastSpotHours(body,area,{now,horizonDays:7});
  if(!hours.length)throw Error('Prognosearkivet kræver aktuelle prognoser for både DK1 og DK2.');
  for(const h of hours){
   if(typeof h.modelId!=='string'||!h.modelId||h.modelId.length>150||h.runId==null)throw Error('Prognosen mangler model- eller udgave-id.');
   points.push({price_area:area,starts_at:h.startsAt,issued_at:h.issuedAt,model_id:h.modelId,source_run_id:String(h.runId),predicted_dkk_mwh:h.spotDkkMwh,p10_dkk_mwh:h.spotDkkMwh+h.lowerDeltaOre/1.25*10,p90_dkk_mwh:h.spotDkkMwh+h.upperDeltaOre/1.25*10,provisional:h.provisional});
  }
  const region=body.regions.find(r=>r.region===area),days=new Set(hours.map(h=>h.startsAt));
  const included=region.days.filter(d=>d.kind==='forecast'&&d.hours?.some(h=>days.has(new Date(h.start).toISOString())));
  const outlook=d=>d.outlook?{wind:d.outlook.wind?{level:d.outlook.wind.level,mwh:d.outlook.wind.mwh,percentile:d.outlook.wind.percentile}:null,solar:d.outlook.solar?{level:d.outlook.solar.level,mwh:d.outlook.solar.mwh,percentile:d.outlook.solar.percentile}:null,reference:d.outlook.reference?{energinetWindMwh:d.outlook.reference.energinetWindMwh,energinetSolarMwh:d.outlook.reference.energinetSolarMwh}:null}:null;
  regions.push({price_area:area,model_id:region.modelId,weather_run:region.weatherRun?{model:region.weatherRun.model,runAt:region.weatherRun.runAt}:null,days:included.map(d=>({day:d.day,issued_at:d.issuedAt,source_run_id:String(d.runId),outlook:outlook(d)})),provider_missing:(region.missing??[]).map(d=>({day:d.day,reason:d.reason}))});
 }
 return {generatedAt:body.generatedAt,points,metadata:{source_url:'https://elpriser.dk/data/prognose.json',license:body.license,attribution:body.attribution,attributions:body.attributions??[],units:'DKK/MWh, spot excluding VAT, grid tariffs, taxes and supplier markup',regions}};
}
