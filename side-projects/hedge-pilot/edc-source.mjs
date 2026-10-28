import {readFile} from 'node:fs/promises';
import {dirname,resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../auto-color/data');
const read=async path=>JSON.parse(await readFile(path,'utf8').catch(e=>{if(e.code==='ENOENT')return 'null';throw e;}));
export async function edcCandidates(excludedIds=new Set(),excludedBuildings=new Set()){
 const list=await read(root+'/review-list.json'),result=[],seen=new Set();
 for(const entry of list?.items??[]){
  if(!/^[a-f0-9-]{36}$/i.test(entry.id))continue;
  let url;try{url=new URL(entry.url);}catch{continue;}if(!['edc.dk','www.edc.dk'].includes(url.hostname))continue;
  const task=await read(root+'/houses/'+entry.id+'/pilot.json'),review=await read(root+'/houses/'+entry.id+'/review.json');
  if(['excluded','skipped'].includes(review?.status)||!task?.inputFile||!task.address?.id||!task.buildingId||excludedIds.has(task.address.id)||excludedBuildings.has(task.buildingId)||seen.has(task.buildingId))continue;
  seen.add(task.buildingId);result.push({edcId:entry.id,houseId:task.address.id,label:task.address.text,buildingId:task.buildingId});
 }
 return result;
}
export async function loadEdcSource(id){
 if(!/^[a-f0-9-]{36}$/i.test(id??''))throw Error('Ugyldigt EDC-id');
 const list=await read(root+'/review-list.json'),entry=list?.items.find(e=>e.id===id);let url;try{url=new URL(entry?.url);}catch{throw Error('Ukendt EDC-hus');}
 if(!['edc.dk','www.edc.dk'].includes(url.hostname))throw Error('Kilden er ikke EDC');
 const dir=root+'/houses/'+id,task=await read(dir+'/pilot.json'),review=await read(dir+'/review.json');
 if(['excluded','skipped'].includes(review?.status)||!task?.inputFile||basename(task.inputFile)!==task.inputFile)throw Error('Huset er fravalgt eller mangler data');
 const input=await read(dir+'/'+task.inputFile),geometry=input?.geometry;
 if(!geometry?.parcels?.length||geometry.addressId!==task.address?.id||!geometry.buildings?.some(b=>b.main))throw Error('Husets geometri mangler');
 const vertices=geometry.parcels.flatMap(p=>p.polygons.flat(2)),xs=vertices.map(p=>p[0]),ys=vertices.map(p=>p[1]);
 if(!vertices.length||Math.max(...xs)-Math.min(...xs)>160||Math.max(...ys)-Math.min(...ys)>160)throw Error('Grunden er for stor til havepiloten');
 return {task,geometry,input,entry};
}
