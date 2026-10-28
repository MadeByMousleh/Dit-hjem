import{priceLocalTime,calculateEnerginetPrices}from'./energinet-prices-core.mjs';
import{midnight,advance}from'./consumption-data.mjs';
export const FORECAST_SOURCE={id:'elpriser-v1',name:'Elpriser.dk',url:'https://elpriser.dk/data/',license:'CC BY 4.0',changes:'Spotprognosen er kombineret med netselskabets egne Energinet-tariffer. Prognosebånd er flyttet med samme tarifdifference.'};
const issuedValid=(value,now,maxAge)=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=now+5*60000&&now-Date.parse(value)<=maxAge;
export function forecastSpotHours(body,area,{now=Date.now(),horizonDays=6}={}){
 if(!Number.isInteger(horizonDays)||horizonDays<1||horizonDays>7)throw Error('Ugyldig prognosehorisont');
 if(!String(body?.license).startsWith('CC BY 4.0')||!issuedValid(body.generatedAt,now,6*3600000)||!Array.isArray(body.regions))throw Error('Prognosekilden er ugyldig eller for gammel.');
 const matches=body.regions.filter(r=>r.region===area);if(matches.length!==1)throw Error('Prognosens prisområde kunne ikke matches.');
 const region=matches[0];if(region.stale!==false||!Array.isArray(region.days)||region.days.length>10)throw Error('Prognosen er ikke opdateret.');
 const today=priceLocalTime(now).slice(0,10),from=Date.parse(midnight(advance(today,'day'))),to=Date.parse(midnight(new Date(Date.parse(today+'T12:00:00Z')+(horizonDays+1)*86400000).toISOString().slice(0,10))),hours=[],seen=new Set();
 for(const day of region.days){
  if(day.kind!=='forecast')continue; // Typical seasonal levels are not predictions.
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day.day))throw Error('Ugyldig prognosedato');
  const start=Date.parse(midnight(day.day)),end=Date.parse(midnight(advance(day.day,'day')));if(start<from||start>=to)continue;
  const gate=region.horizons?.find(h=>h.horizon===day.horizonDay);
  if(gate?.enabled!==true||!issuedValid(day.issuedAt,now,48*3600000))continue;
  if(day.partsOreExVat?.vatFactor!==1.25||!Array.isArray(day.hours)||day.hours.length!==(end-start)/3600000)throw Error('Prognosedagen mangler timer eller enheder.');
  const daySeen=new Set();
  for(const hour of day.hours){
   const at=Date.parse(hour.start),local=Number.isFinite(at)?priceLocalTime(at):'';
   if(typeof hour.start!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(hour.start)||!Number.isFinite(at)||at<start||at>=end||at%3600000!==0||local.slice(0,10)!==day.day||Number(local.slice(11,13))!==hour.hour||seen.has(at))throw Error('Ugyldig eller dubleret prognosetime');
   const{spotOreExVat,allInOreInclVat,p10OreInclVat,p90OreInclVat}=hour;
   if(![spotOreExVat,allInOreInclVat,p10OreInclVat,p90OreInclVat].every(v=>typeof v==='number'&&Number.isFinite(v))||p10OreInclVat>allInOreInclVat||p90OreInclVat<allInOreInclVat)throw Error('Ugyldigt prognoseinterval');
   seen.add(at);daySeen.add(at);hours.push({startsAt:new Date(at).toISOString(),spotDkkMwh:spotOreExVat*10,lowerDeltaOre:p10OreInclVat-allInOreInclVat,upperDeltaOre:p90OreInclVat-allInOreInclVat,issuedAt:day.issuedAt,modelId:region.modelId,runId:day.runId,provisional:gate.gatePassed!==true});
  }
  for(let at=start;at<end;at+=3600000)if(!daySeen.has(at))throw Error('Prognosedagen har et hul');
 }
 return hours.sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
}
export function calculatePriceForecast({body,area,supplierId,tariffRows,now=Date.now()}){
 const hours=forecastSpotHours(body,area,{now}),points=[],unavailableDays=[];
 const groups=new Map();for(const hour of hours){const day=priceLocalTime(hour.startsAt).slice(0,10),group=groups.get(day)??[];group.push(hour);groups.set(day,group);}
 for(const[day,group]of groups){
  try{
   const values=calculateEnerginetPrices({supplierId,area,tariffRows,from:midnight(day),to:midnight(advance(day,'day')),spotRows:group.map(h=>({TimeUTC:h.startsAt,PriceArea:area,DayAheadPriceDKK:h.spotDkkMwh}))});
   const byTime=new Map(values.map(p=>[p.startsAt,p]));
   const complete=group.map(h=>{const p=byTime.get(h.startsAt);if(!p)throw Error('Prognosetarif mangler');return {startsAt:p.startsAt,priceDkkMwh:p.priceDkkMwh,totalOrePerKwh:p.totalOrePerKwh,gridAndTaxOrePerKwh:p.gridAndTaxOrePerKwh,forecast:true,intervalMinutes:60,forecastLowerOrePerKwh:p.totalOrePerKwh+h.lowerDeltaOre,forecastUpperOrePerKwh:p.totalOrePerKwh+h.upperDeltaOre,forecastIssuedAt:h.issuedAt,forecastProvisional:h.provisional,forecastModelId:h.modelId,source:FORECAST_SOURCE.id};});
   points.push(...complete);
  }catch{unavailableDays.push({day,reason:'Tariffer for dagen er ikke tilgængelige.'});}
 }
 return {points,source:{...FORECAST_SOURCE,attributions:body.attributions??[]},generatedAt:body.generatedAt,unavailableDays};
}
