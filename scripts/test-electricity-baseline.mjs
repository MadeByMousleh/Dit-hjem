import assert from 'node:assert/strict';
import {electricityBaseline} from '../src/services/electricity-baseline.mjs';
import {daysBetween} from '../src/services/electricity-periods.mjs';
import {advance,expectedIntervals} from '../src/services/consumption-data.mjs';
const records={};for(const day of daysBetween('2026-03-01','2026-03-31')){const n=expectedIntervals(day,advance(day,'day'),'hour').length;records['hour/'+day]={v:1,day,points:Array.from({length:n},(_,i)=>[i>=8&&i<20?2:.2,false])};}
let b=electricityBaseline(records,{to:'2026-03-31'});assert.equal(b.completeDays,30);assert.equal(b.status,'ready');assert.ok(Math.abs(b.watts-200)<1e-8);assert.equal(records['hour/2026-03-29'].points.length,23);
for(const day of daysBetween('2026-03-24','2026-03-31'))records['hour/'+day].points=records['hour/'+day].points.map(()=>[.5,false]);
b=electricityBaseline(records,{to:'2026-03-31'});assert.equal(b.changed,true);assert.equal(b.watts,500);
records['hour/2026-03-30'].points[0]=[null,false];b=electricityBaseline(records,{to:'2026-03-31'});assert.equal(b.completeDays,29);assert.equal(b.watts,500);
const sparse={'hour/2026-03-30':{v:1,day:'2026-03-30',points:Array.from({length:24},()=>[0,false])}};assert.equal(electricityBaseline(sparse,{to:'2026-03-31'}).status,'insufficient_data');
for(const day of daysBetween('2026-03-01','2026-03-31'))records['hour/'+day].points=records['hour/'+day].points.map(()=>[0,false]);assert.equal(electricityBaseline(records,{to:'2026-03-31'}).watts,0);
console.log('PASS baseline: sustained low load, DST, persistent change, missing data and real zero');
