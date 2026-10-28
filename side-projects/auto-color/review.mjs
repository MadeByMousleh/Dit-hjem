import {floorPlanSummary} from './floor-plans.mjs';
import {needsColorConfirmation,colorFingerprint,colorConfirmed} from './color-confirmation.mjs';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {Store} from './store.mjs';
import {discover} from './edc.mjs';
import {collectPilot} from './pilot.mjs';
import {geminiQueue} from './gemini-queue.mjs';
import {enrichExteriorTask} from './enrich-exteriors.mjs';
import {exteriorVersion,exteriorSummary} from './exterior-views.mjs';

export const reviewable=t=>(!t?.datasetVersion||t?.appearance?.visibilityAccepted===true)&&!!t?.teacher?.result?.sameBuilding&&t.teacher.result.appearanceCompatible===true&&/^#[\da-f]{6}$/i.test(t.teacher.result.facadeHex??'')&&(t.images??[]).some(p=>!t.imageReview?.rejectedImageIds?.includes(p.id));
export const canConfirmColor=t=>/^#[\da-f]{6}$/i.test(t?.teacher?.result?.facadeHex??'');
export const appearanceBatch='2026-10-22-multilabel300';
export const addressKey=a=>String(a?.postcode??'')+':'+String(a?.street??a?.text?.split(',')[0]??'').split(',')[0].normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export class ReviewBatch {
 constructor(files){this.files=files;this.busy=false;this.pending=new Set();this.active=new Set();this.enrich=enrichExteriorTask;}
 house(id){if(!/^[\da-f-]{36}$/i.test(id))throw Error('Ugyldigt hus-id.');return new Store(join(this.files.root,'houses',id));}
 async init(){
  let list=await this.files.read('review-list.json');if(list)return list;
  const pilot=await this.files.read('pilot.json'),items=[];
  if(pilot){const entry={id:pilot.id,url:pilot.listing.url,status:'done'};const store=this.house(entry.id);await store.init();await store.write('pilot.json',pilot);if(pilot.inputFile)await store.write(pilot.inputFile,await this.files.read(pilot.inputFile));items.push(entry);}
  list={target:30,items,createdAt:new Date().toISOString(),authorization:'User requested review list of 30 houses',automaticTraining:false};await this.files.write('review-list.json',list);return list;
 }
 async status(){const list=await this.init(),items=[];for(const entry of list.items){const store=this.house(entry.id),task=await store.read('pilot.json'),review=await store.read('review.json');const index=task?.imageReview?task?.images?.findIndex(p=>!task.imageReview?.rejectedImageIds?.includes(p.id))??-1:-1;items.push({...entry,requiresColorConfirmation:needsColorConfirmation(task),canConfirmColor:canConfirmColor(task),address:task?.address?.text??task?.listing?.address?.text,buildingId:task?.buildingId,trainingEligibility:{wholeHouse:review?.scope==='whole-house'&&task?.teacher?.result?.uniformFacade===true,calibrated:!!task?.inputFile&&!!task?.buildingId,visible:!task?.datasetVersion||task?.appearance?.visibilityAccepted===true},stage:task?.stage,obliqueWarning:task?.obliqueWarning,error:task?.error??entry.error,hex:task?.teacher?.result?.facadeHex,confidence:task?.teacher?.result?.confidence,reason:task?.teacher?.result?.reason,uniformFacade:task?.teacher?.result?.uniformFacade,appearance:task?.appearance,exteriorViews:exteriorSummary(await store.read('exterior-views.json')),floorPlans:floorPlanSummary(await store.read('floor-plans.json')),reviewable:reviewable(task),photoIndex:index,review:review?{revision:review.revision,status:review.status,hex:review.hex,origin:review.origin,at:review.at,scope:review.scope}:null,estimatedUsd:task?.estimatedUsd??0});}return {...list,items,busy:this.busy,activeHouseIds:[...this.active],estimatedUsd:items.reduce((n,t)=>n+t.estimatedUsd,0)};}
 async extend(count,requestId){
  const additions={'2026-10-22-add100':{count:100,from:30,to:130},'2026-10-22-add300':{count:300,from:130,to:430,autoTrain:true},[appearanceBatch]:{count:300,from:430,to:730,autoTrain:true}},addition=additions[requestId];
  if(!addition||count!==addition.count)throw Error('Udvidelsen er ikke autoriseret.');
  return this.files.serial(async()=>{const list=await this.init();if(list.authorizations?.some(a=>a.id===requestId))return list;
   if(list.target!==addition.from)throw Error('Uventet listestørrelse.');
   list.target=addition.to;list.authorizations=[...(list.authorizations??[]),{id:requestId,additionalHouses:count,autoTrain:!!addition.autoTrain,at:new Date().toISOString()}];list.automaticTraining=true;
   await this.files.write('review-list.json',list);return list;
  });
 }
 async autoInclude(item){
  if(!item.autoTrain||this.pending.has(item.id))return false;
  this.pending.add(item.id);try{
   const store=this.house(item.id);if(await store.read('review.json'))return false;
   const task=await store.read('pilot.json');if(needsColorConfirmation(task)||!reviewable(task))return false;
   const event={revision:1,status:'accepted',hex:task.teacher.result.facadeHex.toLowerCase(),at:new Date().toISOString(),origin:'gemini-auto',actor:'automatic',humanVerified:false,scope:task.teacher.result.uniformFacade?'whole-house':'visible-facade-material',teacherModel:task.teacher.model,sourceImageHashes:task.labelProvenance?.sourceImageHashes??[]};
   await store.write('review.json',{...event,history:[event]});this.onAutoInclude?.();return true;
  }finally{this.pending.delete(item.id);}
 }
 async prepare(){
  return this.files.serial(async()=>{const list=await this.init(),target=Math.min(list.target??30,730),caseKey=url=>url.split('/').filter(Boolean).at(-1),seen=new Set(list.items.map(t=>caseKey(t.url)));for(let page=0;list.items.length<target&&page<100;page++){for(const url of await discover({page})){if(seen.has(caseKey(url)))continue;seen.add(caseKey(url));list.items.push({id:randomUUID(),url,status:'queued',batch:list.target===730?appearanceBatch:list.target===430?'2026-10-22-add300':list.target===130?'2026-10-22-add100':'first30',autoTrain:list.target>=430,multilabel:list.target===730});if(list.items.length===target)break;}}await this.files.write('review-list.json',list);return list;});
 }
 async recoverFailed(){
  return this.files.serial(async()=>{
   const list=await this.init();let scheduled=0;
   for(const entry of list.items){
    if(!entry.autoTrain||entry.status!=='failed'||entry.recoveryPolicy==='paced-v1')continue;
    const store=this.house(entry.id),task=await store.read('pilot.json'),review=await store.read('review.json');
    if(task?.teacher||['excluded','skipped','pending'].includes(review?.status))continue;
    if(!/(?:Gemini|DeepSeek)(?: svarede)? (?:401|402|403|408|429|500|502|503|504)|fetch failed|timeout|aborted|EPERM|EACCES|EBUSY/i.test(task?.error??''))continue;
    Object.assign(entry,{status:'queued',recoveryPolicy:'paced-v1',recoveryAttemptLimit:(entry.attempts??0)+1,previousFailure:task.error});scheduled++;
   }
   await this.files.write('review-list.json',list);return {scheduled};
  });
 }
 async recoverSmallPackets(){
  return this.files.serial(async()=>{const list=await this.init();let scheduled=0;
   for(const entry of list.items){
    if(!entry.multilabel||!entry.autoTrain||entry.capacityPolicy||entry.exteriorStatus!=='failed'&&entry.status!=='failed')continue;
    const store=this.house(entry.id),review=await store.read('review.json');if(['excluded','skipped','pending'].includes(review?.status))continue;
    const task=await store.read('pilot.json'),failure=entry.exteriorError??task?.error??'';
    if(!/(?:Gemini|DeepSeek)(?: svarede)? 503|high demand|timeout|aborted/i.test(failure))continue;
    if(task?.teacher){entry.exteriorAttemptLimit=(entry.exteriorAttempts??0)+1;entry.exteriorStatus='queued';}
    else{entry.recoveryAttemptLimit=(entry.attempts??0)+1;entry.status='queued';}
    entry.capacityPolicy='small-packets-v1';entry.previousCapacityFailure=failure;scheduled++;
   }
   await this.files.write('review-list.json',list);return {scheduled};
  });
 }
 async run(){if(this.busy)return;this.busy=true;try{
  const list=await this.prepare();
  const identities=new Map();
  const keys=({address,buildingId,listing})=>[address?.id&&`address:${address.id}`,buildingId&&`building:${buildingId}`,listing?.address&&`edc:${addressKey(listing.address)}`].filter(Boolean);
  for(const entry of list.items){const task=await this.house(entry.id).read('pilot.json');for(const key of keys(task??{}))if(!identities.has(key))identities.set(key,entry.id);}
  const jobs=[...list.items].sort((a,b)=>Number(!!b.multilabel)-Number(!!a.multilabel));
  for(let round=0;round<3;round++){let cursor=0;
  const persist=()=>this.files.serial(()=>this.files.write('review-list.json',list));
  const worker=async()=>{while(cursor<jobs.length){if(geminiQueue.blocked)break;const entry=jobs[cursor++];
   const store=this.house(entry.id);await store.init();const previous=await store.read('pilot.json');
   const review=await store.read('review.json');if(['excluded','skipped'].includes(review?.status))continue;
   if(previous?.teacher){
    const resumeExterior=entry.exteriorStatus==='running';
    if(entry.multilabel&&previous.appearance?.exteriorVersion!==exteriorVersion&&((entry.exteriorAttempts??0)<(entry.exteriorAttemptLimit??2)||resumeExterior)){
     entry.capacityPolicy='small-packets-v1';entry.exteriorAttempts=(entry.exteriorAttempts??0)+(resumeExterior?0:1);entry.exteriorStatus='running';this.active.add(entry.id);await persist();
     try{const enriched=await this.enrich(store);await this.updateAutomaticEvidence(entry,enriched);entry.exteriorStatus='completed';entry.exteriorError=null;}
     catch(error){entry.exteriorStatus='failed';entry.exteriorError=error.message;}finally{this.active.delete(entry.id);}
    }
    await this.autoInclude(entry);entry.status='done';await persist();continue;
   }
   if(entry.multilabel&&entry.pipelineVersion!==exteriorVersion){entry.previousPipelineAttempts=entry.attempts??0;entry.attempts=0;entry.pipelineVersion=exteriorVersion;}
   const transient=/(?:Gemini|DeepSeek)(?: svarede)? (408|429|500|502|503|504)|timeout|aborted|fetch failed/i.test(previous?.error??'');
   if(round>0&&!transient)continue;
   const retryLimit=entry.recoveryAttemptLimit??(transient?3:2);
   if(entry.attempts>=retryLimit){if(entry.status==='running'){entry.status='failed';await persist();}continue;}
   if(entry.multilabel)entry.capacityPolicy='small-packets-v1';entry.status='running';entry.attempts=(entry.attempts??0)+1;await persist();
   const claimHouse=async identity=>{const all=keys(identity);if(all.some(key=>identities.has(key)&&identities.get(key)!==entry.id))throw Error('Duplicate house already present in dataset.');for(const key of all)identities.set(key,entry.id);};
   this.active.add(entry.id);let task;try{task=await collectPilot(store,{url:entry.url,reviewMode:true,compact:entry.attempts>=3,multilabel:entry.multilabel===true,claimHouse});}finally{this.active.delete(entry.id);}entry.status=task.status==='failed'?'failed':'done';await this.autoInclude(entry);
   await persist();
  }};const results=await Promise.allSettled([worker(),worker()]);const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;
  }
 }catch(error){await this.files.write('review-error.json',{message:error.message,at:new Date().toISOString()});}finally{this.busy=false;this.active.clear();}}
 async updateAutomaticEvidence(entry,task){
  if(this.pending.has(entry.id))return;this.pending.add(entry.id);
  try{const store=this.house(entry.id),review=await store.read('review.json');
   if(needsColorConfirmation(task)){
    if(!review||['excluded','skipped','pending'].includes(review.status)||colorConfirmed(task,review))return;
    const event={revision:review.revision+1,status:'pending',hex:null,at:new Date().toISOString(),origin:'deepseek-proposal',actor:'automatic',humanVerified:false,teacherModel:task.teacher.model};
    await store.write('review.json',{...event,history:[...(review.history??[]),event]});this.onAutoInclude?.();return;
   }
   // A user decision made during Gemini processing always wins.
   if(review?.status!=='accepted'||review.origin!=='gemini-auto'||review.actor!=='automatic')return;
   const event={revision:review.revision+1,status:reviewable(task)?'accepted':'pending',hex:reviewable(task)?task.teacher.result.facadeHex.toLowerCase():null,at:new Date().toISOString(),origin:'gemini-auto',actor:'automatic',humanVerified:false,scope:task.teacher.result.uniformFacade?'whole-house':'visible-facade-material',teacherModel:task.teacher.model,sourceImageHashes:task.labelProvenance?.sourceImageHashes??[],exteriorVersion};
   await store.write('review.json',{...event,history:[...(review.history??[]),event]});this.onAutoInclude?.();
  }finally{this.pending.delete(entry.id);}
 }
 async saveReview(id,{revision,status}){
  if(!['accepted','skipped','pending','excluded'].includes(status))throw Error('Ugyldig vurdering.');
  if(this.pending.has(id))throw Error('Huset gemmes allerede.');this.pending.add(id);
  try{const list=await this.init();if(!list.items.some(t=>t.id===id))throw Error('Huset findes ikke.');const store=this.house(id);await store.init();const task=await store.read('pilot.json'),previous=await store.read('review.json');if((previous?.revision??0)!==revision)throw Error('Vurderingen er ændret. Genindlæs siden.');if(status==='accepted'&&!(needsColorConfirmation(task)?canConfirmColor(task):reviewable(task)))throw Error('Ingen brugbar facade og farve at godkende.');
   const event={revision:revision+1,status,hex:status==='accepted'?task.teacher.result.facadeHex.toLowerCase():null,at:new Date().toISOString(),origin:needsColorConfirmation(task)?'human-reviewed-ai':list.items.find(t=>t.id===id).autoTrain?'gemini-auto':'human-reviewed-gemini',actor:'user',humanVerified:needsColorConfirmation(task)||!list.items.find(t=>t.id===id).autoTrain,confirmedColorFingerprint:status==='accepted'?colorFingerprint(task):null,scope:task?.teacher?.result?.uniformFacade?'whole-house':'visible-facade-material',sourceImageHashes:task?.labelProvenance?.sourceImageHashes??[],teacherModel:task?.teacher?.model};const next={...event,history:[...(previous?.history??[]),event]};await store.write('review.json',next);return next;
  }finally{this.pending.delete(id);}
 }
}
