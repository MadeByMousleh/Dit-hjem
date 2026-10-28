import AsyncStorage from '@react-native-async-storage/async-storage';
import{API_URL}from'./supabase';
import{writeOptionalCache}from'./local-storage-cache.mjs';
import type{PricePoint,GridSupplier}from'../prices';
export type PriceForecast={points:PricePoint[];generatedAt:string;unavailableDays:{day:string;reason:string}[]};
const ttl=15*60000,cache=new Map<string,{value:PriceForecast;at:number}>(),pending=new Map<string,Promise<PriceForecast>>();
function decode(value:any):PriceForecast{
 if(!Array.isArray(value?.points)||value.points.length>200||!Number.isFinite(Date.parse(value.generatedAt)))throw Error('Ugyldig prognose');
 const points=value.points.map((p:any)=>({...p,startsAt:new Date(p.startsAt)}));
 if(points.some((p:PricePoint)=>p.forecast!==true||p.intervalMinutes!==60||![+p.startsAt,p.priceDkkMwh,p.totalOrePerKwh,p.gridAndTaxOrePerKwh,p.forecastLowerOrePerKwh,p.forecastUpperOrePerKwh].every(v=>typeof v==='number'&&Number.isFinite(v))))throw Error('Ugyldige prognosetal');
 if(Date.now()-Date.parse(value.generatedAt)>6*3600000)throw Error('Prognosen er for gammel');
 return {...value,points};
}
export function fetchPriceForecast(supplier:Pick<GridSupplier,'area'|'id'>):Promise<PriceForecast>{
 const key=supplier.area+':'+supplier.id,entry=cache.get(key);if(entry&&Date.now()-entry.at<ttl)return Promise.resolve(entry.value);
 const running=pending.get(key);if(running)return running;
 const request=(async()=>{
  const storageKey='stromblik.public-prices.energinet-v1.forecast.'+key;
  try{const raw=await AsyncStorage.getItem(storageKey),stored=raw?JSON.parse(raw):null;if(stored&&stored.at<=Date.now()&&Date.now()-stored.at<ttl){const value=decode(stored.value);cache.set(key,{value,at:stored.at});return value;}}catch{/* Fetch an updated public forecast. */}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try{
   const res=await fetch(API_URL+'/api/grid/lookup?'+new URLSearchParams({operation:'forecast',supplierId:supplier.id,priceArea:supplier.area}),{signal:controller.signal});if(!res.ok)throw Error('Prognosen er midlertidigt utilgængelig.');
   const body=await res.json();if(body.source?.id!=='elpriser-v1')throw Error('Ukendt prognosekilde');const value=decode(body),entry={value,at:Date.now()};cache.set(key,entry);void writeOptionalCache(AsyncStorage,storageKey,JSON.stringify(entry));return value;
  }finally{clearTimeout(timer);}
 })().finally(()=>pending.delete(key));pending.set(key,request);return request;
}
export function mergePriceForecast(published:PricePoint[],forecast:PricePoint[]):PricePoint[]{
 const occupied=new Set(published.map(p=>Math.floor(+p.startsAt/3600000)));
 return [...published,...forecast.filter(p=>p.forecast===true&&!occupied.has(Math.floor(+p.startsAt/3600000)))].sort((a,b)=>+a.startsAt-+b.startsAt);
}
