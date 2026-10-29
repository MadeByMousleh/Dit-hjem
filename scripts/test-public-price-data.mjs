import assert from 'node:assert/strict';
import {dayPrices,midnight,nextDate,summarize,chartGeometry,localDate} from '../public/landing/prices.mjs';
const fixture=(day,value=100)=>({points:Array.from({length:(midnight(nextDate(day))-midnight(day))/900000},(_,i)=>({startsAt:new Date(midnight(day)+i*900000).toISOString(),totalOrePerKwh:value}))});
for(const [day,count] of [['2026-03-29',92],['2026-10-25',100],['2026-10-28',96]]){
 const payload=fixture(day),points=dayPrices(payload,day);assert.equal(points.length,count);assert.equal(localDate(points[0].at),day);assert.equal(summarize(points).average,100);
}
const day='2026-10-28',payload=fixture(day);for(let i=8;i<12;i++)payload.points[i].totalOrePerKwh=-40;
const points=dayPrices(payload,day),summary=summarize(points,midnight(day)+9*900000);
assert.equal(summary.cheapest.at,midnight(day)+8*900000);assert.equal(summary.cheapest.value,-40);assert.equal(summary.current.value,-40);
assert.equal(summarize(points,midnight(nextDate(day))).current,null);
const chart=chartGeometry(points);assert.ok(chart.zero>0&&chart.zero<100);assert.ok(chart.bars[8].negative);assert.ok(chart.bars.every(b=>b.top>=0&&b.height>=0&&b.top+b.height<=100.00001));
assert.deepEqual(dayPrices({points:[]},day),[]);
assert.throws(()=>dayPrices({points:payload.points.slice(1)},day),/ufuldstændige/);
assert.throws(()=>dayPrices({points:[...payload.points,payload.points[0]]},day),/ufuldstændige/);
assert.throws(()=>dayPrices({points:payload.points.map((p,i)=>i? p:{...p,totalOrePerKwh:null})},day),/Ugyldige/);
assert.throws(()=>dayPrices({points:payload.points.map((p,i)=>i? p:{...p,totalOrePerKwh:'0'})},day),/Ugyldige/);
const negatives=dayPrices(fixture(day,-20),day);assert.equal(chartGeometry(negatives).zero,0);assert.equal(summarize(negatives).average,-20);
assert.equal(chartGeometry(dayPrices(fixture(day,0),day)).bars[0].height,0);
console.log('Passed: 23/24/25-hour Danish days, contiguous cheapest hour, current interval, negative/zero prices, and missing/duplicate/invalid-data rejection.');
