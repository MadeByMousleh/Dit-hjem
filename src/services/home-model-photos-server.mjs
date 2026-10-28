import {fromUrl} from 'geotiff';
import jpeg from 'jpeg-js';
import {getHomeGeometry} from './home-geometry-server.mjs';
import {getHomeHeights} from './home-height-server.mjs';
import {getHomePhotos} from './home-photos-server.mjs';
import {photoCalibration,photoCrop} from './home-photo-projection.mjs';
const cache=new Map();
export async function getHomeModelPhotos({id},{apiKey=process.env.DATAFORDELER_API_KEY,token=process.env.DATAFORSYNINGEN_TOKEN||process.env.DATAFORSYNING_API_KEY,fetcher=fetch}={}){
 if(typeof id!=='string'||! /^[0-9a-f-]{36}$/i.test(id))throw Object.assign(new Error('Ugyldig adresse.'),{status:400});
 if(!token?.trim()||!apiKey?.trim())throw Object.assign(new Error('Billedadgang er ikke konfigureret.'),{status:503});
 const existing=cache.get(id);if(existing&&Date.now()-existing.at<3600000)return existing.value;
 const g=await getHomeGeometry({id},{apiKey,fetcher});
 const [heightResult,sources]=await Promise.all([getHomeHeights({id},{apiKey,fetcher}).catch(()=>null),getHomePhotos({x:g.longitude,y:g.latitude},{token,fetcher,sourcesOnly:true,facadeViews:true})]);
 const main=g.buildings.filter(b=>b.main);if(!main.length)return {addressId:id,photos:[],status:'no_building',source:'KDS · Skråfoto · CC BY 4.0'};
 if(!heightResult||!heightResult.terrain.some(v=>v!==null))return {addressId:id,photos:[],status:'height_unavailable',source:'KDS · Skråfoto · CC BY 4.0'};
 const vertices=main.flatMap(b=>b.rings.flat());
 const validGround=heightResult?.terrain.filter(v=>v!==null)??[];validGround.sort((a,b)=>a-b);
 const ground=validGround[Math.floor(validGround.length/2)]??0;
 // Generous vertical bounds cover measured roofs and their eaves. Coordinates
 // use actual terrain elevation, never the gallery's approximate 20 m marker.
 const high=ground+Math.max(...main.map(b=>b.height))+12;
 const corners=vertices.flatMap(([x,y])=>[[x,y,ground-1],[x,y,high]]);
 const photos=(await Promise.all(sources.map(async item=>{
  try{
   // The vertical original also covers the complete parcel: project it onto
   // measured terrain, rather than stretching an oblique gallery screenshot.
   const groundCorners=item.direction==='nadir'?[[g.bbox[0],g.bbox[1],ground-1],[g.bbox[0],g.bbox[3],ground-1],[g.bbox[2],g.bbox[1],ground-1],[g.bbox[2],g.bbox[3],ground-1]]:[];
   const camera=photoCalibration(item.properties),crop=photoCrop(camera,[...corners,...groundCorners]);if(!crop)return null;
   const signal=AbortSignal.timeout(24000);
   const tiff=await fromUrl(item.asset,{headers:{token:token.trim()},allowFullFile:false,cacheSize:12},signal);const image=await tiff.getImage();
   if(image.getWidth()!==camera.sensor[0]||image.getHeight()!==camera.sensor[1])return null;
   const scale=Math.min(1,1024/Math.max(crop[2]-crop[0],crop[3]-crop[1]));const width=Math.round((crop[2]-crop[0])*scale),height=Math.round((crop[3]-crop[1])*scale);
   const rgb=await image.readRGB({window:crop,width,height,interleave:true,signal});if(rgb.length!==width*height*3)return null;
   const rgba=Buffer.alloc(width*height*4);for(let i=0,j=0;i<rgb.length;i+=3,j+=4){rgba[j]=rgb[i];rgba[j+1]=rgb[i+1];rgba[j+2]=rgb[i+2];rgba[j+3]=255;}
   const bytes=Buffer.from(jpeg.encode({data:rgba,width,height},88).data);if(bytes.length>350000)return null;
   return {direction:item.direction,capturedAt:item.capturedAt,camera:{...camera,crop},width,height,image:`data:image/jpeg;base64,${bytes.toString('base64')}`};
  }catch{return null;}
 }))).filter(Boolean);
 // Older clients have a five-photo shader; extra references are an opt-in field.
 const usedDirections=new Set(),renderPhotos=[],analysisPhotos=[];
 for(const photo of photos){if(usedDirections.has(photo.direction))analysisPhotos.push(photo);else{usedDirections.add(photo.direction);renderPhotos.push(photo);}}
 const value={addressId:id,photos:renderPhotos,analysisPhotos,status:photos.length?'available':'unavailable',source:'Skråfoto © KDS · Dataforsyningen · CC BY 4.0',notice:'Fotografier projiceret med kamerakalibrering. Træer og forskelle i optagelsesdato eller modelgeometri kan give fejl. Skjulte flader forbliver forenklede.'};
 if(photos.length>=5){if(cache.size>=8)cache.delete(cache.keys().next().value);cache.set(id,{at:Date.now(),value});}return value;
}
