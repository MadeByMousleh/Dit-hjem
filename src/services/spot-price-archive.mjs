import {advance,danishDate,midnight,expectedIntervals} from './consumption-data.mjs';
import {daysBetween} from './electricity-periods.mjs';
const cutover='2025-10-01';
const dateValid=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
export function expectedPriceCount(from,to){return daysBetween(from,to).reduce((sum,day)=>sum+2*expectedIntervals(day,advance(day,'day'),day<cutover?'hour':'quarter').length,0);}
export function normalizeSpotPrices(records,dataset,from,to){
 const duration=dataset==='DayAheadPrices'?15:dataset==='Elspotprices'?60:0;if(!duration)throw Error('Ukendt prisdatasæt');
 const seen=new Map();
 for(const row of records){
  const text=duration===15?row.TimeUTC:row.HourUTC,price=duration===15?row.DayAheadPriceDKK:row.SpotPriceDKK;
  if(typeof text!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/.test(text)||!['DK1','DK2'].includes(row.PriceArea)||typeof price!=='number'||!Number.isFinite(price))throw Error('Ugyldige spotprisdata');
  const start=Date.parse(text.endsWith('Z')?text:text+'Z');
  if(!Number.isFinite(start)||start%(duration*60000)!==0)throw Error('Ugyldigt prisinterval');
  const starts_at=new Date(start).toISOString();if(starts_at<midnight(from)||starts_at>=midnight(to))throw Error('Spotpris uden for perioden');
  const day=danishDate(new Date(start));if((day<cutover)!==(duration===60))throw Error('Uventet prisopløsning');
  const value={price_area:row.PriceArea,starts_at,ends_at:new Date(start+duration*60000).toISOString(),interval_minutes:duration,price_dkk_mwh:price,source:dataset,raw_record:row},key=row.PriceArea+':'+starts_at;
  if(seen.has(key))throw Error('Dublerede spotpriser');seen.set(key,value);
 }
 return [...seen.values()];
}
export async function fetchSpotPriceRange(from,to,{fetcher=fetch}={}){
 if(!dateValid(from)||!dateValid(to)||from>=to||daysBetween(from,to).length>31)throw Error('Ugyldig prisperiode');
 const spans=[];if(from<cutover)spans.push(['Elspotprices',from,to<cutover?to:cutover]);if(to>cutover)spans.push(['DayAheadPrices',from>cutover?from:cutover,to]);
 const rows=[];
 for(const [dataset,start,end]of spans){
  const url=new URL('https://api.energidataservice.dk/dataset/'+dataset);url.search=new URLSearchParams({start,end,filter:JSON.stringify({PriceArea:['DK1','DK2']}),limit:'6500'});
  const response=await fetcher(url,{signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Object.assign(Error(response.status===429?'Priskilden begrænser forespørgsler. Arkivet genoptages ved næste kørsel.':'Spotpriskilden kunne ikke hentes.'),{status:response.status===429?429:502});
  const text=await response.text();if(Buffer.byteLength(text)>3000000)throw Error('For stort prissvar');const data=JSON.parse(text);
  if(!Array.isArray(data.records)||data.records.length>6500||Number(data.total)!==data.records.length)throw Error('Ufuldstændigt eller afkortet prissvar');
  rows.push(...normalizeSpotPrices(data.records,dataset,start,end));
 }
 return {rows,expectedCount:expectedPriceCount(from,to)};
}
