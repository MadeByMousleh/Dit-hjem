/** Local-only experiment: two least-steep recent original photos per direction. */
import dotenv from 'dotenv';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fromUrl} from 'geotiff';
import jpeg from 'jpeg-js';
import {photoCalibration,photoCrop} from '../src/services/home-photo-projection.mjs';
dotenv.config({path:'.env.local',quiet:true});dotenv.config({path:'.env',quiet:true});
const folder='.tmp/lidar-parcel',g=JSON.parse(await readFile(`${folder}/geometry.json`,'utf8'));
const token=process.env.DATAFORSYNINGEN_TOKEN||process.env.DATAFORSYNING_API_KEY;
if(!token)throw Error('Image access not configured');
await mkdir(`${folder}/facade-references`,{recursive:true});
const photos=[],corners=g.buildings.filter(b=>b.main).flatMap(b=>b.rings.flat().flatMap(([x,y])=>[[x,y,6],[x,y,20]]));
for(const direction of ['north','east','south','west']){
 const year=new Date().getUTCFullYear();
 const params=new URLSearchParams({limit:'100',datetime:`${year-2}-01-01T00:00:00Z/${year+1}-01-01T00:00:00Z`,intersects:JSON.stringify({type:'Point',coordinates:[g.longitude,g.latitude]}),'filter-lang':'cql-json',filter:JSON.stringify({eq:[{property:'direction'},direction]})});
 const r=await fetch(`https://api.dataforsyningen.dk/rest/skraafoto_api/v1.0/search?${params}`,{headers:{token},signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw Error(`Photo search HTTP ${r.status}`);
 const data=await r.json(),items=data.features.filter(f=>f.properties.direction===direction);
 const newest=Math.max(...items.map(f=>Date.parse(f.properties.datetime)));
 const angle=f=>{const c=f.properties['pers:perspective_center'];return Math.atan2(c[2]-8,Math.hypot(c[0]-g.point[0],c[1]-g.point[1]));};
 for(const [index,item]of items.filter(f=>newest-Date.parse(f.properties.datetime)<86400000*30).sort((a,b)=>angle(a)-angle(b)).slice(0,2).entries()){
  const camera=photoCalibration(item.properties),crop=photoCrop(camera,corners);if(!crop)continue;
  const asset=new URL(new URL(item.assets.thumbnail.href).searchParams.get('url'));
  if(!['https://cdn.dataforsyningen.dk','https://skraafoto-cdn.dataforsyningen.dk'].includes(asset.origin)||!asset.pathname.startsWith('/skraafoto_server/'))throw Error('Unexpected imagery origin');
  const signal=AbortSignal.timeout(30000),tiff=await fromUrl(asset.href,{headers:{token},allowFullFile:false,cacheSize:12},signal),image=await tiff.getImage();
  if(image.getWidth()!==camera.sensor[0]||image.getHeight()!==camera.sensor[1])throw Error('Camera/image mismatch');
  const width=crop[2]-crop[0],height=crop[3]-crop[1];if(width*height>4000000)throw Error('Crop too large');
  const rgb=await image.readRGB({window:crop,interleave:true,signal}),rgba=Buffer.alloc(width*height*4);
  for(let i=0,j=0;i<rgb.length;i+=3,j+=4){rgba[j]=rgb[i];rgba[j+1]=rgb[i+1];rgba[j+2]=rgb[i+2];rgba[j+3]=255;}
  const bytes=jpeg.encode({data:rgba,width,height},95).data,viewId=`${direction}-${index+1}`;
  await writeFile(`${folder}/facade-references/${viewId}.jpg`,bytes);
  photos.push({viewId,direction,capturedAt:item.properties.datetime,sourceId:item.id,width,height,camera:{...camera,crop},image:`data:image/jpeg;base64,${bytes.toString('base64')}`});
  console.log(JSON.stringify({viewId,width,height,downwardAngle:Math.round(angle(item)*180/Math.PI)}));
 }
}
await writeFile(`${folder}/facade-references/photos.json`,JSON.stringify({addressId:g.addressId,photos}));
