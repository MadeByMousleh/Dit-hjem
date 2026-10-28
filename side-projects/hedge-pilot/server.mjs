import {createRandomHouseRunner} from './random-house.mjs';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,rename,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {hedgeCandidates} from './detect.mjs';
import {projectPhoto} from '../../src/services/home-photo-projection.mjs';
import {validatePointSelection,resolvePointSelections} from './point-labels.mjs';
import {trainPilot} from './train.mjs';
import {completeGarden} from './complete.mjs';
const folder=dirname(fileURLToPath(import.meta.url)),data=folder+'/data',host='127.0.0.1:8794';
await mkdir(data,{recursive:true});
const raw=await readFile(resolve(folder,'../../.tmp/lidar-parcel/parcel-points.json'),'utf8'),source=JSON.parse(raw);
const photos=JSON.parse(await readFile(data+'/photos.json','utf8').catch(e=>{if(e.code==='ENOENT')return readFile(resolve(folder,'../../.tmp/lidar-parcel/material-photos.json'),'utf8');throw e;}));
const geometry=JSON.parse(await readFile(resolve(folder,'../../.tmp/lidar-parcel/geometry.json'),'utf8'));
if(source.addressId!==photos.addressId||source.addressId!==geometry.addressId||source.crs!=='EPSG:7416'||JSON.stringify(source.parcelIds)!==JSON.stringify(geometry.parcels.map(p=>p.id))||JSON.stringify(source.polygons)!==JSON.stringify(geometry.parcels.flatMap(p=>p.polygons)))throw Error('Property source mismatch');
const sourceHash=createHash('sha256').update(raw+'parcel-edge-vegetation-v1').digest('hex'),analysis=hedgeCandidates(source);
const displayPhotos=photos=>photos.photos.filter(p=>p.direction!=='nadir'||photos.includeNadir===true);
const views=displayPhotos(photos).map((photo,index)=>({id:String(index),direction:photo.direction,contextLabel:photo.contextLabel,capturedAt:photo.capturedAt,width:photo.width,height:photo.height,paths:analysis.candidates.map(c=>{const path=[c.start,[c.start[0],c.start[1],c.start[2]+c.height],[c.end[0],c.end[1],c.end[2]+c.height],c.end,c.start].map(p=>{const projected=projectPhoto(photo.camera,p);if(!projected)return null;const [l,t,r,b]=photo.camera.crop;return [(projected[0]-l)/(r-l)*photo.width,(projected[1]-t)/(b-t)*photo.height];});return {id:c.id,points:path.every(Boolean)?path:null};})}));
const houses=new Map([[source.addressId,{source,photos,geometry,sourceHash,analysis,views,label:'Den første have',ready:true}]]);
async function registerHouse(id){
 if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('Invalid house ID');
 const dir=data+'/houses/'+id;
 const meta=JSON.parse(await readFile(dir+'/meta.json','utf8'));
 if(meta.addressId!==id)throw Error('House metadata mismatch');
 try{
  const raw=await readFile(dir+'/parcel-points.json','utf8'),source=JSON.parse(raw),photos=JSON.parse(await readFile(dir+'/photos.json','utf8')),geometry=JSON.parse(await readFile(dir+'/geometry.json','utf8'));
  if(source.addressId!==id||source.addressId!==photos.addressId||source.addressId!==geometry.addressId||source.crs!=='EPSG:7416'||!source.points?.length||photos.photos.length<2||JSON.stringify(source.parcelIds)!==JSON.stringify(geometry.parcels.map(p=>p.id))||JSON.stringify(source.polygons)!==JSON.stringify(geometry.parcels.flatMap(p=>p.polygons)))throw Error('Property source mismatch');
  const sourceHash=createHash('sha256').update(raw+'parcel-edge-vegetation-v1').digest('hex'),analysis=hedgeCandidates(source);
  const views=displayPhotos(photos).map((photo,index)=>({id:String(index),direction:photo.direction,contextLabel:photo.contextLabel,capturedAt:photo.capturedAt,width:photo.width,height:photo.height,paths:analysis.candidates.map(c=>({id:c.id,points:[c.start,[c.start[0],c.start[1],c.start[2]+c.height],[c.end[0],c.end[1],c.end[2]+c.height],c.end,c.start].map(point=>{const pixel=projectPhoto(photo.camera,point);if(!pixel)return null;const [l,t,r,b]=photo.camera.crop;return [(pixel[0]-l)/(r-l)*photo.width,(pixel[1]-t)/(b-t)*photo.height];})})).map(path=>({...path,points:path.points.every(Boolean)?path.points:null}))}));
  houses.set(id,{source,photos,geometry,sourceHash,analysis,views,label:meta.label,ready:true});
 }catch(error){if(error.code!=='ENOENT')throw error;houses.set(id,{label:meta.label,ready:false});}
 if(!houses.get(id)?.ready)throw Error('House data not ready');
}
for(const entry of await readdir(data+'/houses',{withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return [];throw e;})){
 if(!entry.isDirectory()||!/^[a-f0-9-]{36}$/i.test(entry.name))continue;
 try{await registerHouse(entry.name);}catch(error){if(!houses.has(entry.name)||houses.get(entry.name).ready)throw error;}
}
const bundle=await build({entryPoints:[folder+'/viewer.js'],bundle:true,format:'esm',write:false});
let writing=Promise.resolve(),trainingBusy=false,trainingProgress={status:'idle',percent:0,message:''};
const randomHouses=await createRandomHouseRunner({register:registerHouse,existing:()=>({ids:new Set(houses.keys()),buildings:new Set([...houses.values()].flatMap(h=>h.geometry?.buildings.filter(b=>b.main).map(b=>b.id)??[]))})});
async function reviews(){return JSON.parse(await readFile(data+'/reviews.json','utf8').catch(e=>{if(e.code==='ENOENT')return '{}';throw e;}));}
async function pointSelections(){return JSON.parse(await readFile(data+'/point-selections.json','utf8').catch(e=>{if(e.code==='ENOENT')return '{}';throw e;}));}
async function learnedSuggestions(houseId,house){
 const saved=JSON.parse(await readFile(data+'/proposals.json','utf8').catch(e=>{if(e.code==='ENOENT')return '{}';throw e;})),proposal=saved.houses?.[houseId];
 if(!proposal||proposal.sourceHash!==house.sourceHash)return {indices:[],createdAt:null};
 const painted=new Set(resolvePointSelections((await pointSelections())[house.sourceHash]).flatMap(r=>r.indices));
 return {indices:proposal.indices.filter(i=>!painted.has(i)),createdAt:saved.createdAt,snapshotHash:saved.snapshotHash,seenInTraining:proposal.seenInTraining};
}
const server=createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'");
 const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
 try{
  if(req.headers.host!==host||(req.headers.origin&&req.headers.origin!==`http://${host}`))return json({error:'Fremmed oprindelse'},403);
  const url=new URL(req.url,`http://${host}`);
  if(req.method==='GET'&&url.pathname==='/api/houses')return json({houses:[...houses].map(([id,h])=>({id,label:h.label,ready:h.ready}))});
  if(req.method==='GET'&&url.pathname==='/api/random-house')return json(randomHouses.status());
  if(req.method==='POST'&&url.pathname==='/api/random-house'){
   if(req.headers['x-hedge-pilot']!=='1'||!req.headers['content-type']?.startsWith('application/json'))return json({error:'Ugyldig forespørgsel'},403);
   if(trainingBusy)return json({error:'Vent til træningen er færdig'},409);
   let body='';for await(const chunk of req){body+=chunk;if(body.length>1024)throw Error('For stor forespørgsel');}const value=JSON.parse(body||'{}');
   return json(await randomHouses.start({retry:value.retry===true}),202);
  }
  if(req.method==='GET'&&url.pathname==='/api/train-progress')return json(trainingProgress);
  if(req.method==='GET'&&url.pathname==='/api/training')return json(JSON.parse(await readFile(data+'/training.json','utf8').catch(e=>{if(e.code==='ENOENT')return '{"status":"not-trained"}';throw e;})));
  if(req.method==='GET'&&url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(await readFile(folder+'/index.html'));}
  if(req.method==='GET'&&url.pathname==='/viewer.js'){res.setHeader('Content-Type','text/javascript');return res.end(bundle.outputFiles[0].contents);}
  const houseId=url.searchParams.get('house')??source.addressId,house=houses.get(houseId);
  if(req.method==='POST'&&url.pathname==='/api/train'){
   if(randomHouses.status().status==='running')return json({error:'Vent til det nye testhus er hentet og markeret'},409);
   if(req.headers['x-hedge-pilot']!=='1'||!req.headers['content-type']?.startsWith('application/json'))return json({error:'Ugyldig forespørgsel'},403);
   if(trainingBusy)return json({error:'Træningen kører allerede'},409);
   let length=0;for await(const chunk of req){length+=chunk.length;if(length>1024)throw Error('For stor forespørgsel');}
   trainingBusy=true;trainingProgress={status:'running',percent:0,message:'Starter træning …'};
   try{await writing;const result=await trainPilot({onProgress:value=>{trainingProgress={status:'running',...value};}});trainingProgress={status:'done',percent:100,message:'Træning færdig'};return json(result);}
   catch(error){trainingProgress={...trainingProgress,status:'failed',message:'Træningen mislykkedes'};throw error;}
   finally{trainingBusy=false;}
  }
  if(req.method==='GET'&&url.pathname==='/api/data'){if(!house?.ready)return json({error:'Husets LiDAR og havefotos er endnu ikke hentet'},409);return json({addressId:houseId,label:house.label,sourceHash:house.sourceHash,polygons:house.source.polygons,points:house.source.points,analysis:house.analysis,views:house.views.map(v=>({...v,camera:displayPhotos(house.photos)[Number(v.id)].camera})),reviews:(await reviews())[house.sourceHash]??{},pointSelections:(await pointSelections())[house.sourceHash]??[],learnedSuggestions:await learnedSuggestions(houseId,house)});}
  if(req.method==='GET'&&url.pathname==='/photo'){const view=house?.ready&&house.views.find(v=>v.id===url.searchParams.get('id'));if(!view)return json({error:'Ukendt foto'},404);const photo=displayPhotos(house.photos)[Number(view.id)];res.setHeader('Content-Type','image/jpeg');return res.end(Buffer.from(photo.image.split(',')[1],'base64'));}
  if(req.method==='POST'&&url.pathname==='/api/review')return json({error:'Use the point brush; box labels are retired.'},410);
  if(req.method==='POST'&&url.pathname==='/api/complete-garden'){
   if(trainingBusy)return json({error:'Vent til træningen er færdig'},409);
   if(req.headers['x-hedge-pilot']!=='1'||!req.headers['content-type']?.startsWith('application/json'))return json({error:'Ugyldig forespørgsel'},403);
   let body='';for await(const chunk of req){body+=chunk;if(body.length>1024)throw Error('For stor forespørgsel');}const value=JSON.parse(body),selected=houses.get(value.houseId);
   if(!selected?.ready||selected.sourceHash!==value.sourceHash)throw Error('Forkert hus eller datakilde');
   let selections;
   writing=writing.catch(()=>{}).then(async()=>{const saved=await pointSelections(),rows=saved[selected.sourceHash]??[];
    await mkdir(data+'/point-history',{recursive:true});await writeFile(data+'/point-history/'+randomUUID()+'.json',JSON.stringify({houseId:value.houseId,sourceHash:selected.sourceHash,rows}));
    selections=completeGarden(selected.source.points,rows,{houseId:value.houseId,sourceHash:selected.sourceHash,id:'selection-'+randomUUID()});saved[selected.sourceHash]=selections;
    await writeFile(data+'/point-selections.tmp',JSON.stringify(saved));await rename(data+'/point-selections.tmp',data+'/point-selections.json');});await writing;return json({saved:true,selections});
  }
  if(req.method==='POST'&&url.pathname==='/api/point-selection'){
   if(trainingBusy)return json({error:'Vent et øjeblik til træningen er færdig'},409);
   if(req.headers['x-hedge-pilot']!=='1'||!req.headers['content-type']?.startsWith('application/json'))return json({error:'Ugyldig forespørgsel'},403);
   let body='';for await(const chunk of req){body+=chunk;if(body.length>512000)throw Error('For stor markering');}const value=JSON.parse(body),selected=houses.get(value.houseId),indices=validatePointSelection(value,selected);
   let selection,selections;
   writing=writing.catch(()=>{}).then(async()=>{const saved=await pointSelections();const rows=saved[selected.sourceHash]??=[];const wasCompleted=rows.some(r=>r.origin==='garden-completion');if(value.id&&!rows.some(r=>r.id===value.id))throw Error('Markeringen findes ikke på dette hus');
    selection={id:value.id??'selection-'+randomUUID(),houseId:value.houseId,sourceHash:selected.sourceHash,kind:value.kind,indices,at:new Date().toISOString(),actor:'user'};const index=rows.findIndex(r=>r.id===selection.id);if(index<0)rows.push(selection);else rows[index]=selection;
    if(wasCompleted)saved[selected.sourceHash]=completeGarden(selected.source.points,rows,{houseId:value.houseId,sourceHash:selected.sourceHash,id:'selection-'+randomUUID()});
    selections=saved[selected.sourceHash];await writeFile(data+'/point-selections.tmp',JSON.stringify(saved));await rename(data+'/point-selections.tmp',data+'/point-selections.json');});await writing;return json({saved:true,selection,selections});
  }
  return json({error:'Ikke fundet'},404);
 }catch(error){return json({error:error.message},400);}
});
server.listen(8794,'127.0.0.1',()=>console.log(JSON.stringify({url:`http://${host}`,candidates:analysis.candidates.length,vegetationPoints:analysis.vegetationPoints,views:views.length})));
