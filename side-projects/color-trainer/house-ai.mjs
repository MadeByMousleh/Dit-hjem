import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import jpeg from 'jpeg-js';
import {Store} from './store.mjs';
import {SemanticWorker,targetRegion} from './semantic.mjs';
import {photoKey} from './sampling.mjs';
import {polygonMask} from './polygon.mjs';
import {houseProposal} from './house-proposal.mjs';
import {readFile} from 'node:fs/promises';
export const HOUSE_AI_METHOD='grounded-sam2-house-v3';
export const HOUSE_AI_MODELS={sam2:'de431c4043854a71d8101e17995dfe596bf101a5',groundingDino:'a2bb814dd30d776dcf7e30523b00659f4f141c71'};
export const houseAIWorker=()=>new SemanticWorker({script:'house-ai-worker.py',timeout:240000});
const folder=fileURLToPath(new URL('./',import.meta.url));
const uuid=seed=>{const h=createHash('sha256').update(seed).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
export function houseAIInput(task,key){
  const photo=task.config.photos.photos.find(p=>photoKey(p)===key);if(!photo)throw Error('Fotoet findes ikke.');
  const image=jpeg.decode(Buffer.from(photo.image.split(',')[1],'base64'),{maxMemoryUsageInMB:48,maxResolutionInMP:2});
  const input={photoKey:key,image:photo.image,direction:photo.direction,targetRegion:targetRegion(task,photo,image.width,image.height),camera:photo.camera,referencePoints:houseProposal(task).regions.find(r=>r.photoKey===key)?.points??null};
  const signature=createHash('sha256').update(JSON.stringify({taskId:task.id,method:HOUSE_AI_METHOD,models:HOUSE_AI_MODELS,input})).digest('hex');
  return {input,signature};
}
export function houseAIProposal(task,key,signature,result){
  const candidate={version:1,method:HOUSE_AI_METHOD,signature,models:HOUSE_AI_MODELS,objects:[],regions:[],completePhotos:[],sources:[],warnings:['AI-forslag fra Grounding DINO og SAM 2.1. Kontrollér husets identitet og grænser. Modellerne kan ikke fastslå, hvornår en tilbygning blev opført. Kun det valgte foto er analyseret.']};
  const view=result.views.find(v=>v.photoKey===key);if(!view)throw Error('AI-svaret matcher ikke fotoet.');
  for(const [i,region] of view.regions.entries()){
    if(!['main-house','garage-carport','outbuilding-cover','terrace'].includes(region.category))continue;
    try{polygonMask(region.points,view.width,view.height);}catch{continue;}
    const objectId=uuid(task.id+':ai:'+key+':'+i);
    candidate.objects.push({id:objectId,category:region.category,includeInModel:region.category==='main-house'});
    candidate.regions.push({id:uuid(objectId+':outline'),objectId,photoKey:key,points:region.points});
    candidate.sources.push({photoKey:key,objectId,label:region.label,detectionScore:region.score,maskQuality:region.maskQuality,geometryPrompt:region.score===null,pixels:region.pixels});
  }
  candidate.seconds=view.seconds;candidate.detections=view.detections;
  if(!candidate.objects.some(o=>o.category==='main-house')){candidate.objects=[];candidate.regions=[];candidate.warnings.push('Intet sikkert hovedhus fundet. Brug et andet foto eller tegn selv.');}
  return candidate;
}
export async function houseAICandidate(task,key,worker,{cacheRoot=folder+'data/house-ai-cache',learningRoot=folder+'data/house-learning'}={}){
  const base=houseAIInput(task,key),input=base.input;
  const active=await new Store(learningRoot).read('active.json');
  if(active){
    const bytes=await readFile(active.weightsFile);
    if(createHash('sha256').update(bytes).digest('hex')!==active.sha256)throw Error('Den gemte husmodels kontrolsum matcher ikke.');
    input.adapterFile=active.weightsFile;input.adapterVersion=active.version;
  }
  const signature=active?createHash('sha256').update(base.signature+active.version+active.sha256).digest('hex'):base.signature;
  const cache=new Store(cacheRoot);await cache.init();
  const saved=await cache.read(signature+'.json');if(saved)return {...saved,cached:true};
  const candidate=houseAIProposal(task,key,signature,await worker.infer([input]));
  candidate.sourceSignature=base.signature;
  if(active){candidate.learning={version:active.version,method:active.method};candidate.warnings.unshift('Forslaget bruger din trænede husmodel.');}
  await cache.write(signature+'.json',candidate);return candidate;
}
export async function readHouseAICandidate(task,key,signature,{cacheRoot=folder+'data/house-ai-cache'}={}){
  if(typeof signature!=='string'||!/^[a-f0-9]{64}$/.test(signature))throw Error('AI-forslaget er ændret. Hent det igen.');
  // Saved previews remain approvable after a newer model is trained, provided
  // their pinned source image/camera still matches the current task.
  const baseSignature=houseAIInput(task,key).signature;
  const candidate=await new Store(cacheRoot).read(signature+'.json');
  if(!candidate||candidate.signature!==signature||candidate.method!==HOUSE_AI_METHOD)throw Error('AI-forslaget findes ikke. Hent det igen.');
  if(candidate.sourceSignature?candidate.sourceSignature!==baseSignature:signature!==baseSignature)throw Error('AI-forslaget er ændret. Hent det igen.');
  return candidate;
}
