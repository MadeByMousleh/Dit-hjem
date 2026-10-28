import {exteriorVersion} from './exterior-views.mjs';

const date=v=>Date.parse(v??'');
export function buildTrainingOverview({items=[],model=null,training=null,completedTraining=null,queue={},busy=false,activeHouseIds=[],now=new Date().toISOString()}={}){
 const modelBuildings=new Set((model?.samples??[]).map(s=>s.buildingId)),included=new Map((model?.includedReviews??[]).map(r=>[r.id,r]));
 const completed=[training,completedTraining].find(t=>t?.status==='trained'&&t.modelVersion===model?.version);
 const exclusions=model?.trainingExclusions??completed?.excluded??[];
 const excluded=new Map(exclusions.map(e=>[e.id,e])),active=new Set(activeHouseIds),houseStates={};
 const counts={inModel:0,waitingTraining:0,waitingAnalysis:0,analysing:0,heldOut:0,notUsable:0,needsReview:0,failed:0,removed:0};
 const waitingBuildings=new Set(),reasons=new Map();
 for(const item of items){
  const review=item.review,entry=included.get(item.id),rejection=excluded.get(item.id);
  let state,reason='';
  if(['excluded','skipped'].includes(review?.status)){state='removed';reason='Du har fjernet eller sprunget huset over.';}
  else if(review?.status==='accepted'){
   if(item.trainingEligibility?.wholeHouse===false){state='notUsable';reason='Blandet facade: farven gælder ikke hele huset.';}
   else if(item.trainingEligibility?.calibrated===false){state='notUsable';reason='Mangler entydig hovedbygning eller kalibrerede skråfotos.';}
   else if(item.trainingEligibility?.visible===false){state='notUsable';reason='Hovedhus eller farve kunne ikke bekræftes på billederne.';}
   else if(entry&&entry.revision===review.revision){state=entry.split==='test'||!modelBuildings.has(entry.buildingId)?'heldOut':'inModel';reason=state==='heldOut'?'Reserveret til uafhængig test; bruges ikke til træning.':'Denne labelrevision findes i den senest færdige model.';}
   else if(rejection&&(rejection.revision===review.revision||rejection.revision===undefined&&date(review.at)<=date(completed?.startedAt))){state='notUsable';reason=rejection.reason;}
   else{state='waitingTraining';reason=entry?'Ny eller ændret label afventer næste model.':'Godkendt label afventer kontrol af facadepixels og næste træning.';waitingBuildings.add(item.buildingId??item.id);}
  }else if(active.has(item.id)){state='analysing';reason='Husets billeder bliver hentet eller analyseret.';}
  else if(item.status==='failed'){state='failed';reason=item.error??'Indsamlingen kræver et nyt forsøg.';}
  else if(item.hex||item.status==='done'){state='needsReview';reason=item.reviewable?'Et farveforslag er gemt, men endnu ikke medtaget.':item.error??'AI-kvalitetskontrollen kunne ikke godkende farven.';}
  else{state='waitingAnalysis';reason='Afventer billeder og AI-farveforslag.';}
  counts[state]++;houseStates[item.id]={trainingState:state,trainingReason:reason,inModelRevision:entry?.revision??null};
  if(state==='notUsable')reasons.set(reason,(reasons.get(reason)??0)+1);
 }
 const newBatch=items.filter(i=>i.multilabel&&!['excluded','skipped'].includes(i.review?.status));
 const refreshed=newBatch.filter(i=>i.appearance?.exteriorVersion===exteriorVersion).length;
 const lastLabelAt=items.map(i=>i.review?.at).filter(v=>Number.isFinite(date(v))).sort((a,b)=>date(b)-date(a))[0]??null;
 const modelReviewIds=new Set((model?.includedReviews??[]).filter(r=>r.split!=='test'&&modelBuildings.has(r.buildingId)).map(r=>r.id));
 const pendingRemoval=(model?.includedReviews??[]).filter(r=>modelReviewIds.has(r.id)&&['excluded','skipped','pending'].includes(items.find(i=>i.id===r.id)?.review?.status)).length;
 return {updatedAt:now,scope:'Alle huse; uafhængigt af listefilter',model:{exists:!!model,version:model?.version??null,trainingHouses:model?modelBuildings.size:0,facadeSamples:model?.samples?.length??0,automaticHouses:new Set((model?.includedReviews??[]).filter(r=>r.labelOrigin==='gemini-auto'&&modelBuildings.has(r.buildingId)).map(r=>r.buildingId)).size,pendingRemoval},counts,waitingTrainingHouses:waitingBuildings.size,acceptedLabels:items.filter(i=>i.review?.status==='accepted').length,totalHouses:items.length,lastLabelAt,notUsableReasons:[...reasons].map(([reason,count])=>({reason,count})).sort((a,b)=>b.count-a.count),activity:{busy,activeHouseIds,activeHouses:active.size,queue,trainingBusy:!!training?.busy,trainingQueued:!!training?.queued,trainingStage:training?.status??null,trainingCompleted:training?.completed??0,trainingTotal:training?.total??items.length,trainingError:training?.error??null},exterior:{completed:refreshed,total:newBatch.length,remaining:newBatch.length-refreshed,failed:newBatch.filter(i=>i.exteriorStatus==='failed'&&i.appearance?.exteriorVersion!==exteriorVersion).length},houseStates};
}
