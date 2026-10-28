// Read-only public imagery download. Credentials remain local, in request headers.
import dotenv from 'dotenv';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fromCustomClient} from 'geotiff';
import jpeg from 'jpeg-js';
import {getHomePhotos} from '../../src/services/home-photos-server.mjs';
import {photoCalibration,photoCrop} from '../../src/services/home-photo-projection.mjs';
dotenv.config({path:'.env.local',quiet:true});dotenv.config({path:'.env',quiet:true});
const folder=dirname(fileURLToPath(import.meta.url));
const houseId=process.argv.find(arg=>arg.startsWith('--house='))?.slice(8);
if(houseId&&!/^[a-f0-9-]{36}$/i.test(houseId))throw Error('Invalid house');
const data=houseId?folder+'/data/houses/'+houseId:folder+'/data';await mkdir(data,{recursive:true});
const g=JSON.parse(await readFile(houseId?data+'/geometry.json':resolve(folder,'../../.tmp/lidar-parcel/geometry.json'),'utf8'));
const source=JSON.parse(await readFile(houseId?data+'/parcel-points.json':resolve(folder,'../../.tmp/lidar-parcel/parcel-points.json'),'utf8'));
if(g.addressId!==source.addressId)throw Error('Source mismatch');
const cached=JSON.parse(await readFile(data+'/photos.json','utf8').catch(error=>{if(error.code==='ENOENT')return 'null';throw error;}));
if(cached?.addressId===g.addressId&&cached.photos?.filter(photo=>photo.camera&&photo.width>0&&photo.height>0&&photo.image?.startsWith('data:image/jpeg;base64,')).length>=2){
 console.log(JSON.stringify({status:'cached',photos:cached.photos.length}));process.exit(0);
}
const token=process.env.DATAFORSYNINGEN_TOKEN||process.env.DATAFORSYNING_API_KEY;if(!token)throw Error('Photo credentials not configured');
const items=await getHomePhotos({x:g.longitude,y:g.latitude},{token,sourcesOnly:true});
const zs=source.points.filter(p=>p[3]===2).map(p=>p[2]).sort((a,b)=>a-b);const base=zs[Math.floor(zs.length/2)];if(!Number.isFinite(base))throw Error('No measured ground');
const corners=source.polygons.flatMap(poly=>poly[0].flatMap(([x,y])=>[[x,y,base-2],[x,y,base+10]]));
const photos=[],directions=new Set();
for(const item of items){
 if(item.direction==='nadir'||directions.has(item.direction))continue;
 try{
  const camera=photoCalibration(item.properties),crop=photoCrop(camera,corners);if(!crop)continue;
  const signal=AbortSignal.timeout(30000);
  // Reject missing assets before geotiff schedules background range requests.
  const probe=await fetch(item.asset,{headers:{token:token.trim(),Range:'bytes=0-15'},signal});
  await probe.body?.cancel();
  if(!probe.ok)throw Error(`Imagery HTTP ${probe.status}`);
  const client={request:async({headers,signal})=>{const r=await fetch(item.asset,{headers,signal});if(!r.ok)throw Error(`Imagery HTTP ${r.status}`);return {status:r.status,ok:r.ok,getHeader:name=>r.headers.get(name),getData:()=>r.arrayBuffer()};}};
  const tiff=await fromCustomClient(client,{headers:{token:token.trim()},allowFullFile:false,cacheSize:12,blockSize:16384},signal),image=await tiff.getImage();
  if(image.getWidth()!==camera.sensor[0]||image.getHeight()!==camera.sensor[1])continue;
  const width=crop[2]-crop[0],height=crop[3]-crop[1];if(width*height>4000000)continue;
  const rgb=await image.readRGB({window:crop,interleave:true,signal}),rgba=Buffer.alloc(width*height*4);
  for(let i=0,j=0;i<rgb.length;i+=3,j+=4){rgba[j]=rgb[i];rgba[j+1]=rgb[i+1];rgba[j+2]=rgb[i+2];rgba[j+3]=255;}
  const bytes=jpeg.encode({data:rgba,width,height},95).data;
  photos.push({direction:item.direction,capturedAt:item.capturedAt,width,height,camera:{...camera,crop},image:`data:image/jpeg;base64,${Buffer.from(bytes).toString('base64')}`});directions.add(item.direction);
  console.log(JSON.stringify({direction:item.direction,width,height}));
 }catch(error){const reason=String(error.message).replaceAll(token,'[redacted]').replace(/https?:\/\/\S+/g,'[url]').slice(0,160);console.log(JSON.stringify({direction:item.direction,status:'unavailable',reason}));}
}
if(photos.length<2)throw Error('Fewer than two parcel photographs available; existing cache retained');
await writeFile(data+'/photos.tmp',JSON.stringify({addressId:g.addressId,source:'Skråfoto © KDS · Dataforsyningen · CC BY 4.0',photos}));await rename(data+'/photos.tmp',data+'/photos.json');
