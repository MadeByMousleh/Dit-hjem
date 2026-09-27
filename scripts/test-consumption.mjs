import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aggregateReadings, cacheFresh, expectedIntervals, meterReadings, midnight } from '../src/services/consumption-data.mjs';
import { authorizeHousehold, validateSelection } from '../src/services/household-usage.mjs';

const meter = '123456789012345678';
const household = '11111111-1111-4111-8111-111111111111';
export function payload(from, to, resolution, quantity = 1) {
  return { result: [{ success: true, MyEnergyData_MarketDocument: { TimeSeries: [{ businessType: 'A04', 'MarketEvaluationPoint.mRID': { name: meter }, 'measurement_Unit.name': 'KWH', Period: [{ resolution: {hour:'PT1H',day:'P1D',month:'P1M',year:'P1Y'}[resolution], timeInterval: { start: midnight(from), end: midnight(to) }, Point: expectedIntervals(from,to,resolution).map((_,i)=>({position:i+1,'out_Quantity.quantity':quantity,'out_Quantity.quality':'A01'})) }] }] } }] };
}
test('Danish midnight, 23-hour spring and 25-hour autumn days', () => {
  assert.equal(midnight('2026-03-29'),'2026-03-28T23:00:00.000Z');
  assert.equal(midnight('2026-03-30'),'2026-03-29T22:00:00.000Z');
  assert.equal(expectedIntervals('2026-03-29','2026-03-30','hour').length,23);
  const fall = meterReadings(payload('2026-10-25','2026-10-26','hour'),meter,'hour');
  assert.equal(fall.length,25);
  assert.equal(new Set(fall.map(r=>r.starts_at)).size,25);
  assert.equal(Date.parse(fall.at(-1).ends_at)-Date.parse(fall[0].starts_at),25*3600000);
});
test('quarter-hour meter replies are summed into complete hourly readings', () => {
  const p = payload('2026-01-01', '2026-01-02', 'hour');
  const period = p.result[0].MyEnergyData_MarketDocument.TimeSeries[0].Period[0];
  period.resolution = 'PT15M';
  period.Point = Array.from({ length: 96 }, (_, i) => ({ position: i + 1, 'out_Quantity.quantity': 0.25, 'out_Quantity.quality': 'A01' }));
  const rows = meterReadings(p, meter, 'hour');
  assert.equal(rows.length, 24);
  assert.equal(rows[0].kwh, 1);
  assert.equal(rows.at(-1).kwh, 1);
  period.Point.splice(2, 1);
  assert.equal(meterReadings(p, meter, 'hour')[0].kwh, null);
});
test('daily intervals retain local midnight across DST', () => {
  const rows = meterReadings(payload('2026-03-28','2026-03-31','day'),meter,'day');
  assert.equal(rows.length,3);
  assert.equal(Date.parse(rows[1].ends_at)-Date.parse(rows[1].starts_at),23*3600000);
});
test('duplicate series do not double-count; conflicts and foreign meters are rejected', () => {
  const p = payload('2026-01-01','2026-01-02','hour');
  p.result.push(structuredClone(p.result[0]));
  assert.equal(meterReadings(p,meter,'hour').length,24);
  p.result[1].MyEnergyData_MarketDocument.TimeSeries[0].Period[0].Point[0]['out_Quantity.quantity']=9;
  assert.throws(()=>meterReadings(p,meter,'hour'),/Modstridende/);
  assert.throws(()=>meterReadings(payload('2026-01-01','2026-01-02','hour'),'999999999999999999','hour'),/målepunkt/);
});
test('missing, estimated, zero and production readings stay distinct', () => {
  const p = payload('2026-01-01','2026-01-02','hour');
  const series = p.result[0].MyEnergyData_MarketDocument.TimeSeries[0];
  series.Period[0].Point[0]['out_Quantity.quantity']='';
  series.Period[0].Point[1]['out_Quantity.quality']='A02';
  series.Period[0].Point[2]['out_Quantity.quantity']='0';
  series.Period[0].Point.pop();
  p.result[0].MyEnergyData_MarketDocument.TimeSeries.push({...structuredClone(series), businessType:'A01'});
  const rows=meterReadings(p,meter,'hour');
  assert.equal(rows.length,23); assert.equal(rows[0].kwh,null); assert.equal(rows[1].kwh,null); assert.equal(rows[2].kwh,0);
});
test('fresh historical caches are reused and corrected/incomplete ranges expire', () => {
  const now=Date.parse('2026-09-20T12:00:00Z');
  assert.equal(cacheFresh({date_to:'2026-01-02',complete:true,fetched_at:new Date(now-86400000).toISOString()},now),true);
  assert.equal(cacheFresh({date_to:'2026-01-02',complete:false,fetched_at:new Date(now-86400000).toISOString()},now),false);
  assert.equal(cacheFresh({date_to:'2026-09-20',complete:true,fetched_at:new Date(now-2*3600000).toISOString()},now),false);
});
test('authorization rejects anonymous, invalid sessions and nonmembers before admin access', async () => {
  const req = token => new Request('https://example.invalid',{headers:token?{authorization:'Bearer '+token}:{}});
  await assert.rejects(authorizeHousehold(req(),household,()=>{throw Error('Must not run');}),{status:401});
  await assert.rejects(authorizeHousehold(req('invalid'),household,async()=>({error:{}})),{status:401});
  let adminAccessed=false;
  const query={select(){return this;},eq(){return this;},async maybeSingle(){return {data:null,error:null};}};
  const ctx={userClaims:{id:'user'},supabase:{from:()=>query},get supabaseAdmin(){adminAccessed=true;throw Error('Must not run');}};
  await assert.rejects(authorizeHousehold(req('valid'),household,async()=>({data:ctx})),{status:403});
  assert.equal(adminAccessed,false);
});
test('rejects invalid dates and overly broad hourly imports', () => {
  assert.throws(()=>validateSelection({from:'2026-02-30',to:'2026-03-02',aggregation:'Hour'}));
  assert.throws(()=>validateSelection({from:'2026-01-01',to:'2026-02-01',aggregation:'Hour'}));
  assert.equal(validateSelection({from:'2021-01-01',to:'2027-01-01',aggregation:'Year'},'2026-09-20').resolution,'year');
});
test('partial first year is counted in the calendar year with its true coverage', () => {
  const p=payload('2024-07-01','2025-01-01','year',100);
  const rows=meterReadings(p,meter,'year');
  assert.equal(rows[0].ends_at,midnight('2025-01-01'));
  const points=aggregateReadings(rows.map(r=>({...r,meter_id:'one'})),[{id:'one'},{id:'missing'}],'2024-01-01','2025-01-01','year','2026-01-01');
  assert.deepEqual(points,[{at:midnight('2024-01-01'),kwh:100,incomplete:true}]);
});
test('known no-data responses can be cached, authorization and transient failures cannot',()=>{
  assert.deepEqual(meterReadings({result:[{success:false,errorCode:30018}]},meter,'year'),[]);
  assert.deepEqual(meterReadings({result:[{success:false,errorCode:30015}]},meter,'year'),[]);
  assert.throws(()=>meterReadings({result:[{success:false,errorCode:20012}]},meter,'year'));
});
