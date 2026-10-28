import {fromUrl} from 'geotiff';
import jpeg from 'jpeg-js';
import proj4 from 'proj4';
import {getHomeGeometry} from './home-geometry-server.mjs';
import {getHomeHeights} from './home-height-server.mjs';
import {getHomePhotos} from './home-photos-server.mjs';
import {photoCalibration,photoCrop} from './home-photo-projection.mjs';
import {neighborhoodPhotoPlan} from './neighborhood-photo-plan.mjs';
const cache=new Map(),utm='+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs';
const failure=(message,status=502)=>Object.assign(Error(message),{status});
async function readCrop(item,corners,{token}){
 const camera=photoCalibration(item.properties),crop=photoCrop(camera,corners);if(!crop)return null;
 const signal=AbortSignal.timeout(24000),tiff=await fromUrl(item.asset,{headers:{token:token.trim()},allowFullFile:false,cacheSize:12},signal),image=await tiff.getImage();
 if(image.getWidth()!==camera.sensor[0]||image.getHeight()!==camera.sensor[1])return null;
 const scale=Math.min(1,1024/Math.max(crop[2]-crop[0],crop[3]-crop[1])),width=Math.max(1,Math.round((crop[2]-crop[0])*scale)),height=Math.max(1,Math.round((crop[3]-crop[1])*scale));
 const rgb=await image.readRGB({window:crop,width,height,interleave:true,signal});if(rgb.length!==width*height*3)return null;
 const rgba=Buffer.alloc(width*height*4);for(let i=0,j=0;i<rgb.length;i+=3,j+=4){rgba[j]=rgb[i];rgba[j+1]=rgb[i+1];rgba[j+2]=rgb[i+2];rgba[j+3]=255;}
 const bytes=jpeg.encode({data:rgba,width,height},88).data;if(bytes.length>350000)return null;
 return {direction:item.direction,capturedAt:item.capturedAt,camera:{...camera,crop},width,height,image:`data:image/jpeg;base64,${bytes.toString('base64')}`};
}
export async function getNeighborhoodModelPhotos({id,tile},{apiKey=process.env.DATAFORDELER_API_KEY,token=process.env.DATAFORSYNINGEN_TOKEN||process.env.DATAFORSYNING_API_KEY,fetcher=fetch,geometryLoader=getHomeGeometry,heightLoader=getHomeHeights,sourceLoader=getHomePhotos,photoReader=readCrop,useCache=true}={}){
 if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id)||tile!==undefined&&(typeof tile!=='string'||!/^\d-\d$/.test(tile)))throw failure('Ugyldigt nabobilledopslag.',400);
 if(!apiKey?.trim()||!token?.trim())throw failure('Billedadgang er ikke konfigureret.',503);
 const key=`${id}:neighbors-v1:${tile??'plan'}`,cached=cache.get(key);if(useCache&&cached&&Date.now()-cached.at<3600000)return cached.value;
 const geometry=await geometryLoader({id,surroundings:'1'},{apiKey,fetcher}),plan=neighborhoodPhotoPlan(geometry);
 let value={addressId:id,photos:[],neighborhood:{...plan,tile:tile??null},status:'plan',source:'Skråfoto © KDS · CC BY 4.0'};
 if(tile!==undefined){
  const selected=plan.tiles.find(t=>t.id===tile);if(!selected)throw failure('Billedudsnittet findes ikke.',400);
  const buildings=geometry.buildings.filter(b=>selected.buildingIds.includes(b.id)),points=buildings.flatMap(b=>b.rings.flat());
  const x=(Math.min(...points.map(p=>p[0]))+Math.max(...points.map(p=>p[0])))/2,y=(Math.min(...points.map(p=>p[1]))+Math.max(...points.map(p=>p[1])))/2;
  const [longitude,latitude]=proj4(utm,'EPSG:4326',[x,y]);
  const [heights,sources]=await Promise.all([heightLoader({id,surroundings:'1'},{apiKey,fetcher}),sourceLoader({x:longitude,y:latitude},{token,fetcher,sourcesOnly:true})]);
  const terrain=heights.terrain.filter(Number.isFinite).sort((a,b)=>a-b);if(!terrain.length)throw failure('Højder mangler til nabofacader.');
  const local=[],left=Math.min(...points.map(p=>p[0]))-5,right=Math.max(...points.map(p=>p[0]))+5,bottom=Math.min(...points.map(p=>p[1]))-5,top=Math.max(...points.map(p=>p[1]))+5;
  if(heights.bbox)for(let row=0;row<heights.height;row++)for(let col=0;col<heights.width;col++){
   const px=heights.bbox[0]+(col+.5)/heights.width*(heights.bbox[2]-heights.bbox[0]),py=heights.bbox[3]-(row+.5)/heights.height*(heights.bbox[3]-heights.bbox[1]),z=heights.terrain[row*heights.width+col];
   if(px>=left&&px<=right&&py>=bottom&&py<=top&&Number.isFinite(z))local.push(z);
  }
  const low=local.length?Math.min(...local):terrain[Math.floor(terrain.length/2)],high=(local.length?Math.max(...local):low)+Math.max(...buildings.map(b=>b.height))+12,corners=points.flatMap(([x,y])=>[[x,y,low-1],[x,y,high]]);
  const photos=(await Promise.all([...new Map(sources.filter(s=>s.direction!=='nadir').map(s=>[s.direction,s])).values()].slice(0,4).map(async item=>{try{return await photoReader(item,corners,{token});}catch{return null;}}))).filter(Boolean);
  value={...value,photos,status:photos.length>=2?'available':'partial'};
 }
 if(useCache&&(tile===undefined||value.status==='available')){if(cache.size>=48)cache.delete(cache.keys().next().value);cache.set(key,{at:Date.now(),value});}
 return value;
}
