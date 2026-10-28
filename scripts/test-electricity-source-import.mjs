import assert from 'node:assert/strict';
import {meterReadings,sourceHours,expectedIntervals,advance,midnight} from '../src/services/consumption-data.mjs';
import {nextImportBatch,mergeDayRecords,importProgress,sourceFetched,daysBetween,updateKeys} from '../src/services/electricity-periods.mjs';
const id='123456789012345678',day='2026-10-25';
const payload={result:[{success:true,MyEnergyData_MarketDocument:{TimeSeries:[{businessType:'A04','MarketEvaluationPoint.mRID':{name:id},'measurement_Unit.name':'KWH',Period:[{resolution:'PT15M',timeInterval:{start:midnight(day),end:midnight(advance(day,'day'))},Point:expectedIntervals(day,advance(day,'day'),'quarter').map((_,i)=>({position:i+1,'out_Quantity.quantity':i===0?'0,0123456789':.25,'out_Quantity.quality':i===1?'A02':'A01'}))}]}]}}]};
const original=meterReadings(payload,id,'actual');assert.equal(original.length,100);assert.equal(original[0].kwh,.0123456789);assert.equal(original[0].rawQuantity,'0,0123456789');assert.equal(original[1].kwh,null);assert.equal(original[1].reportedKwh,.25);assert.equal(original[1].quality,'A02');
const hours=sourceHours(original);assert.equal(hours.length,25);assert.equal(hours[0].kwh,null);assert.equal(hours[1].kwh,1);
const descriptors=[{id,from:'2021-01-01',to:null}],merged=mergeDayRecords({},day,hours.map(r=>({...r,meter_id:id})),descriptors,[id],1,original.map(r=>({...r,meter_id:id})));
const saved=merged['hour/'+day];assert.equal(saved.points.length,25);assert.equal(saved.points[0][0],null);assert.equal(saved.meters[id].source.intervals.length,100);assert.equal(sourceFetched(saved,id),true);assert.equal(merged['state/import'].gaps[day]>1,true);
assert.equal(saved.meters[id].source.intervals[1][5],.25,'Estimated source energy retained separately from usable kWh');
const partial=mergeDayRecords(merged,day,[],descriptors,[id],2,[{...original[6],meter_id:id,kwh:.5}]);assert.equal(partial['hour/'+day].meters[id].source.intervals.length,100,'A partial reply does not discard other original intervals');assert.equal(partial['hour/'+day].meters[id].source.intervals[6][3],.5);assert.equal(partial['hour/'+day].meters[id].values[1],1.25,'Corrected quarter recomputes its hour using retained source data');
const empty=mergeDayRecords({},day,[],descriptors,[id],1,[]);assert.equal(sourceFetched(empty['hour/'+day],id),true);assert.equal(empty['hour/'+day].meters[id].source.intervals.length,0);assert.equal(empty['hour/'+day].points.every(p=>p[0]===null&&p[1]),true);
const coarse={...original[0],starts_at:midnight(day),ends_at:midnight(advance(day,'day')),resolution:'day',kwh:12};assert.deepEqual(sourceHours([coarse]),[],'Never invent hourly data from coarse source');
const now=Date.parse('2026-10-23T15:00:00Z'),state={sourceVersion:1,meters:[{id,from:'2021-01-01',to:null,cursor:'2026-10-23',importedTo:'2026-10-23'}],gaps:{}},visited=new Set();let calls=0,batch;
while((batch=nextImportBatch(state,now))){
 assert.equal(batch.direction,'history');assert.ok(batch.to>batch.from);assert.ok(updateKeys(daysBetween(batch.from,batch.to)).length<=40);
 for(const date of daysBetween(batch.from,batch.to)){assert.equal(visited.has(date),false);visited.add(date);assert.equal(date.slice(0,7),batch.from.slice(0,7),'One calendar month per batch');}
 const before=importProgress(state,now);state.meters[0].cursor=batch.from;const after=importProgress(state,now);assert.ok(after.processedDays>before.processedDays);calls++;
}
assert.equal(visited.size,daysBetween('2021-01-01','2026-10-23').length);assert.equal(calls,70);assert.equal(importProgress(state,now).percent,100);
assert.equal(state.meters[0].cursor,'2021-01-01');assert.equal(nextImportBatch(state,now),null);
console.log('PASS source retention: original quarters/precision/quality, estimated vs measured values, 25h DST, empty/coarse responses and all 70 calendar months across the full provider window.');
