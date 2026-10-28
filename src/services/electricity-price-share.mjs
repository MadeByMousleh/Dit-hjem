import {advance,expectedIntervals} from './consumption-data.mjs';
import {daysBetween} from './electricity-periods.mjs';

/** Compare actual hourly kWh with complete, duration-weighted hourly spot prices. */
export function electricityPriceShare(records,prices,{from,to,area}){
 if(!['DK1','DK2'].includes(area)||!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))||from>=to||Date.parse(to)-Date.parse(from)>366*86400000)throw Error('Ugyldig analyseperiode.');
 const byHour=new Map();
 for(const row of prices){
  if(row.price_area!==area)continue;
  const start=Date.parse(row.starts_at),end=Date.parse(row.ends_at),price=Number(row.price_dkk_mwh);
  if(!Number.isFinite(start)||!Number.isFinite(end)||row.price_dkk_mwh===null||row.price_dkk_mwh===''||!Number.isFinite(price)||![900000,3600000].includes(end-start)||start%900000!==0)continue;
  const hour=Math.floor(start/3600000)*3600000;
  if(end>hour+3600000)continue;
  if(!byHour.has(hour))byHour.set(hour,[]);
  byHour.get(hour).push({start,end,price});
 }
 const days=daysBetween(from,to),kwh={cheap:0,other:0,expensive:0};
 let completeDays=0,missingUsageDays=0,missingPriceDays=0,flatDays=0,firstDay=null,lastDay=null;
 for(const day of days){
  const intervals=expectedIntervals(day,advance(day,'day'),'hour'),payload=records['hour/'+day],points=payload?.points;
  if(payload?.v!==1||payload.day!==day||!Array.isArray(points)||points.length!==intervals.length||points.some(p=>!Array.isArray(p)||p.length!==2||p[1]!==false||typeof p[0]!=='number'||!Number.isFinite(p[0])||p[0]<0)){missingUsageDays++;continue;}
  const hourly=intervals.map(interval=>{
   let at=Date.parse(interval.starts_at),sum=0;const end=Date.parse(interval.ends_at);
   for(const part of [...byHour.get(at)??[]].sort((a,b)=>a.start-b.start)){
    if(part.start!==at)return null;
    sum+=part.price*(part.end-part.start)/3600000;at=part.end;
   }
   return at===end?sum:null;
  });
  if(hourly.some(p=>p===null)){missingPriceDays++;continue;}
  const sorted=[...hourly].sort((a,b)=>a-b),count=Math.ceil(sorted.length/4),low=sorted[count-1],high=sorted[sorted.length-count];
  if(sorted[0]===sorted[sorted.length-1])flatDays++;
  hourly.forEach((price,i)=>{
   // Equal boundary prices stay together; central ties are neither cheap nor expensive.
   const category=(low<high?price<=low:price<low)?'cheap':(low<high?price>=high:price>high)?'expensive':'other';
   kwh[category]+=points[i][0];
  });
  completeDays++;firstDay??=day;lastDay=day;
 }
 const totalKwh=kwh.cheap+kwh.other+kwh.expensive;
 return {algorithm:'daily-hourly-spot-quartiles-v1',from,to,area,expectedDays:days.length,completeDays,missingUsageDays,missingPriceDays,flatDays,firstDay,lastDay,totalKwh,kwh,shares:totalKwh>0?{cheap:kwh.cheap/totalKwh,other:kwh.other/totalKwh,expensive:kwh.expensive/totalKwh}:null};
}
