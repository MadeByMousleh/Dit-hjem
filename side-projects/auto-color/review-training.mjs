import {createHash,randomUUID} from 'node:crypto';
import {needsColorConfirmation,colorConfirmed} from './color-confirmation.mjs';
import {reviewable} from './review.mjs';
import {Store} from './store.mjs';
import {facadeFeatures,train,split} from '../color-trainer/model.mjs';
import {evaluateModel} from './training.mjs';
import {renderPatches} from './render-worker.mjs';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export class ReviewedTraining {
 constructor(files,batch,origin,{manualRoot='side-projects/color-trainer/data',extract=renderPatches}={}){Object.assign(this,{files,batch,origin,manualRoot,extract});this.busy=false;this.queued=false;this.timer=null;}
 schedule(){clearTimeout(this.timer);this.timer=setTimeout(()=>void this.run(),1500);}
 async run(){
  if(this.busy){this.queued=true;return;}this.busy=true;
  try{
   const list=await this.batch.init(),manual=new Store(this.manualRoot),humanRows=await manual.rows(),baseline=await manual.read('model.json'),reviewRows=[],autoRows=[],excluded=[],included=[];
   const state={status:'sampling',startedAt:new Date().toISOString(),completed:0,total:list.items.length,acceptedHouses:0,automaticAcceptedHouses:0,includedHouses:0,excluded,productionModelChanged:false};
   const save=async()=>this.files.write('review-training.json',state);await save();
   for(const item of list.items){
    const store=this.batch.house(item.id),review=await store.read('review.json');state.completed++;
    if(review?.status!=='accepted')continue;state.acceptedHouses++;const automatic=review.origin==='gemini-auto';if(automatic)state.automaticAcceptedHouses++;
    const task=await store.read('pilot.json');
    if(needsColorConfirmation(task)&&!colorConfirmed(task,review)){excluded.push({id:item.id,revision:review.revision,reason:'Afventer din bekræftelse af AI-farven.'});await save();continue;}
    if(needsColorConfirmation(task)&&!reviewable(task)){excluded.push({id:item.id,revision:review.revision,reason:'Farven er godkendt; billedmatch eller synlighed kræver fortsat kontrol før træning.'});await save();continue;}
    if(review.scope!=='whole-house'||!task?.teacher?.result?.uniformFacade){excluded.push({id:item.id,revision:review.revision,reason:'Blandet facade: godkendelsen gælder kun et materiale.'});await save();continue;}
    if(!task.inputFile||!task.buildingId){excluded.push({id:item.id,revision:review.revision,reason:'Mangler entydig hovedbygning eller kalibrerede skråfotos.'});await save();continue;}
    try{
     const input=await store.read(task.inputFile),sourceHash=digest({input,adapterVersion:1});let evidence=await store.read('training-features.json');
     if(evidence?.sourceHash!==sourceHash){
      const patches=await this.extract(this.origin,{houseId:item.id});
      const analysis=facadeFeatures(patches.filter(p=>p.buildingId===task.buildingId&&p.samplingVersion===2));
      if(!analysis.faces.length){await store.write('training-features.json',{sourceHash,buildingId:task.buildingId,faces:[],reason:'Ingen facadeområder bestod den strenge pixelkontrol.',at:new Date().toISOString()});throw Error('Ingen facadeområder bestod den strenge pixelkontrol.');}
      evidence={sourceHash,buildingId:task.buildingId,faces:analysis.faces.map(({faceId,feature})=>({faceId,feature})),excludedFaces:analysis.rejectedFaces.length,at:new Date().toISOString()};await store.write('training-features.json',evidence);
     }
     if(!evidence.faces.length)throw Error(evidence.reason??'Ingen brugbare facadepixels.');
     if(evidence.buildingId!==task.buildingId||!evidence.faces.every(f=>f.feature?.length===9&&f.feature.every(Number.isFinite)))throw Error('Ugyldige gemte facadetræk.');
     for(const face of evidence.faces)(automatic?autoRows:reviewRows).push({...face,buildingId:task.buildingId,hex:review.hex,status:'approved',taskId:item.id,revision:review.revision,labelOrigin:automatic?'gemini-auto':'human-reviewed-gemini',sourceHash});
     included.push({id:item.id,buildingId:task.buildingId,revision:review.revision,hex:review.hex,sourceHash,labelOrigin:automatic?'gemini-auto':'human-reviewed-gemini',split:automatic?'train':split(task.buildingId)});state.includedHouses=included.length;
    }catch(error){excluded.push({id:item.id,revision:review.revision,reason:error.message});}
    await save();
   }
   state.status='training';await save();
   const protectedTestIds=new Set([...humanRows,...reviewRows].filter(r=>split(r.buildingId)==='test').map(r=>r.buildingId));
   const eligibleAuto=autoRows.filter(r=>!protectedTestIds.has(r.buildingId));
   const unique=new Map();for(const row of [...eligibleAuto,...reviewRows,...humanRows])unique.set(`${row.buildingId}:${row.faceId}`,row);
   const rows=[...unique.values()],model=train([...reviewRows,...humanRows]);
   const humanSamples=model.samples,automaticSamples=rows.filter(r=>r.labelOrigin==='gemini-auto').map(({buildingId,faceId,feature,hex})=>({buildingId,faceId,feature,hex}));
   model.samples=[...humanSamples,...automaticSamples];model.trainingBuildings=new Set(model.samples.map(s=>s.buildingId)).size;
   const holdout=humanRows.filter(r=>split(r.buildingId)==='test'),humanTests=[...humanRows,...reviewRows].filter(r=>split(r.buildingId)==='test');
   model.evaluation.rgbMAE=evaluateModel(model,humanTests)?.rgbMAE??null;
   const evaluation={basis:'Uændrede menneskegodkendte testhuse, opdelt efter fysisk bygning',baseline:evaluateModel(baseline,holdout),candidate:evaluateModel(model,holdout),newReviewHoldout:evaluateModel(model,reviewRows.filter(r=>split(r.buildingId)==='test'))};
   const artifact={...model,source:'manual-plus-human-reviewed-and-automatic-gemini',includedReviews:included,trainingExclusions:excluded,trainingStartedAt:state.startedAt,automaticPromotion:false,fixedHoldoutEvaluation:evaluation};
   const file=`review-model-${randomUUID()}.json`;await this.files.write(file,artifact);await this.files.write('review-model.json',artifact);
   Object.assign(state,{status:'trained',finishedAt:new Date().toISOString(),modelFile:file,modelVersion:model.version,trainingBuildings:model.trainingBuildings,automaticTrainingBuildings:new Set(automaticSamples.map(r=>r.buildingId)).size,addedTrainingBuildings:new Set([...automaticSamples,...reviewRows.filter(r=>split(r.buildingId)==='train')].map(r=>r.buildingId)).size,reviewTestBuildings:new Set(reviewRows.filter(r=>split(r.buildingId)==='test').map(r=>r.buildingId)).size,evaluation,trainingFingerprint:digest({included,manual:humanRows.map(r=>[r.taskId,r.revision,r.faceId,r.hex])})});await save();
   await this.files.write('review-training-completed.json',state);
  }catch(error){const state=await this.files.read('review-training.json',{});await this.files.write('review-training.json',{...state,status:'failed',error:error.message});}
  finally{this.busy=false;if(this.queued){this.queued=false;this.schedule();}}
 }
}
