import jpeg from 'jpeg-js';
import {createHash} from 'node:crypto';
import {photoKey} from './sampling.mjs';
import {polygonMask} from './polygon.mjs';
import {PART_LABELS} from './part-labels.mjs';
import {houseProposal} from './house-proposal.mjs';
import {readHouseAICandidate} from './house-ai.mjs';

export const emptyParts=id=>({version:1,taskId:id,revision:0,status:'draft',objects:[],regions:[],completePhotos:[],mainCompletePhotos:[],history:[]});
const validId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/i.test(id);
export async function readParts(store,id){if(!validId(id))throw Error('Ugyldigt opgave-id.');return await store.read(`parts-${id}.json`)??emptyParts(id);}
export async function saveParts(store,id,input,{aiCacheRoot}={}){
  return store.serial(async()=>{
    if(!validId(id))throw Error('Ugyldigt opgave-id.');
    const task=await store.read(`task-${id}.json`);if(!task)throw Error('Huset findes ikke.');
    const previous=await readParts(store,id);
    if(input.revision!==previous.revision)throw Error('Markeringerne er ændret. Genindlæs dem før du gemmer.');
    if(!['draft','reviewed','skipped'].includes(input.status)||!Array.isArray(input.objects)||input.objects.length>32||!Array.isArray(input.regions)||input.regions.length>128||!Array.isArray(input.completePhotos))throw Error('Ugyldige bygningsdele.');
    const photos=new Map(task.config.photos.photos.map(p=>[photoKey(p),p])),kinds=new Map(PART_LABELS.map(p=>[p.id,p]));
    const objectIds=new Set(),regionIds=new Set();
    const objects=input.objects.map(o=>{
      if(!validId(o.id)||objectIds.has(o.id)||!kinds.has(o.category)||!(typeof o.includeInModel==='boolean'||o.includeInModel===null))throw Error('Ugyldig bygningsdel.');
      if(o.category==='unknown'&&o.includeInModel!==null)throw Error('Usikre dele skal have ukendt medtagelse.');
      objectIds.add(o.id);return {id:o.id,category:o.category,includeInModel:o.includeInModel};
    });
    const references=new Map();
    const sourceFor=key=>{
      if(references.has(key))return references.get(key);
      const p=photos.get(key);if(!p)throw Error('Markeringen matcher ikke et originalfoto.');
      const bytes=Buffer.from(p.image.split(',')[1],'base64'),image=jpeg.decode(bytes,{maxMemoryUsageInMB:48,maxResolutionInMP:2});
      const reference={photoKey:key,direction:p.direction,capturedAt:p.capturedAt,width:image.width,height:image.height,imageSha256:createHash('sha256').update(bytes).digest('hex'),camera:p.camera};
      references.set(key,reference);return reference;
    };
    const regions=input.regions.map(r=>{
      if(!validId(r.id)||regionIds.has(r.id)||!objectIds.has(r.objectId))throw Error('Ugyldigt omrids eller bygningsdel.');
      regionIds.add(r.id);const photo=sourceFor(r.photoKey),mask=polygonMask(r.points,photo.width,photo.height);
      if(mask.indices.length<9)throw Error('Omridset er for lille til at blive gemt.');
      return {id:r.id,objectId:r.objectId,photoKey:r.photoKey,points:r.points.map(p=>[...p])};
    });
    const completePhotos=[...new Set(input.completePhotos)];for(const key of completePhotos)sourceFor(key);
    if(input.mainCompletePhotos!==undefined&&!Array.isArray(input.mainCompletePhotos))throw Error('Ugyldig afgrænsning af hovedhuset.');
    const mainCompletePhotos=[...new Set(input.mainCompletePhotos??previous.mainCompletePhotos??[])];
    for(const key of mainCompletePhotos){sourceFor(key);if(!regions.some(r=>r.photoKey===key&&objects.find(o=>o.id===r.objectId)?.category==='main-house'))throw Error('Et færdigt hovedhusomrids kræver en hovedbygning på fotoet.');}
    if(input.status==='reviewed'){
      if(!objects.some(o=>o.category==='main-house'&&regions.some(r=>r.objectId===o.id)))throw Error('Markér hovedbygningen før du godkender.');
      if(objects.some(o=>!regions.some(r=>r.objectId===o.id)))throw Error('Tegn et omrids for hver oprettet bygningsdel, eller fjern den tomme del.');
    }
    // Pin each annotated view to exact original pixels; changing source imagery
    // requires a new review rather than silently reusing old coordinates.
    for(const old of previous.sources??[]){const current=references.get(old.photoKey);if(current&&current.imageSha256!==old.imageSha256)throw Error('Originalfotoet er ændret. De gamle markeringer kan ikke genbruges automatisk.');}
    let provenance={method:'manual'};
    if(input.aiProposal!==undefined){
      const proposal=await readHouseAICandidate(task,input.aiProposal.photoKey,input.aiProposal.signature,aiCacheRoot?{cacheRoot:aiCacheRoot}:{});
      const viewRegions=regions.filter(r=>r.photoKey===input.aiProposal.photoKey);
      const unchanged=JSON.stringify(viewRegions)===JSON.stringify(proposal.regions)&&proposal.objects.every(o=>JSON.stringify(objects.find(v=>v.id===o.id))===JSON.stringify(o));
      provenance={method:proposal.method,models:proposal.models,learning:proposal.learning??null,signature:proposal.signature,photoKey:input.aiProposal.photoKey,review:unchanged?'accepted':'corrected',evidence:proposal.sources};
    }else if(input.proposalSignature!==undefined){
      const proposal=houseProposal(task);
      if(input.proposalSignature!==proposal.signature)throw Error('Forslaget er ændret. Genindlæs huset.');
      const unchanged=JSON.stringify({objects,regions})===JSON.stringify({objects:proposal.objects,regions:proposal.regions});
      provenance={method:proposal.method,signature:proposal.signature,review:unchanged?'accepted':'corrected'};
    }else if(previous.provenance?.signature){provenance={...previous.provenance,review:'corrected'};}
    const event={revision:previous.revision+1,at:new Date().toISOString(),status:input.status,objects,regions,completePhotos,mainCompletePhotos,sources:[...references.values()],provenance};
    const next={version:1,taskId:id,...event,history:[...previous.history,event]};
    await store.write(`parts-${id}.json`,next);return next;
  });
}
export async function exportParts(store){
  const rows=[];
  for(const name of await store.tasks()){
    const task=await store.read(name),parts=await readParts(store,task.id);
    if(parts.status!=='reviewed')continue;
    rows.push({taskId:task.id,revision:parts.revision,source:task.source,buildingIds:task.config.geometry.buildings.filter(b=>b.main).map(b=>b.id),objects:parts.objects,regions:parts.regions,completePhotos:parts.completePhotos,mainCompletePhotos:parts.mainCompletePhotos??[],sources:parts.sources,provenance:parts.provenance});
  }
  return {version:1,labels:PART_LABELS,unmarkedPixels:'unknown unless the reviewer explicitly marked that photo complete',rows};
}
