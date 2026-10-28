import {fromUrl} from 'geotiff';
import proj4 from 'proj4';
import {photoCalibration,photoCrop} from './home-photo-projection.mjs';
// Public aerial imagery; credentials stay server-side. No caller-provided URLs.
const root='https://api.dataforsyningen.dk/rest/skraafoto_api/v1.0';
const allowedCdn=['https://cdn.dataforsyningen.dk','https://skraafoto-cdn.dataforsyningen.dk'];
const directions=['south','east','north','west'];
const utm='+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs';
const problem=(message,status=502)=>Object.assign(new Error(message),{status});

function validatedAsset(item){
 const thumb=new URL(item.assets?.thumbnail?.href),asset=new URL(thumb.searchParams.get('url'));
 if(thumb.origin!=='https://api.dataforsyningen.dk'||!allowedCdn.includes(asset.origin)||!asset.pathname.startsWith('/skraafoto_server/')||asset.username||asset.password)throw problem('Ukendt billedkilde.');
 return asset.href;
}
/** Calibrated oblique photographs covering the point; by default only the newest survey per direction (within 30 days of its newest photo). */
export async function getHistoricalPhotoSources({x,y},{token,fetcher=fetch,signal=AbortSignal.timeout(20000),firstYear=2014,latestOnly=true}={}){
 if(!Number.isFinite(x)||!Number.isFinite(y)||x<7||x>16||y<54||y>59)throw problem('Ugyldigt billedopslag.',400);
 if(!token?.trim())throw problem('Boligbilleder er ikke konfigureret endnu.',503);
 const year=new Date().getUTCFullYear(),windows=[];
 for(let end=year+1;end>firstYear;end-=2)windows.push([Math.max(firstYear,end-2),end]);
 const [east,north]=proj4('EPSG:4326',utm,[x,y]),found=new Map();let failures=0;
 await Promise.all(directions.flatMap(direction=>windows.map(async([start,end])=>{
  try{
   const params=new URLSearchParams({limit:'100',datetime:`${start}-01-01T00:00:00Z/${end}-01-01T00:00:00Z`,intersects:JSON.stringify({type:'Point',coordinates:[x,y]}),'filter-lang':'cql-json',filter:JSON.stringify({eq:[{property:'direction'},direction]})});
   const response=await fetcher(`${root}/search?${params}`,{headers:{token:token.trim(),Accept:'application/geo+json'},signal,redirect:'error'});
   if(!response.ok)throw problem('Skråfoto kunne ikke hentes.');
   const data=await response.json();if(!Array.isArray(data.features))throw problem('Ugyldigt billedsvar.');
   for(const item of data.features){
    if(item.properties?.direction!==direction||!Number.isFinite(Date.parse(item.properties?.datetime))||typeof item.id!=='string')continue;
    try{found.set(item.id,{id:item.id,direction,capturedAt:item.properties.datetime,asset:validatedAsset(item),camera:photoCalibration(item.properties)});}catch{/* uncalibrated or unknown source: not usable */}
   }
  }catch{failures++;}
 })));
 if(!found.size&&failures)throw problem('Skråfoto kunne ikke hentes lige nu. Prøv igen senere.');
 const newest=new Map();for(const p of found.values())newest.set(p.direction,Math.max(newest.get(p.direction)??0,Date.parse(p.capturedAt)));
 const recent=[...found.values()].filter(p=>!latestOnly||newest.get(p.direction)-Date.parse(p.capturedAt)<30*86400000);
 return {photos:recent.filter(p=>Math.hypot(p.camera.center[0]-east,p.camera.center[1]-north)<6000).sort((a,b)=>Date.parse(b.capturedAt)-Date.parse(a.capturedAt)),failures};
}

/** Native-resolution RGB window around the given 3D points; null if it cannot be bounded sensibly. */
export async function readPhotoWindow(photo,points,{token,signal=AbortSignal.timeout(24000)}){
 const crop=photoCrop(photo.camera,points);if(!crop)return null;
 const tiff=await fromUrl(photo.asset,{headers:{token:token.trim()},allowFullFile:false,cacheSize:12},signal),image=await tiff.getImage();
 if(image.getWidth()!==photo.camera.sensor[0]||image.getHeight()!==photo.camera.sensor[1])return null;
 const width=crop[2]-crop[0],height=crop[3]-crop[1],rgb=await image.readRGB({window:crop,interleave:true,signal});
 if(rgb.length!==width*height*3)return null;
 return {left:crop[0],top:crop[1],width,height,rgb};
}
