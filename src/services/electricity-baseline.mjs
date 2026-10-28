import {advance,expectedIntervals} from './consumption-data.mjs';
import {daysBetween} from './electricity-periods.mjs';
const before=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')-n*86400000).toISOString().slice(0,10);
const median=values=>{const s=[...values].sort((a,b)=>a-b),n=s.length;return n?(s[Math.floor((n-1)/2)]+s[Math.floor(n/2)])/2:null;};
/** Observed low net import, not appliance-level standby or total demand behind solar. */
export function electricityBaseline(records,{to}){
 const from=before(to,30),days=daysBetween(from,to),samples=[];
 for(const day of days){
  const r=records['hour/'+day],expected=expectedIntervals(day,advance(day,'day'),'hour');
  if(r?.v!==1||r.day!==day||!Array.isArray(r.points)||r.points.length!==expected.length||r.points.some(p=>!Array.isArray(p)||p.length!==2||p[1]!==false||typeof p[0]!=='number'||!Number.isFinite(p[0])||p[0]<0))continue;
  const windows=[];
  for(let i=0;i<=r.points.length-3;i++)windows.push((r.points[i][0]+r.points[i+1][0]+r.points[i+2][0])/3);
  // A sustained three-hour low period, rather than the lowest isolated reading.
  samples.push({day,kwhPerHour:median(windows.sort((a,b)=>a-b).slice(0,3))});
 }
 const cutoff=before(to,7),recent=samples.filter(s=>s.day>=cutoff),older=samples.filter(s=>s.day<cutoff);
 const recentLevel=median(recent.map(s=>s.kwhPerHour)),oldLevel=median(older.map(s=>s.kwhPerHour));
 const threshold=oldLevel===null?Infinity:Math.max(.05,oldLevel*.25);
 const direction=recentLevel!==null&&oldLevel!==null?Math.sign(recentLevel-oldLevel):0;
 const changed=recent.length>=6&&older.length>=7&&Math.abs(recentLevel-oldLevel)>threshold&&recent.filter(s=>direction*(s.kwhPerHour-oldLevel)>threshold).length>=6;
 const chosen=changed?recent:samples,level=median(chosen.map(s=>s.kwhPerHour));
 const fresh=samples.at(-1)?.day>=before(to,3);
 const status=samples.length>=21&&recent.length>=6?'ready':samples.length>=7&&recent.length>=4?'preliminary':'insufficient_data';
 return {version:1,algorithm:'sustained-low-load-v1',from,to,effectiveFrom:chosen[0]?.day??null,lastDay:samples.at(-1)?.day??null,completeDays:samples.length,expectedDays:30,recentDays:recent.length,status:!fresh?'insufficient_data':status,watts:level===null?null:level*1000,kwhPerDay:level===null?null:level*24,changed,daily:samples};
}
