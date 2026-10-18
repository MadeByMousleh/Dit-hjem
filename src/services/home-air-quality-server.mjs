import { findAddressSuggestionById } from './address-search.mjs';
const cache=new Map();
const datasets=[['NO2','kvaelstofdioxid-no2'],['PM2.5','fine-partikler-pm2-5'],['PM10','partikler-pm10'],['O3','ozon-o3']];
function contains(rings,x,y){
  const inside=ring=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
  return rings?.length&&inside(rings[0])&&!rings.slice(1).some(inside);
}
export async function getHomeAirQuality({x,y,id},{fetcher=fetch}={}){
  if(id){if(typeof id!=='string'||! /^[0-9a-f-]{36}$/i.test(id))throw Object.assign(new Error('Ugyldig adresse.'),{status:400});const address=await findAddressSuggestionById(id,fetcher);x=address.x;y=address.y;}
  x=Number(x);y=Number(y);if(!Number.isFinite(x)||!Number.isFinite(y)||x<7.8||x>15.3||y<54.4||y>58)throw Object.assign(new Error('Ugyldige koordinater.'),{status:400});
  const key=`${x.toFixed(5)},${y.toFixed(5)}`,cached=cache.get(key);if(cached&&Date.now()-cached.at<(cached.value.readings.every(r=>r.status==='available')?86400000:60000))return cached.value;
  const signal=AbortSignal.timeout(15000);
  const readings=await Promise.all(datasets.map(async([pollutant,name])=>{
    const datasetId=`urn:dmp:ds:koncentration-2021-${name}`;
    try{
      // Dataset identifiers retain 2021 even when the actual release is newer.
      const meta=await fetcher(`https://datakatalog.miljoeportal.dk/api/dcat/datasets/${datasetId}`,{signal,redirect:'error'});
      if(!meta.ok)throw Error();const xml=await meta.text();
      const links=[...xml.matchAll(/<dcat:accessURL rdf:resource="([^"]+)"/g)].map(m=>m[1].replace(/&amp;/g,'&'));
      const source=links.map(link=>new URL(link)).find(u=>u.hostname==='arld-extgeo.miljoeportal.dk'&&u.pathname==='/geoserver/wfs');
      if(!source)throw Error();
      const layer=source.searchParams.get('TYPENAMES');if(!/^luft:[A-Za-z0-9_]+$/.test(layer??''))throw Error();
      source.search=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:layer,outputFormat:'application/json',srsName:'EPSG:4326',count:'5',bbox:`${x-0.000001},${y-0.000001},${x+0.000001},${y+0.000001},EPSG:4326`});
      const r=await fetcher(source,{signal,redirect:'error'});if(!r.ok)throw Error();const result=await r.json();
      if(!Array.isArray(result.features)||result.numberMatched>5)throw Error();
      const feature=result.features.find(f=>f.geometry?.type==='Polygon'&&contains(f.geometry.coordinates,x,y));
      const properties=feature?.properties,field=pollutant==='PM2.5'?'PM2_5':pollutant;
      const value=properties?.[field];const year=Number(properties?.Aarstal);
      if(typeof value!=='number'||!Number.isFinite(value)||value<0||!Number.isInteger(year)||year<2000||year>new Date().getFullYear())throw Error();
      return {pollutant,value,year,unit:'µg/m³',status:'available',datasetId};
    }catch{return {pollutant,status:'unavailable',datasetId};}
  }));
  const value={readings,fetchedAt:new Date().toISOString(),source:'DCE · Aarhus Universitet / Danmarks Miljøportal · CC BY 4.0',notice:'Modelleret årsmiddel for områdets gridcelle. Ikke en måling ved huset eller luftkvaliteten lige nu.'};
  if(readings.some(r=>r.status==='available')){if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,{at:Date.now(),value});}return value;
}
