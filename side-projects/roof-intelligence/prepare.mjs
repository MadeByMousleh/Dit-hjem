import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import jpeg from 'jpeg-js';
import {targetRegion} from '../color-trainer/semantic.mjs';
import {split} from '../color-trainer/model.mjs';
const folder=dirname(fileURLToPath(import.meta.url)),source=resolve(folder,'../auto-color/data');
const read=async path=>JSON.parse(await readFile(path,'utf8').catch(e=>{if(e.code==='ENOENT')return 'null';throw e;}));
export async function prepare(limit=12){
 if(await read(folder+'/data/manifest.json'))throw Error('Pilot already exists. Use expand.mjs and worker.py --incremental to preserve reviews and existing detections.');
 const list=await read(source+'/review-list.json'),candidates=[];
 for(const entry of list.items){
  const root=source+'/houses/'+entry.id,task=await read(root+'/pilot.json'),review=await read(root+'/review.json'),dataset=await read(root+'/appearance-dataset.json');
  if(['excluded','skipped'].includes(review?.status)||!task?.buildingId||!task.inputFile||!dataset?.teacher?.visibilityAccepted)continue;
  const labels=dataset.teacher.result.labels.filter(l=>['roof.solar_panels','roof.skylights'].includes(l.target)&&l.accepted&&l.value==='present'&&l.confidence>=.9);
  if(!labels.length)continue;
  candidates.push({entry,root,task,dataset,labels,priority:labels.some(l=>l.target==='roof.solar_panels')?0:1});
 }
 candidates.sort((a,b)=>a.priority-b.priority);
 const houses=[],seen=new Set();
 for(const {entry,root,task,dataset,labels}of candidates){
  if(houses.length>=limit)break;if(seen.has(task.buildingId))continue;
  const input=await read(root+'/'+task.inputFile),exterior=await read(root+'/exterior-views.json');if(!input?.photos?.photos)continue;
  const views=[];
  const saleIds=[...new Set(labels.flatMap(l=>l.evidence.map(e=>e.imageId)).filter(id=>id.startsWith('sale-')))];
  for(const id of saleIds.slice(0,2)){
   const cached=exterior?.views?.find(v=>v.id===id&&v.accepted&&v.subject==='main_house');let image,path,index;
   if(cached?.file){path=root+'/'+cached.file;image=(await read(path))?.image;}
   else{index=task.images?.findIndex(p=>p.id===id);if(index>=0){path=root+'/pilot.json';image=task.images[index].image;}}
   if(image)views.push({id,kind:'sale',path,index,sha256:createHash('sha256').update(image).digest('hex')});
  }
  const checks=dataset.teacher.result.obliqueVisibility??[];
  for(const [index,photo]of input.photos.photos.entries()){
   if(photo.direction==='nadir')continue;
   const id=`oblique-${photo.direction}-${index}`,check=checks.find(c=>c.imageId===id&&c.mainHouseVisible&&c.confidence>=.9);if(!check)continue;
   try{const decoded=jpeg.decode(Buffer.from(photo.image.split(',')[1],'base64'),{maxResolutionInMP:2,maxMemoryUsageInMB:48});const bounds=targetRegion({config:input},photo,decoded.width,decoded.height);views.push({id,kind:'aerial',direction:photo.direction,path:root+'/'+task.inputFile,index,bounds,sha256:createHash('sha256').update(photo.image).digest('hex')});}catch{}
   if(views.filter(v=>v.kind==='aerial').length===3)break;
  }
  if(!views.some(v=>v.kind==='sale')||views.filter(v=>v.kind==='aerial').length<2)continue;
  seen.add(task.buildingId);houses.push({id:entry.id,buildingId:task.buildingId,address:task.address?.text??task.listing?.address?.text,split:split(task.buildingId),teacherTargets:[...new Set(labels.map(l=>l.target==='roof.solar_panels'?'solar_panel':'skylight'))],views});
 }
 const manifest={version:1,createdAt:new Date().toISOString(),protocol:'EDC plus at least two calibrated visible aerial views; explicit house exclusions retained; colour approval is separate',houses};
 await mkdir(folder+'/data',{recursive:true});await writeFile(folder+'/data/manifest.json',JSON.stringify(manifest));return {houses:houses.length,views:houses.reduce((n,h)=>n+h.views.length,0),solarHouses:houses.filter(h=>h.teacherTargets.includes('solar_panel')).length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await prepare()));
