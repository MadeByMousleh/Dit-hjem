import {readFile,writeFile,rename} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import jpeg from 'jpeg-js';
import {targetRegion} from '../color-trainer/semantic.mjs';
import {split} from '../color-trainer/model.mjs';
const folder=dirname(fileURLToPath(import.meta.url)),source=resolve(folder,'../auto-color/data');
const read=async path=>JSON.parse(await readFile(path,'utf8').catch(e=>{if(e.code==='ENOENT')return 'null';throw e;}));
const manifest=await read(folder+'/data/manifest.json');
if(!manifest)throw Error('Existing pilot manifest required');
const observations=await read(folder+'/data/observations.json');
if(manifest.houses.some(h=>!observations?.houses.some(o=>o.id===h.id)))throw Error('Finish the existing batch before expanding');
const seen=new Set(manifest.houses.map(h=>h.buildingId)),added=[],quota={train:15,test:5};
const list=await read(source+'/review-list.json');
for(const entry of list.items){
 if(!quota.train&&!quota.test)break;
 const root=source+'/houses/'+entry.id;
 const task=await read(root+'/pilot.json'),review=await read(root+'/review.json'),dataset=await read(root+'/appearance-dataset.json');
 if(['excluded','skipped'].includes(review?.status)||!task?.buildingId||seen.has(task.buildingId)||!task.inputFile||!dataset?.teacher?.visibilityAccepted)continue;
 const group=split(task.buildingId);if(!quota[group])continue;
 const input=await read(root+'/'+task.inputFile);if(!input?.photos?.photos)continue;
 const checks=dataset.teacher.result.obliqueVisibility??[],views=[],hashes=new Set();
 for(const [index,photo]of input.photos.photos.entries()){
  const id=`oblique-${photo.direction}-${index}`;
  if(photo.direction==='nadir'||!checks.some(c=>c.imageId===id&&c.mainHouseVisible&&c.confidence>=.9))continue;
  try{
   const sha256=createHash('sha256').update(photo.image).digest('hex');if(hashes.has(sha256))continue;
   const image=jpeg.decode(Buffer.from(photo.image.split(',')[1],'base64'),{maxResolutionInMP:2,maxMemoryUsageInMB:48});
   const bounds=targetRegion({config:input},photo,image.width,image.height);
   views.push({id,kind:'aerial',direction:photo.direction,path:root+'/'+task.inputFile,index,bounds,sha256});hashes.add(sha256);
  }catch{/* Uncalibrated/unreadable photos are not used. */}
  if(views.length===2)break;
 }
 if(views.length<2)continue;
 added.push({id:entry.id,buildingId:task.buildingId,address:task.address?.text??task.listing?.address?.text,split:group,teacherTargets:[],batch:'chimney-oblique-v1',views});
 seen.add(task.buildingId);quota[group]--;
}
if(!added.length)throw Error('No new eligible cached oblique houses');
const next={...manifest,updatedAt:new Date().toISOString(),protocol:'Chimneys only; new houses use cached calibrated oblique photos only; human labels required; physical-building holdout',houses:[...manifest.houses,...added]};
await writeFile(folder+'/data/manifest.tmp',JSON.stringify(next));await rename(folder+'/data/manifest.tmp',folder+'/data/manifest.json');
console.log(JSON.stringify({addedHouses:added.length,addedPhotos:added.reduce((n,h)=>n+h.views.length,0),train:added.filter(h=>h.split==='train').length,test:added.filter(h=>h.split==='test').length}));
