import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backgroundWindow, estimateBackground } from '../src/services/background-usage.mjs';
import { aggregateReadings, expectedIntervals } from '../src/services/consumption-data.mjs';

function usage(from='2026-09-14',to='2026-09-21',value=0.025) {
  return {from,to,syncFailed:false,points:expectedIntervals(from,to,'quarter').map(interval=>({at:interval.starts_at,kwh:value,incomplete:false}))};
}
test('seven completed Danish calendar days, independent of UTC date',()=>{
  assert.deepEqual(backgroundWindow(Date.parse('2026-09-20T23:30:00Z')),{from:'2026-09-14',to:'2026-09-21',aggregation:'Quarter'});
});
test('100 W baseline gives 2.4 kWh per 24 hours and 72 kWh per 30 days',()=>{
  const result=estimateBackground(usage());
  assert.equal(result.status,'ready');assert.equal(result.watts,100);
  assert.equal(result.dailyKwh,2.4);assert.equal(result.monthlyKwh,72);
  assert.equal(result.nights,7);assert.equal(result.validIntervals,56);assert.equal(result.coverage,1);
});
test('daytime loads and isolated high night loads do not become the baseline',()=>{
  const source=usage();
  const hour=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Copenhagen',hour:'2-digit',hourCycle:'h23'});
  for(const p of source.points)if(Number(hour.format(new Date(p.at)))>=4)p.kwh=3;
  const night=source.points.find(p=>Number(hour.format(new Date(p.at)))===2);night.kwh=2.75;
  assert.equal(estimateBackground(source).watts,100);
});
test('missing or incomplete readings are not zero; insufficient coverage suppresses estimates',()=>{
  const source=usage();
  source.points.forEach((p,i)=>{if(i%2===0)p.kwh=null;});
  const result=estimateBackground(source);
  assert.equal(result.status,'insufficient_data');assert.equal(result.watts,null);assert.equal(result.dailyKwh,null);
  assert.equal(estimateBackground({...usage(),points:[]}).status,'insufficient_data');
  const incomplete=usage();incomplete.points.forEach(p=>{p.incomplete=true;});
  assert.equal(estimateBackground(incomplete).validIntervals,0);
});
test('one missing night is reported but six complete nights can support the estimate',()=>{
  const source=usage();source.points=source.points.slice(96);
  const result=estimateBackground(source);
  assert.equal(result.status,'ready');assert.equal(result.nights,6);assert.equal(result.validIntervals,48);
  assert.ok(result.coverage<1);
});
test('DST changes expected overnight coverage, not the estimated 24-hour consumption',()=>{
  for(const [from,to,count] of [['2026-03-25','2026-04-01',52],['2026-10-22','2026-10-29',60]]) {
    const result=estimateBackground(usage(from,to));
    assert.equal(result.expectedIntervals,count);assert.equal(result.validIntervals,count);
    assert.equal(result.coverage,1);assert.equal(result.watts,100);assert.equal(result.dailyKwh,2.4);
  }
});
test('legitimate zero is retained; duplicated timestamps cannot inflate the sample count',()=>{
  const source=usage(undefined,undefined,0);source.points.push(...structuredClone(source.points));
  const result=estimateBackground(source);
  assert.equal(result.watts,0);assert.equal(result.status,'ready');assert.equal(result.validIntervals,56);
});
test('multiple meters are summed before estimating and incomplete household intervals are excluded',()=>{
  const source=usage();
  const intervals=expectedIntervals(source.from,source.to,'quarter');
  const rows=['a','b'].flatMap(meter_id=>intervals.map(interval=>({...interval,meter_id,kwh:0.025})));
  const points=aggregateReadings(rows,[{id:'a'},{id:'b'}],source.from,source.to,'quarter',source.to);
  assert.equal(estimateBackground({...source,points}).watts,200);
  const missing=aggregateReadings(rows.filter(r=>r.meter_id==='a'),[{id:'a'},{id:'b'}],source.from,source.to,'quarter',source.to);
  assert.equal(estimateBackground({...source,points:missing}).status,'insufficient_data');
});
