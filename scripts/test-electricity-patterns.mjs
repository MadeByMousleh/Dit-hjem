import assert from 'node:assert/strict';
import {electricityPatterns,loadElectricityPatterns} from '../src/services/electricity-patterns.mjs';
import {daysBetween} from '../src/services/electricity-periods.mjs';
import {expectedIntervals,advance} from '../src/services/consumption-data.mjs';
const localHour=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Copenhagen',hourCycle:'h23',hour:'2-digit'});
function record(day,value=()=>1){return {v:1,day,points:expectedIntervals(day,advance(day,'day'),'hour').map(interval=>[value(Number(localHour.format(new Date(interval.starts_at)))),false])};}
const range={from:'2026-09-01',to:'2026-10-09'},records=Object.fromEntries(daysBetween(range.from,range.to).map(day=>['hour/'+day,record(day,h=>(h===18?4:1)*(new Date(day+'T12:00:00Z').getUTCDay()===4?2:1))]));
const snapshot=JSON.stringify(records),profile=electricityPatterns(records,range);
assert.equal(profile.status,'ready');assert.equal(profile.completeDays,38);assert.deepEqual(profile.peakHours,[18]);assert.deepEqual(profile.peakWeekdays,[3]);
assert.equal(profile.weekdays[3].averageKwh,54);assert.equal(profile.weekdays[0].averageKwh,27);assert.equal(profile.hours[18].samples,38);assert.equal(JSON.stringify(records),snapshot);
const unequalRange={from:'2026-09-01',to:'2026-10-07'},unequal=Object.fromEntries(daysBetween(unequalRange.from,unequalRange.to).map(day=>['hour/'+day,record(day,()=>new Date(day+'T12:00:00Z').getUTCDay()===1?1.1:1)]));
assert.equal(electricityPatterns(unequal,unequalRange).peakWeekdays[0],0,'Normalize per day; Tuesday has more occurrences, Monday has higher average');
const zero={'hour/2026-09-01':record('2026-09-01',()=>0)},z=electricityPatterns(zero,{from:'2026-09-01',to:'2026-09-03'});
assert.equal(z.completeDays,1);assert.equal(z.missingDays,1);assert.equal(z.totalKwh,0);assert.equal(z.weekdays[1].averageKwh,0);assert.equal(z.weekdays[2].averageKwh,null);assert.deepEqual(z.peakHours,[]);
for(const invalid of [null,-1,NaN,Infinity]){const broken=structuredClone(zero);broken['hour/2026-09-01'].points[4][0]=invalid;assert.equal(electricityPatterns(broken,{from:'2026-09-01',to:'2026-09-02'}).incompleteDays,1);}
const incomplete=structuredClone(zero);incomplete['hour/2026-09-01'].points[5][1]=true;assert.equal(electricityPatterns(incomplete,{from:'2026-09-01',to:'2026-09-02'}).completeDays,0);
const short=structuredClone(zero);short['hour/2026-09-01'].points.pop();assert.equal(electricityPatterns(short,{from:'2026-09-01',to:'2026-09-02'}).incompleteDays,1);
for(const [day,count,twos]of [['2026-03-29',23,0],['2026-10-25',25,2]]){const p=electricityPatterns({['hour/'+day]:record(day)},{from:day,to:advance(day,'day')});assert.equal(p.completeDays,1);assert.equal(p.totalKwh,count);assert.equal(p.hours[2].samples,twos);assert.equal(p.hours[3].averageKwh,1);}
const flat=electricityPatterns(Object.fromEntries(daysBetween(range.from,range.to).map(day=>['hour/'+day,record(day)])),range);assert.equal(flat.peakHours.length,24);assert.equal(flat.peakWeekdays.length,7);
assert.throws(()=>electricityPatterns({}, {from:'2026-02-30',to:'2026-03-10'}));assert.throws(()=>electricityPatterns({}, {from:'2020-01-01',to:'2026-01-01'}));
let batches=0;const vault={loadElectricityRecords:async keys=>{assert.ok(keys.length<=31);batches++;return Object.fromEntries(keys.map(k=>[k,records[k]]));},cachedElectricityRecord:()=>undefined};
const loaded=await loadElectricityPatterns(vault,range);assert.equal(batches,2);assert.equal(loaded.loadFailed,false);assert.deepEqual(loaded.hours,profile.hours);
const offline=await loadElectricityPatterns({loadElectricityRecords:async()=>{throw Error('Offline');},cachedElectricityRecord:key=>records[key]},range);assert.equal(offline.loadFailed,true);assert.deepEqual(offline.weekdays,profile.weekdays);
const other=await loadElectricityPatterns({loadElectricityRecords:async()=>({}),cachedElectricityRecord:()=>undefined},range);assert.equal(other.completeDays,0,'No data shared between household vaults');
const controller=new AbortController();controller.abort();await assert.rejects(()=>loadElectricityPatterns(vault,{...range,signal:controller.signal}),/Afbrudt/);
console.log('PASS electricity patterns: complete-day normalization, local hours/weekdays, DST 23/25h, ties, zero vs missing, quality gates, bounded saved-record reads, offline reuse, household isolation and cancellation.');
