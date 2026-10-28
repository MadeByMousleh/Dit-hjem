import assert from 'node:assert/strict';
import {electricityPriceShare} from '../src/services/electricity-price-share.mjs';
import {advance,expectedIntervals} from '../src/services/consumption-data.mjs';
function fixture(day,quarter=false){
 const to=advance(day,'day'),hours=expectedIntervals(day,to,'hour');
 const records={['hour/'+day]:{v:1,day,points:hours.map((_,i)=>[i<6?10:1,false])}};
 const prices=hours.flatMap((h,i)=>Array.from({length:quarter?4:1},(_,j)=>({price_area:'DK1',starts_at:new Date(Date.parse(h.starts_at)+j*(quarter?900000:3600000)).toISOString(),ends_at:new Date(Date.parse(h.starts_at)+(j+1)*(quarter?900000:3600000)).toISOString(),price_dkk_mwh:i-12})));
 return {records,prices,range:{from:day,to,area:'DK1'}};
}
for(const day of ['2026-10-20','2026-03-29','2026-10-25']){
 const f=fixture(day),result=electricityPriceShare(f.records,f.prices,f.range),q=fixture(day,true);
 assert.equal(result.completeDays,1);assert.equal(result.totalKwh,expectedIntervals(day,f.range.to,'hour').length+54);
 assert.deepEqual(electricityPriceShare(q.records,q.prices,q.range),result,'quarter and hour prices agree, including DST');
 assert.ok(Math.abs(Object.values(result.shares).reduce((a,b)=>a+b)-1)<1e-12);
}
const f=fixture('2026-10-20'),run=(records=f.records,prices=f.prices)=>electricityPriceShare(records,prices,f.range);
assert.equal(run().kwh.cheap,60);assert.equal(run().shares.cheap,60/78,'energy weighted');
assert.equal(run(f.records,f.prices.slice(1)).missingPriceDays,1);
assert.equal(run(f.records,[...f.prices,f.prices[0]]).completeDays,0,'overlap rejected');
assert.equal(run(f.records,f.prices.map(p=>({...p,price_area:'DK2'}))).completeDays,0);
const flat=run(f.records,f.prices.map(p=>({...p,price_dkk_mwh:-100})));
assert.equal(flat.flatDays,1);assert.equal(flat.shares.other,1,'flat negative prices have no arbitrary cheap hours');
const incomplete=structuredClone(f.records);incomplete['hour/2026-10-20'].points[0][1]=true;
assert.equal(run(incomplete).missingUsageDays,1);
const zero=structuredClone(f.records);zero['hour/2026-10-20'].points.forEach(p=>p[0]=0);assert.equal(run(zero).shares,null);
const tied=run(f.records,f.prices.map((p,i)=>({...p,price_dkk_mwh:i<12?1:2})));
assert.equal(tied.kwh.cheap,66,'all equal boundary prices included');
console.log('PASS: kWh shares, hourly/quarter prices, DST, gaps, overlaps, region, ties, negatives and zero usage');
