// Explicit opt-in public address comparison, maximum 100; no household DB access.
import{readFile,writeFile,mkdir}from'node:fs/promises';
import{findGridSupplier}from'../src/services/grid-lookup.mjs';
import{matchAddressSupplier}from'../src/services/grid-supplier-match.mjs';
import{ENERGINET_GRID_SUPPLIERS}from'../src/services/energinet-tariff-catalog.mjs';
const dir='.tmp/energinet-migration',maximum=Math.min(100,Math.max(1,Number(process.argv[2]??100)));await mkdir(dir,{recursive:true});
const providers=JSON.parse(await readFile(dir+'/provider-comparison.json')).results,results=[];
const towns=['9000','8200','5250','6700','4000','6400','8800','7400','3400','4700','3700','4300','5700','9800','8920','6000','2830','2630','8600','7800','4760','4900','5610','7100','6855','6960','7600','7900','7700','9900','3000','4600'];
const seen=new Set();let attempts=0;
for(const {town,street} of ['Birkevej','Skovvej','Engvej'].flatMap(street=>towns.map(town=>({street,town})))){
 if(results.length>=maximum)break;
 const path=dir+'/addresses-'+(street==='Birkevej'?'':street+'-')+town+'.json';let addresses;
 try{addresses=JSON.parse(await readFile(path));}catch{
  try{const response=await fetch('https://huslyg.dk/api/address/search?'+new URLSearchParams({q:street+' '+town}),{signal:AbortSignal.timeout(20000)});if(!response.ok){console.log(JSON.stringify({town,status:response.status}));continue;}
  addresses=await response.json();await writeFile(path,JSON.stringify(addresses));}catch(error){console.log(JSON.stringify({town,error:error.message}));continue;}
 }
 for(const address of addresses.filter(a=>a.postcode===town&&Number.isFinite(a.x)&&Number.isFinite(a.y)).slice(0,5)){
  if(results.length>=maximum)break;if(seen.has(address.id))continue;seen.add(address.id);attempts++;
  try{const grid=await findGridSupplier(address.x,address.y),supplier=matchAddressSupplier(grid,ENERGINET_GRID_SUPPLIERS),comparison=providers.find(p=>p.id===supplier?.id);
   results.push({addressId:address.id,address:address.text,postcode:town,grid,supplierId:supplier?.id??null,priceArea:supplier?.area??null,pass:comparison?.pass===true,intervals:comparison?.intervals??0,maxDifferenceOre:comparison?.maxDifferenceOre??null});
  }catch(error){results.push({addressId:address.id,address:address.text,postcode:town,pass:false,error:error.message});}
 }
 console.log(JSON.stringify({town,checked:results.length,pass:results.filter(r=>r.pass).length}));
 await writeFile(dir+'/address-comparison.json',JSON.stringify({maximum,attempts,results},null,2));
}
console.log(JSON.stringify({addresses:results.length,pass:results.filter(r=>r.pass).length,uniqueTariffs:new Set(results.map(r=>r.supplierId).filter(Boolean)).size,failed:results.filter(r=>!r.pass)}));
