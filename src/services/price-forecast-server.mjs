import{createAdminClient}from'@supabase/server/core';
import{cachedEnergySource}from'./energinet-source-cache.mjs';
import{refreshEnerginetTariffs}from'./energinet-prices-server.mjs';
import{tariffSupplier}from'./energinet-tariff-catalog.mjs';
import{forecastSpotHours,calculatePriceForecast}from'./price-forecast-core.mjs';
export async function fetchPriceForecastPacket({fetcher=fetch,now=Date.now()}={}){
 const response=await fetcher('https://elpriser.dk/data/prognose.json',{signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Object.assign(Error('Prognosekilden er midlertidigt utilgængelig.'),{status:response.status===429?429:502});
 const text=await response.text();if(Buffer.byteLength(text)>1000000)throw Error('For stor prognosepakke');const body=JSON.parse(text);
 for(const area of['DK1','DK2'])forecastSpotHours(body,area,{now});
 return [body]; // Archive the original issue and its source attribution together.
}
export async function getGridPriceForecast(query,{adminFactory=createAdminClient,cache=cachedEnergySource,fetcher=fetch,now=Date.now()}={}){
 const supplier=tariffSupplier(query.supplierId),area=query.priceArea;
 if(!supplier||supplier.area!==area)throw Object.assign(Error('Netselskab eller prisområde kunne ikke matches.'),{status:400});
 const admin=adminFactory();
 const[packet,tariffRows]=await Promise.all([
  cache({admin,key:'elpriser-v1:forecast',after:now-3600000,now,load:()=>fetchPriceForecastPacket({fetcher,now})}),
  refreshEnerginetTariffs({admin,fetcher,now,cache}),
 ]);
 if(!Array.isArray(packet)||packet.length!==1)throw Error('Ugyldig gemt prognose');
 return calculatePriceForecast({body:packet[0],area,supplierId:supplier.id,tariffRows,now});
}
