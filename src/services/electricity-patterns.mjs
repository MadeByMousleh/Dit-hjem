import {electricityBaseline} from './electricity-baseline.mjs';
import {advance,expectedIntervals} from './consumption-data.mjs';
import {daysBetween} from './electricity-periods.mjs';
const localHour=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Copenhagen',hourCycle:'h23',hour:'2-digit'});
export const WEEKDAYS=['Mandag','Tirsdag','Onsdag','Torsdag','Fredag','Lørdag','Søndag'];
const dayPattern=/^\d{4}-\d{2}-\d{2}$/;
function validateRange(from,to){
 if(!dayPattern.test(from)||!dayPattern.test(to)||!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))||new Date(from).toISOString().slice(0,10)!==from||new Date(to).toISOString().slice(0,10)!==to||from>=to||Date.parse(to)-Date.parse(from)>366*86400000)throw Error('Ugyldig analyseperiode.');
}
const peak=(rows)=>{const valid=rows.filter(row=>row.averageKwh!==null),max=Math.max(0,...valid.map(row=>row.averageKwh));if(max<=0)return [];return valid.filter(row=>Math.abs(row.averageKwh-max)<1e-9).map(row=>row.index);};

/** Uses only complete saved days. Null/incomplete data never become zero use. */
export function electricityPatterns(records,{from,to}){
 validateRange(from,to);
 const days=daysBetween(from,to),hours=Array.from({length:24},(_,index)=>({index,totalKwh:0,samples:0,averageKwh:null})),weekdays=WEEKDAYS.map((label,index)=>({index,label,totalKwh:0,samples:0,averageKwh:null}));
 const year=Number(new Date(Date.parse(to+'T12:00:00Z')-86400000).getUTCFullYear()),yearStart=year+'-01-01';
 let annualKwh=0,annualDays=0;
 let completeDays=0,missingDays=0,incompleteDays=0,firstDay=null,lastDay=null,totalKwh=0;
 for(const day of days){
  const payload=records[`hour/${day}`];if(!payload){missingDays++;continue;}
  const intervals=expectedIntervals(day,advance(day,'day'),'hour'),points=payload.points;
  if(payload.v!==1||payload.day!==day||!Array.isArray(points)||points.length!==intervals.length||points.some(p=>!Array.isArray(p)||p.length!==2||p[1]!==false||typeof p[0]!=='number'||!Number.isFinite(p[0])||p[0]<0)){incompleteDays++;continue;}
  let daily=0;
  for(let i=0;i<intervals.length;i++){
   const point=points[i][0],hour=Number(localHour.format(new Date(intervals[i].starts_at)));
   hours[hour].totalKwh+=point;hours[hour].samples++;daily+=point;
  }
  const weekday=(new Date(day+'T12:00:00Z').getUTCDay()+6)%7;
  weekdays[weekday].totalKwh+=daily;weekdays[weekday].samples++;
  if(day>=yearStart){annualKwh+=daily;annualDays++;}
  totalKwh+=daily;completeDays++;firstDay??=day;lastDay=day;
 }
 for(const row of [...hours,...weekdays])row.averageKwh=row.samples?row.totalKwh/row.samples:null;
 const ready=completeDays>=28&&completeDays/days.length>=.7&&weekdays.every(row=>row.samples>=3);
 return {annual:{year,kwh:annualKwh,completeDays:annualDays,expectedDays:daysBetween(yearStart,to).length},version:1,algorithm:'complete-day-patterns-v1',from,to,firstDay,lastDay,completeDays,missingDays,incompleteDays,expectedDays:days.length,coverage:completeDays/days.length,totalKwh,hours,weekdays,status:ready?'ready':completeDays?'preliminary':'insufficient_data',peakHours:ready?peak(hours):[],peakWeekdays:ready?peak(weekdays):[]};
}

/** Bounded reads through the household's encrypted record store. No provider calls or writes. */
export async function loadElectricityPatterns(vault,{from,to,signal,onProgress=()=>{}}){
 validateRange(from,to);const keys=daysBetween(from,to).map(day=>'hour/'+day),records={};let loadFailed=false;
 for(let i=0;i<keys.length;i+=31){
  if(signal?.aborted)throw Error('Afbrudt');const chunk=keys.slice(i,i+31);
  try{Object.assign(records,await vault.loadElectricityRecords(chunk));}
  catch(error){if(signal?.aborted)throw error;loadFailed=true;for(const key of chunk){const cached=vault.cachedElectricityRecord(key);if(cached)records[key]=cached;}}
  if(signal?.aborted)throw Error('Afbrudt');onProgress(Math.min(keys.length,i+chunk.length),keys.length);
 }
 return {...electricityPatterns(records,{from,to}),baseline:electricityBaseline(records,{to}),loadFailed};
}
