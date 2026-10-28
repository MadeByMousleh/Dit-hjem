import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,open,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Store} from './store.mjs';
import {photoKey} from './sampling.mjs';
import {buildingGroups} from './evaluate-semantic.mjs';
const folder=dirname(fileURLToPath(import.meta.url));
const alive=pid=>{try{process.kill(pid,0);return true;}catch(e){return e.code==='EPERM';}};
export const housePartition=group=>['test','validation','train','train','train'][parseInt(createHash('sha256').update(group).digest('hex').slice(0,8),16)%5];
export async function trainingDataset(store,{makeInput,confirmation={tasks:[]}}={}){
  const tasks=await Promise.all((await store.tasks()).map(n=>store.read(n))),groups=buildingGroups(tasks),examples=[],skipped=[];
  for(const task of tasks){
    const parts=await store.read(`parts-${task.id}.json`);if(parts?.status!=='reviewed')continue;
    const group=groups.get(task.id);if(!group){skipped.push({taskId:task.id,reason:'missing-building-identity'});continue;}
    const confirmed=confirmation.tasks.some(t=>t.id===task.id&&t.revision===parts.revision);
    for(const photo of task.config.photos.photos){
      const key=photoKey(photo),regions=parts.regions.filter(r=>r.photoKey===key).map(r=>({...r,...parts.objects.find(o=>o.id===r.objectId),id:r.id}));
      if(!regions.some(r=>r.category==='main-house'))continue;
      const mainComplete=confirmed||(parts.mainCompletePhotos??[]).includes(key)||parts.completePhotos.includes(key);
      const hasNegative=mainComplete||regions.some(r=>r.category!=='unknown'&&r.category!=='main-house'&&r.includeInModel===false);
      if(!hasNegative){skipped.push({taskId:task.id,photoKey:key,reason:'positive-only-no-negative-labels'});continue;}
      const source=parts.sources?.find(s=>s.photoKey===key),bytes=Buffer.from(photo.image.split(',')[1],'base64'),imageSha256=createHash('sha256').update(bytes).digest('hex');
      if(source&&source.imageSha256!==imageSha256){skipped.push({taskId:task.id,photoKey:key,reason:'source-image-changed'});continue;}
      examples.push({taskId:task.id,revision:parts.revision,photoKey:key,group,split:housePartition(group),imageSha256,mainComplete,regions:regions.map(r=>({category:r.category,includeInModel:r.includeInModel,points:r.points})),input:makeInput?makeInput(task,key).input:undefined});
    }
  }
  // Duplicate photos/tasks for the same physical house are one example, with
  // deterministic newest review revision chosen; never duplicate across splits.
  const unique=[...new Map(examples.sort((a,b)=>a.revision-b.revision||a.taskId.localeCompare(b.taskId)).map(e=>[e.group+':'+e.photoKey+':'+e.imageSha256,e])).values()];
  const counts={};for(const split of ['train','validation','test'])counts[split]={houses:new Set(unique.filter(e=>e.split===split).map(e=>e.group)).size,photos:unique.filter(e=>e.split===split).length,completePhotos:unique.filter(e=>e.split===split&&e.mainComplete).length};
  return {version:1,examples:unique,counts,skipped,labelContract:'main-house versus explicitly excluded pixels; unknown pixels ignored; complete main-house outline makes exterior not-main-house',ready:counts.train.houses>=3&&counts.validation.houses>=1&&counts.test.houses>=1};
}

