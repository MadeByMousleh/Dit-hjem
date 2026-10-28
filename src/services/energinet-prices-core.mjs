import{ENERGINET_COMMON_CHARGES,tariffSupplier}from'./energinet-tariff-catalog.mjs';
const localFormat=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Copenhagen',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export function priceLocalTime(at){return localFormat.format(new Date(at)).replace(' ','T');}
export function applicableTariff(rows,gln,code,localTime,optional=false){
 const matches=rows.filter(r=>r.GLN_Number===gln&&r.ChargeType==='D03'&&r.ChargeTypeCode===code&&r.ValidFrom<=localTime&&(!r.ValidTo||localTime<r.ValidTo)).sort((a,b)=>b.ValidFrom.localeCompare(a.ValidFrom));
 if(!matches.length){if(optional)return null;throw Error('Tarif mangler: '+gln+'/'+code+' ved '+localTime.slice(0,10));}
 if(matches.length>1&&matches[0].ValidFrom===matches[1].ValidFrom&&JSON.stringify(matches[0])!==JSON.stringify(matches[1]))throw Error('Modstridende tarifversioner: '+gln+'/'+code);
 return matches[0];
}
export function tariffDkk(row,hour){
 if(!row)return 0;
 if(!['PT1H','P1D'].includes(row.ResolutionDuration))throw Error('Ukendt tarifopløsning');
 const cell=row.ResolutionDuration==='P1D'?row.Price1:(row['Price'+(hour+1)]??row.Price1);
 if(typeof cell!=='number'||!Number.isFinite(cell))throw Error('Ugyldig tarifværdi');return cell;
}
export function calculateEnerginetPrices({supplierId,area,spotRows,tariffRows,from,to}){
 const supplier=tariffSupplier(supplierId);if(!supplier||supplier.area!==area)throw Error('Ukendt netselskab eller prisområde');
 const lower=Date.parse(from),upper=Date.parse(to);if(!Number.isFinite(lower)||!Number.isFinite(upper)||lower>=upper)throw Error('Ugyldig prisperiode');
 const result=[],seen=new Set();
 const indexed=new Map(),resolved=new Map();
 for(const r of tariffRows){const key=r.GLN_Number+'/'+r.ChargeTypeCode,group=indexed.get(key)??[];group.push(r);indexed.set(key,group);}
 for(const row of spotRows){
  if(row.PriceArea!==area)continue;
  const text=row.TimeUTC??row.HourUTC;const start=Date.parse(/Z$/.test(text??'')?text:text+'Z');if(start<lower||start>=upper)continue;
  const spot=row.DayAheadPriceDKK??row.SpotPriceDKK;
  if(!Number.isFinite(start)||typeof spot!=='number'||!Number.isFinite(spot))throw Error('Ugyldig spotpris');
  const local=priceLocalTime(start),hour=Number(local.slice(11,13)),components=[];
  const plan=supplier.history.find(p=>local.slice(0,10)<p.before)??supplier;
  for(const[gln,codes,optional]of[[supplier.gln,plan.tariffCodes,false],[supplier.gln,plan.optionalCodes,true],[ENERGINET_COMMON_CHARGES.gln,ENERGINET_COMMON_CHARGES.tariffCodes,false]]){
   for(const code of codes){const key=gln+'/'+code+'/'+local.slice(0,13);let tariff;if(resolved.has(key))tariff=resolved.get(key);else{tariff=applicableTariff(indexed.get(gln+'/'+code)??[],gln,code,local,optional);resolved.set(key,tariff);}if(tariff)components.push({gln,code,validFrom:tariff.ValidFrom,validTo:tariff.ValidTo,value:tariffDkk(tariff,hour)});}
  }
  // Energinet publishes DKK/MWh spot and DKK/kWh tariff amounts excluding VAT.
  // Household C prices use Danish 25% VAT once, including negative amounts.
  const gridDkk=components.reduce((sum,c)=>sum+c.value,0),key=new Date(start).toISOString();if(seen.has(key))throw Error('Dubleret spotinterval');seen.add(key);
  result.push({startsAt:key,priceDkkMwh:spot,totalOrePerKwh:(spot/1000+gridDkk)*125,gridAndTaxOrePerKwh:gridDkk*125,source:'energinet-v1',components});
 }
 return result.sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
}
