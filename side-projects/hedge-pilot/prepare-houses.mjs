// Uses two existing randomly selected public example properties, never a search
// derived from the first garden or a user's private address.
import dotenv from 'dotenv';
import {readFile,writeFile,mkdir,stat,rename,link,copyFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {lidarDownloadUrl} from '../../src/services/home-lidar-server.mjs';
import {loadEdcSource} from './edc-source.mjs';
dotenv.config({path:'.env.local',quiet:true});dotenv.config({path:'.env',quiet:true});
const folder=dirname(fileURLToPath(import.meta.url)),data=folder+'/data';await mkdir(data+'/tiles',{recursive:true});
const key=process.env.DATAFORDELER_API_KEY;if(!key)throw Error('LiDAR access not configured');
const requestedTask=process.argv.find(arg=>arg.startsWith('--task='))?.slice(7);
const requestedEdc=process.argv.find(arg=>arg.startsWith('--edc-house='))?.slice(12);
if(requestedEdc&&!/^[a-f0-9-]{36}$/i.test(requestedEdc))throw Error('Invalid EDC house ID');
if(requestedTask&&!/^[a-f0-9-]{36}$/i.test(requestedTask))throw Error('Invalid cached task ID');
const taskIds=requestedEdc?[requestedEdc]:requestedTask?[requestedTask]:['b3ad47ef-5939-437a-8984-2017cea129a9','d5466856-d505-438f-b062-8b7524f56a84'];
for(const taskId of taskIds){
 const edc=requestedEdc?await loadEdcSource(taskId):null;
 const task=edc?.task??JSON.parse(await readFile(resolve(folder,`../color-trainer/data/task-${taskId}.json`),'utf8'));
 if(!edc&&!task.selection?.method?.startsWith('Random street'))throw Error('Expected existing random public example');
 const g=edc?.geometry??task.config.geometry,dir=data+'/houses/'+g.addressId;await mkdir(dir,{recursive:true});
 await writeFile(dir+'/geometry.json',JSON.stringify(g));await writeFile(dir+'/meta.json',JSON.stringify({addressId:g.addressId,label:task.address.text,selection:edc?{method:'Random eligible cached EDC house',url:edc.entry.url}:task.selection,sourceTaskId:taskId,edcId:edc?taskId:undefined}));
 const vertices=g.parcels.flatMap(p=>p.polygons.flat(2));
 const bbox=[Math.min(...vertices.map(p=>p[0])),Math.min(...vertices.map(p=>p[1])),Math.max(...vertices.map(p=>p[0])),Math.max(...vertices.map(p=>p[1]))];
 if(bbox[2]-bbox[0]>160||bbox[3]-bbox[1]>160)throw Error('Parcel exceeds bounded garden trial');
 const url=new URL('https://api.datafordeler.dk/FileDownloads/v1.0/GetAvailablePointCloudFileDownloads');url.search=new URLSearchParams({apiKey:key,Register:'DHM',Version:'1',MinX:String(bbox[0]),MinY:String(bbox[1]),MaxX:String(bbox[2]),MaxY:String(bbox[3]),PageNumber:'1'});
 const r=await fetch(url,{signal:AbortSignal.timeout(25000),redirect:'error'});if(!r.ok)throw Error(`LiDAR catalog HTTP ${r.status}`);
 const catalog=await r.json();if(catalog.paginationMetadata?.totalPages!==1)throw Error('Unexpected catalog pages');
 const files=(catalog.availableFileDownloads??[]).filter(f=>f.fileFormat==='laz'&&f.dataSetName==='Punktsky').sort((a,b)=>b.dataDeliveryNumber-a.dataDeliveryNumber);
 const selected=files.find(f=>f.boundingBox.minX<=bbox[0]&&f.boundingBox.minY<=bbox[1]&&f.boundingBox.maxX>=bbox[2]&&f.boundingBox.maxY>=bbox[3]);
 if(!selected||!/^[a-f0-9-]{36}$/i.test(selected.id)||!Number.isSafeInteger(selected.fileSizeInBytes)||selected.fileSizeInBytes>600*1048576)throw Error('No single bounded LiDAR tile covers this parcel');
 const tile={id:selected.id,bytes:selected.fileSizeInBytes,bbox:[selected.boundingBox.minX,selected.boundingBox.minY,selected.boundingBox.maxX,selected.boundingBox.maxY]};
 await writeFile(dir+'/catalog.json',JSON.stringify({selected:tile,selectedTiles:[tile]}));
 const target=data+'/tiles/'+tile.id+'.laz';
 if((await stat(target).catch(()=>null))?.size!==tile.bytes){
  const response=await fetch(lidarDownloadUrl(tile.id,key),{signal:AbortSignal.timeout(240000),redirect:'error'});if(!response.ok)throw Error(`LiDAR download HTTP ${response.status}`);
  let bytes=0,lastProgress=0;await pipeline(Readable.fromWeb(response.body),new Transform({transform(chunk,encoding,done){bytes+=chunk.length;if(bytes>tile.bytes)return done(Error('LiDAR exceeds expected size'));if(bytes-lastProgress>=32*1048576){lastProgress=bytes;console.log(JSON.stringify({downloadedMiB:Math.floor(bytes/1048576),totalMiB:Math.ceil(tile.bytes/1048576)}));}done(null,chunk);}}),createWriteStream(target+'.tmp'));
  if(bytes!==tile.bytes)throw Error('Incomplete LiDAR download');await rename(target+'.tmp',target);
 }
 const local=dir+'/'+tile.id+'.laz';if(!(await stat(local).catch(()=>null)))await link(target,local).catch(()=>copyFile(target,local));
 await copyFile(resolve(folder,'../../scripts/lidar/crop-parcel.py'),dir+'/crop-parcel.py');
 console.log(JSON.stringify({addressId:g.addressId,label:task.address.text,tile:tile.id,tileMiB:Math.round(tile.bytes/1048576),readyForCrop:true}));
}