export class HouseTraining{
  constructor(store,{root=resolve(folder,'data/house-learning'),makeInput}={}){this.store=store;this.root=root;this.makeInput=makeInput;this.job=null;}
  async confirmation(){return await new Store(this.root).read('outline-confirmation.json')??{tasks:[]};}
  async status(){
    const dataset=await trainingDataset(this.store,{confirmation:await this.confirmation()}),files=new Store(this.root);
    let job=this.job;
    if(!job||job.status!=='running'){
      const lock=await files.read('train-lock.json');
      if(lock&&alive(lock.ownerPid))job={...lock,...await new Store(resolve(this.root,'runs',lock.version)).read('progress.json'),status:'running'};
    }
    return {counts:dataset.counts,eligiblePhotos:dataset.examples.length,skippedPhotos:dataset.skipped.length,ready:dataset.ready,job,latest:await files.read('latest.json'),active:await files.read('active.json')};
  }
  async start(){
    if(this.starting||this.job?.status==='running')throw Error('Husmodellen trænes allerede.');
    this.starting=true;
    let locked=false,launched=false,version;
    const release=async()=>{if(!locked)return;const file=await new Store(this.root).read('train-lock.json');if(file?.version===version)await rm(resolve(this.root,'train-lock.json'),{force:true});locked=false;};
    try{
    await mkdir(this.root,{recursive:true});version=randomUUID();
    for(let attempt=0;attempt<2;attempt++){
      try{const lock=await open(resolve(this.root,'train-lock.json'),'wx');await lock.writeFile(JSON.stringify({ownerPid:process.pid,version,status:'running',stage:'starting'}));await lock.close();locked=true;break;}
      catch(error){if(error.code!=='EEXIST')throw error;const previous=await new Store(this.root).read('train-lock.json');if(previous&&alive(previous.ownerPid))throw Error('Husmodellen trænes allerede i en anden lokal proces.');await rm(resolve(this.root,'train-lock.json'),{force:true});}
    }
    if(!locked)throw Error('Kunne ikke låse træningen. Prøv igen.');
    const dataset=await trainingDataset(this.store,{makeInput:this.makeInput,confirmation:await this.confirmation()});
    if(!dataset.ready)throw Error('Der kræves mindst 3 træningshuse, 1 valideringshus og 1 testhus med positive og negative områder. Bekræft hele hovedhusets omrids eller markér dele, der skal udelades.');
    const runRoot=resolve(this.root,'runs',version);await mkdir(runRoot,{recursive:true});
    const activeSnapshot=await new Store(this.root).read('active.json');
    if(activeSnapshot&&createHash('sha256').update(await readFile(activeSnapshot.weightsFile)).digest('hex')!==activeSnapshot.sha256)throw Error('Den aktive husmodels kontrolsum matcher ikke.');
    await writeFile(resolve(runRoot,'dataset.json'),JSON.stringify({...dataset,activeSnapshot,versionId:version,createdAt:new Date().toISOString()}));
    this.job={version,status:'running',stage:'starting',startedAt:new Date().toISOString()};
    const child=spawn(resolve(folder,'data/semantic-runtime/python.exe'),['-u',resolve(folder,'train-house.py'),runRoot],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1'}});
    launched=true;
    let output='',diagnostics='';
    child.stdout.on('data',chunk=>{output+=chunk;const lines=output.split('\n');output=lines.pop();for(const line of lines){try{this.job={...this.job,...JSON.parse(line)};}catch{}}});
    child.stderr.on('data',chunk=>{diagnostics=(diagnostics+chunk).slice(-2000);});
    child.once('error',error=>{this.job={...this.job,status:'failed',error:error.message};void release();});
    child.once('exit',async code=>{
      try{
        if(code!==0)throw Error(diagnostics.slice(-1000)||'Træningen stoppede.');
        const result=JSON.parse(await readFile(resolve(runRoot,'result.json'),'utf8'));
        const files=new Store(this.root);await files.init();await files.write('latest.json',result);
        // Selection uses validation only; test houses never select weights.
        if(result.promote)await files.write('active.json',{version,weightsFile:resolve(runRoot,'adapter.safetensors'),sha256:result.weightsSha256,method:'sam2-residual-head-v1',counts:result.counts});
        this.job={...this.job,status:'complete',stage:'complete',result,finishedAt:new Date().toISOString()};
      }catch(error){this.job={...this.job,status:'failed',error:error.message};}finally{await release();}
    });
    return this.job;
    }finally{this.starting=false;if(!launched)await release();}
  }
}
