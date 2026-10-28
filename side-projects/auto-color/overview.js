(()=>{
 const $=id=>document.getElementById(id),set=(id,value)=>{$(id).textContent=value;};let data=null;
 const labels={inModel:'I modellen fra EDC-listen',waitingTraining:'I automatisk træningskø',waitingAnalysis:'Afventer AI-analyse',analysing:'Under AI-analyse',heldOut:'Reserveret til test',notUsable:'Kan ikke bruges til farvetræning',needsReview:'Kræver kontrol',failed:'Fejl i indsamlingen',removed:'Fjernet eller sprunget over'};
 const stages={'all-exterior-selection':'gennemgår billedgalleriet','all-exterior-audit':'kontrollerer udvendige billeder','all-exterior-label':'vurderer farver og materialer','teacher-label':'vurderer facadefarven','exterior-selection':'vælger billeder','exterior-verification':'kontrollerer facadefotos'};
 const time=v=>v?new Date(v).toLocaleString('da-DK',{timeZone:'Europe/Copenhagen',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'}):'Endnu ingen';
 function choose(state){$('batchFilter').value='all';$('filter').value='all';$('pipelineFilter').value=state;$('pipelineFilter').dispatchEvent(new Event('change'));$('houses').scrollIntoView({behavior:'smooth',block:'start'});}
 function queueStatus(){if(!data)return;const a=data.activity,q=a.queue??{};let title,detail;
  if(q.phase==='blocked'){title='AI er pauset af en kontofejl';detail=q.error?.message??'Konto eller adgang kræver kontrol.';}
  else if(q.phase==='cooldown'&&Date.parse(q.nextAttemptAt)>Date.now()){
   const seconds=Math.max(0,Math.ceil((Date.parse(q.nextAttemptAt)-Date.now())/1000)),remaining=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
   title=q.error?.httpStatus===503?'AI er overbelastet · venter på genforsøg':q.error?'AI venter før næste forsøg':'Kort pause mellem AI-kald';
   detail=`Næste forsøg om ${remaining} · kl. ${new Date(q.nextAttemptAt).toLocaleTimeString('da-DK',{timeZone:'Europe/Copenhagen'})}`+(q.error?` · seneste svar: ${q.error.httpStatus??q.error.message}`:'');
  }else if(q.phase==='requesting'){title='AI analyserer billeder';detail=`${stages[q.context?.stage]??'Behandler billedmateriale'} · forsøg ${q.attempt??1}`+(q.context?.smallerBatch?` · mindre billedpakke (${q.context.imageCount} billeder)`:q.context?.imageCount?` · ${q.context.imageCount} billeder`:'');}
  else if(a.busy){title='Indsamling og billedkontrol kører';detail='Henter billeder eller gør næste AI-kald klar.';}
  else if(data.counts.waitingAnalysis+data.counts.analysing+data.exterior.remaining>0){title='Indsamlingen er pauset';detail='Der er stadig huse i kø. Vælg Fortsæt indsamling nedenfor.';}
  else{title='Ingen aktiv billedindsamling';detail='Se statusgrupperne for eventuelle fejl eller huse, der kræver kontrol.';}
  set('queueTitle',title);set('queueDetail',detail);set('currentHouse',a.busy&&q.context?.address?`Aktuelt hus: ${q.context.address}`:'');
  set('activeHouses',`${a.activeHouses} huse behandles nu · ${q.queued??0} AI-kald i kø`);set('liveUpdated',`Overblik opdateret ${time(data.updatedAt)}`);
 }
 function render(value){data=value;const c=data.counts,a=data.activity;set('modelHouses',data.model.exists?data.model.trainingHouses:'—');set('waitingTraining',data.waitingTrainingHouses);set('waitingAnalysis',c.waitingAnalysis+c.analysing);set('notUsable',c.notUsable);set('holdoutCount',c.heldOut);set('lastModelAt',`Seneste færdige model: ${time(data.model.version)}`);set('lastLabelAt',`Seneste accepterede label: ${time(data.lastLabelAt)}`);
  const interrupted=!a.trainingBusy&&['sampling','training'].includes(a.trainingStage);
  set('trainingStatus',a.trainingBusy?`Træner automatisk: ${a.trainingCompleted} / ${a.trainingTotal} listehuse gennemgået. Du skal ikke trykke på noget.`:a.trainingStage==='failed'?`Seneste træning fejlede: ${a.trainingError}. Den færdige model er bevaret.`:interrupted?'Den seneste træning blev afbrudt. Du kan genoptage den nedenfor.':data.waitingTrainingHouses?`${data.waitingTrainingHouses} huse med nye eller ændrede labels er i automatisk kø. Træningen starter af sig selv; du skal ikke trykke.`:`Den automatiske træningskø er tom. Seneste færdige modelopdatering: ${time(data.model.version)}.`);
  const changes=data.model.pendingRemoval;$('modelPending').hidden=!changes;set('modelPending',`${changes} listehuse i den færdige model er siden fjernet eller fravalgt og forsvinder ved næste træning.`);
  $('trainNow').hidden=a.trainingBusy||!(a.trainingStage==='failed'||interrupted);$('trainNow').disabled=a.trainingBusy;$('trainNow').textContent=interrupted?'Genoptag afbrudt træning':'Prøv træningen igen';
  set('exteriorProgress',`${data.exterior.completed} / ${data.exterior.total} huse har hele galleriet analyseret`);set('exteriorRemaining',`${data.exterior.remaining} mangler${data.exterior.failed?` · ${data.exterior.failed} kræver genforsøg`:''}`);$('exteriorBar').max=data.exterior.total||1;$('exteriorBar').value=data.exterior.completed;
  const groups=$('pipelineGroups');groups.replaceChildren();for(const [key,label]of Object.entries(labels)){const row=document.createElement('button');row.className='pipeline-group';row.type='button';const name=document.createElement('span'),count=document.createElement('strong');name.textContent=label;count.textContent=c[key];row.append(name,count);row.addEventListener('click',()=>choose(key));groups.append(row);}
  const reasons=$('unusableReasons');reasons.replaceChildren();for(const r of data.notUsableReasons){const p=document.createElement('p');p.textContent=`${r.count} huse: ${r.reason}`;reasons.append(p);}
  $('continue').hidden=a.busy||!(c.waitingAnalysis+c.analysing+data.exterior.remaining);queueStatus();
 }
 $('trainNow').addEventListener('click',async()=>{try{$('trainNow').disabled=true;const response=await fetch('/api/train-reviewed',{method:'POST',headers:{'Content-Type':'application/json','x-auto-color':'1'},body:'{}'});const result=await response.json();if(!response.ok)throw Error(result.error);set('trainingStatus','Træning er startet …');}catch(error){set('error',error.message);$('trainNow').disabled=false;}});
 window.TrainingOverview={render};setInterval(queueStatus,1000);
})();
