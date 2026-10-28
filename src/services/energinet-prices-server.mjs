import {createAdminClient} from '@supabase/server/core';
import {ENERGINET_GRID_SUPPLIERS,ENERGINET_COMMON_CHARGES,PRICE_SOURCE,tariffSupplier,allSupplierTariffCodes} from './energinet-tariff-catalog.mjs';
import {calculateEnerginetPrices,priceLocalTime} from './energinet-prices-core.mjs';
import {cachedEnergySource} from './energinet-source-cache.mjs';
import {fetchSpotPriceRange} from './spot-price-archive.mjs';
import {midnight} from './consumption-data.mjs';

export async function fetchEnerginetTariffs({fetcher=fetch}={}){
 const suppliers=ENERGINET_GRID_SUPPLIERS,common=ENERGINET_COMMON_CHARGES;
 const url=new URL('https://api.energidataservice.dk/dataset/DatahubPricelist');
 url.search=new URLSearchParams({filter:JSON.stringify({GLN_Number:[...new Set([...suppliers.map(s=>s.gln),common.gln])],ChargeType:['D03'],ChargeTypeCode:[...new Set([...suppliers.flatMap(allSupplierTariffCodes),...common.tariffCodes])]}),limit:'0'});
 const response=await fetcher(url,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw Object.assign(Error('Tarifkilden er midlertidigt utilgængelig.'),{status:response.status===429?429:502});
 const text=await response.text();if(Buffer.byteLength(text)>8000000)throw Error('For stort tarifsvar');const body=JSON.parse(text);
 if(!Array.isArray(body.records)||!body.records.length||body.records.length>10000)throw Error('Ugyldigt tarifsvar');
 const pairs=new Set([...suppliers.flatMap(s=>allSupplierTariffCodes(s).map(c=>s.gln+'/'+c)),...common.tariffCodes.map(c=>common.gln+'/'+c)]);
 const rows=body.records.filter(r=>r.ChargeType==='D03'&&pairs.has(r.GLN_Number+'/'+r.ChargeTypeCode));
 for(const s of [...suppliers,common])for(const code of s.tariffCodes)if(!rows.some(r=>r.GLN_Number===s.gln&&r.ChargeTypeCode===code))throw Error('Tarifpakken mangler en påkrævet tarif');
 return rows.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b),'en'));
}
function monthAfter(month){const d=new Date(month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);return d.toISOString().slice(0,10);}
export async function refreshEnerginetTariffs({admin,fetcher=fetch,now=Date.now(),cache=cachedEnergySource}){
 const today=priceLocalTime(now).slice(0,10);
 const day=Number(priceLocalTime(now).slice(11,13))>=9?today:new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10);
 const nominal=Date.parse(midnight(day))+9*3600000,after=nominal+(9-Number(priceLocalTime(nominal).slice(11,13)))*3600000;
 return cache({admin,key:'energinet-v1:tariffs',after,now,load:()=>fetchEnerginetTariffs({fetcher})});
}
export async function getEnerginetPrices(query,{adminFactory=createAdminClient,fetcher=fetch,now=Date.now(),cache=cachedEnergySource}={}){
 const supplier=tariffSupplier(query.supplierId),area=query.priceArea;
 if(!supplier||supplier.area!==area)throw Object.assign(Error('Netselskab eller prisområde kunne ikke matches.'),{status:400});
 const today=priceLocalTime(now).slice(0,10),tomorrow=new Date(Date.parse(today+'T12:00:00Z')+86400000).toISOString().slice(0,10);
 const defaultTo=midnight(new Date(Date.parse(today+'T12:00:00Z')+2*86400000).toISOString().slice(0,10));
 const from=query.from??midnight(today),to=query.to??defaultTo,lo=Date.parse(from),hi=Date.parse(to);
 if(!Number.isFinite(lo)||!Number.isFinite(hi)||lo>=hi||hi-lo>367*86400000||lo<Date.parse('2020-01-01T00:00:00Z')||lo>Date.parse(defaultTo))throw Object.assign(Error('Ugyldig prisperiode.'),{status:400});
 // Only fetch published prices; a date beyond tomorrow never becomes a forecast.
 const effectiveTo=Math.min(hi,Date.parse(defaultTo)),admin=adminFactory();
 const tariffRows=await refreshEnerginetTariffs({admin,fetcher,now,cache});
 const months=[];let month=priceLocalTime(lo).slice(0,7);const last=priceLocalTime(effectiveTo-1).slice(0,7);
 while(month<=last){months.push(month);month=monthAfter(month).slice(0,7);}
 const rows=[];
 // Bounded parallelism keeps a full year's cost lookup practical without bursts.
 for(let i=0;i<months.length;i+=3){
  const groups=await Promise.all(months.slice(i,i+3).map(async month=>{
   const end=monthAfter(month),current=month>=today.slice(0,7);
   const normalized=await cache({admin,key:'energinet-v1:spot:'+month,after:current?now-15*60000:Math.min(now-7*86400000,Date.parse(end+'T00:00:00Z')+86400000),now,load:async()=>{
    const result=await fetchSpotPriceRange(month+'-01',end,{fetcher});
    if(!current&&result.rows.length!==result.expectedCount)throw Error('Det historiske prisarkiv har manglende intervaller.');
    return result.rows;
   }});
   return normalized.map(r=>r.raw_record);
  }));rows.push(...groups.flat());
 }
 const points=calculateEnerginetPrices({supplierId:supplier.id,area,from,to:new Date(effectiveTo).toISOString(),spotRows:rows,tariffRows});
 if(!points.length)throw Object.assign(Error('Ingen offentliggjorte priser for perioden.'),{status:404});
 // Past days must be complete; missing data cannot look like a cheaper bill.
 const pointByTime=new Map(points.map(p=>[Date.parse(p.startsAt),p]));
 const lastDay=priceLocalTime(points.at(-1).startsAt).slice(0,10),lastDayEnd=midnight(new Date(Date.parse(lastDay+'T12:00:00Z')+86400000).toISOString().slice(0,10));
 for(let at=lo;at<Math.min(effectiveTo,Date.parse(lastDayEnd));){
  const interval=priceLocalTime(at).slice(0,10)<'2025-10-01'?3600000:900000;
  const point=pointByTime.get(Math.floor(at/interval)*interval);if(!point)throw Error('Prisperioden indeholder manglende intervaller.');at=Date.parse(point.startsAt)+interval;
 }
 return {points:points.map(({components,...p})=>p),source:PRICE_SOURCE,supplier:{id:supplier.id,name:supplier.name,gln:supplier.gln},publishedThrough:points.at(-1).startsAt,tomorrow};
}
