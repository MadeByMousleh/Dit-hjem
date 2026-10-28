// Compare two predictions at the same timestamps. This does not measure accuracy against future actual prices.
import{readFile,writeFile}from'node:fs/promises';
import{calculatePriceForecast}from'../src/services/price-forecast-core.mjs';
const dir='.tmp/price-forecast',body=JSON.parse(await readFile(dir+'/elpriser.json')),tariffRows=JSON.parse(await readFile('.tmp/energinet-migration/selected-tariffs.json')).records,results=[];
for(const[supplierId,area]of[['n1_c','DK1'],['radius_c','DK2']]){
 const ours=calculatePriceForecast({body,area,supplierId,tariffRows,now:Date.now()}),reference=JSON.parse(await readFile(dir+'/reference-'+area+'.json')),byTime=new Map(reference.prices.filter(p=>p.forecast===true).map(p=>[p.date,p])),pairs=[];
 for(const point of ours.points){const ref=byTime.get(point.startsAt);if(!ref)continue;pairs.push({at:point.startsAt,ourTotalOre:point.totalOrePerKwh,referenceTotalOre:ref.price.total*100,ourSpotOre:point.priceDkkMwh/10,referenceSpotOre:ref.details.electricity.value*100,lowerOre:point.forecastLowerOrePerKwh,upperOre:point.forecastUpperOrePerKwh});}
 if(!pairs.length)throw Error('Ingen overlappende prognosetimer for '+area);
 const n=pairs.length,totalDelta=p=>p.ourTotalOre-p.referenceTotalOre,spotDelta=p=>p.ourSpotOre-p.referenceSpotOre;
 const result={area,supplierId,hours:n,ourAverageOre:pairs.reduce((s,p)=>s+p.ourTotalOre,0)/n,referenceAverageOre:pairs.reduce((s,p)=>s+p.referenceTotalOre,0)/n,meanAbsoluteDifferenceOre:pairs.reduce((s,p)=>s+Math.abs(totalDelta(p)),0)/n,meanAbsoluteSpotDifferenceOre:pairs.reduce((s,p)=>s+Math.abs(spotDelta(p)),0)/n,maxDifferenceOre:Math.max(...pairs.map(p=>Math.abs(totalDelta(p)))),biasOre:pairs.reduce((s,p)=>s+totalDelta(p),0)/n,referenceWithinBandFraction:pairs.filter(p=>p.referenceTotalOre>=p.lowerOre&&p.referenceTotalOre<=p.upperOre).length/n,pairs};results.push(result);
 console.log(JSON.stringify({...result,pairs:undefined}));
}
await writeFile(dir+'/comparison.json',JSON.stringify({comparedAt:new Date().toISOString(),forecastSourceGeneratedAt:body.generatedAt,notAnAccuracyBacktest:true,results},null,2));
