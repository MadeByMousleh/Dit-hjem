import assert from 'node:assert/strict';
import{readFile}from'node:fs/promises';
import{calculateEnerginetPrices,applicableTariff,priceLocalTime,tariffDkk}from'../src/services/energinet-prices-core.mjs';
import{getEnerginetPrices}from'../src/services/energinet-prices-server.mjs';
import{pointInGeometry}from'../src/services/grid-lookup.mjs';
const row=(code,value,from='2026-01-01T00:00:00',to=null)=>({GLN_Number:code==='CD'?'5790001089030':'5790000432752',ChargeType:'D03',ChargeTypeCode:code,ValidFrom:from,ValidTo:to,ResolutionDuration:'P1D',Price1:value});
const tariffs=[row('CD',.1),row('40000',.043),row('41000',.072),row('EA-001',.008)];
const calculate=(spot=-1000,at='2026-10-27T00:00:00')=>calculateEnerginetPrices({supplierId:'n1_c',area:'DK1',from:at+'Z',to:new Date(Date.parse(at+'Z')+900000).toISOString(),spotRows:[{TimeUTC:at,PriceArea:'DK1',DayAheadPriceDKK:spot}],tariffRows:tariffs})[0];
assert.ok(Math.abs(calculate().totalOrePerKwh-(-1+.223)*125)<1e-10); // Negative total survives, VAT once.
assert.ok(Math.abs(calculate(0).gridAndTaxOrePerKwh-.223*125)<1e-10);
assert.equal(applicableTariff([row('CD',1,'2026-01-01T00:00:00','2026-10-01T00:00:00'),row('CD',2,'2026-10-01T00:00:00')],'5790001089030','CD','2026-10-01T00:00:00').Price1,2);
assert.throws(()=>applicableTariff([], '5790001089030','CD','2026-10-01T00:00:00'),/mangler/);
assert.equal(tariffDkk({...row('CD',0),ResolutionDuration:'PT1H',Price18:null},17),0);
assert.equal(priceLocalTime('2026-10-25T00:30:00Z'),'2026-10-25T02:30:00');
assert.equal(priceLocalTime('2026-10-25T01:30:00Z'),'2026-10-25T02:30:00');
const ring=[[0,0],[10,0],[10,10],[0,10],[0,0]],hole=[[2,2],[8,2],[8,8],[2,8],[2,2]];
assert.equal(pointInGeometry({x:5,y:5},{type:'Polygon',coordinates:[ring,hole]}),false);
assert.equal(pointInGeometry({x:1,y:1},{type:'Polygon',coordinates:[ring,hole]}),true);
// Real, cached public source packet is optional; deterministic arithmetic above always runs.
try{
 const tariffRows=JSON.parse(await readFile('.tmp/energinet-migration/selected-tariffs.json')).records;
 const raw=JSON.parse(await readFile('.tmp/energinet-migration/spot-comparison.json')).records;
 const calls=[];
 const cache=async({key})=>{calls.push(key);return key.endsWith('tariffs')?tariffRows:raw.map(raw_record=>({raw_record}));};
 const options={adminFactory:()=>({}),cache,now:Date.parse('2026-10-27T15:00:00Z')};
 const data=await getEnerginetPrices({supplierId:'n1_c',priceArea:'DK1'},options);
 assert.equal(data.points.length,96);assert.equal(data.source.id,'energinet-v1');assert.equal(calls.length,2);
 await assert.rejects(()=>getEnerginetPrices({supplierId:'n1_c',priceArea:'DK2'},options),/matches/);
 await assert.rejects(()=>getEnerginetPrices({supplierId:'n1_c',priceArea:'DK1'},{...options,cache:async({key})=>key.endsWith('tariffs')?tariffRows:raw.filter(r=>r.TimeUTC!=='2026-10-27T12:00:00').map(raw_record=>({raw_record}))}),/manglende intervaller/);
 console.log('Public source packet and server completeness checks passed.');
}catch(error){if(error.code!=='ENOENT')throw error;}
console.log('Energinet negative prices, VAT, tariff validity, DST and boundary-hole checks passed.');
