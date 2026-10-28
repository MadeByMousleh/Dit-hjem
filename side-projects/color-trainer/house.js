import {editBuildingParts} from './parts-editor.js';
import {imageWorkspace,drawOutline} from './image-workspace.js';
import {photoKey} from './sampling.mjs';
import {PART_LABELS} from './part-labels.mjs';
const $=id=>document.getElementById(id);
let task,saved,proposal,workspace,busy=false,drawing=false,aiPreview=null,failedPhoto=null;
let trainingState=null,pollTimer=null;
const say=text=>{$('status').textContent=text;};
async function api(path,data){
  const response=await fetch(path,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Trainer':'1'},body:JSON.stringify(data)});
  const value=await response.json();if(!response.ok)throw Error(value.error||'Handlingen fejlede.');return value;
}
const effective=()=>aiPreview??(saved.revision===0?{...saved,...proposal,proposalSignature:proposal.signature}:saved);
function controls(){
  for(const id of ['next','history'])$(id).disabled=busy||drawing;
  for(const id of ['edit','skip','photo','ai','discardAI'])$(id).disabled=busy||drawing||!task;
  $('discardAI').hidden=!aiPreview&&!failedPhoto;
  $('approve').disabled=busy||drawing||!task||!!failedPhoto||!effective().regions.length;
  $('wholeMain').disabled=busy||drawing||!task;
  $('trainHouse').disabled=busy||drawing||trainingState?.job?.status==='running'||!trainingState?.ready;
}
async function run(action){if(busy)return;busy=true;controls();try{await action();}catch(e){say(e.message);}finally{busy=false;controls();}}
async function status(){
  const state=await api('/api/parts/status');
  $('progress').textContent=`${state.reviewed} godkendte huse · ${state.drafts} kladder · ${state.pending} afventer`;
  $('history').replaceChildren(new Option('Genåbn tidligere hus',''));
  for(const item of state.history)$('history').add(new Option(`${item.text} · ${item.status}`,item.id));
  if(task)$('history').value=task.id;return state;
}
const percent=value=>value===null||value===undefined?'afventer':`${(value*100).toFixed(1)} %`;
async function trainingStatus(){
  trainingState=await api('/api/parts/training');const state=trainingState,c=state.counts;
  $('trainingStatus').textContent=`${c.train.houses} træningshuse · ${c.validation.houses} valideringshuse · ${c.test.houses} testhuse · ${state.eligiblePhotos} brugbare fotos.`;
  if(state.job?.status==='running')$('trainingStatus').textContent+=state.job.stage==='training'?` Træner runde ${state.job.epoch??0}/12 …`:` Forbereder billeder ${state.job.processed??0}/${state.job.total??state.eligiblePhotos} …`;
  if(state.job?.status==='failed')$('trainingStatus').textContent+=` Træning fejlede: ${state.job.error}`;
  const result=state.latest;
  $('trainingMetrics').textContent=result?`Overlap på ${result.counts.test.houses} testhuse: ${percent(result.test.before.iou)} → ${percent(result.test.after.iou)}. Præcision: ${percent(result.test.before.precision)} → ${percent(result.test.after.precision)}. Dækning af hovedhus: ${percent(result.test.before.recall)} → ${percent(result.test.after.recall)}. ${result.promote?'Den trænede model er taget i brug.':'Kandidaten slog ikke sikkerhedskravene på valideringshusene; den tidligere model er bevaret.'} ${result.test.preliminary?'Foreløbig måling: få testhuse.':''}`:'Ingen husmodel trænet endnu. Godkend hele hovedhusets omrids, og tryk “Træn husmodellen”.';
  if(!state.ready)$('trainingStatus').textContent+=' Der kræves mindst 3 træningshuse, 1 valideringshus og 1 testhus med positive og negative områder.';
  clearTimeout(pollTimer);if(state.job?.status==='running')pollTimer=setTimeout(()=>trainingStatus().catch(e=>say(e.message)),2000);
  controls();
}
$('trainHouse').onclick=()=>run(async()=>{await api('/api/parts/train',{});await trainingStatus();say('Træningen er startet lokalt. Du kan følge forløbet ovenfor.');});
function preview(){
  workspace?.destroy();$('preview').replaceChildren();$('previewTools').replaceChildren();
  const photo=task.photos.find(p=>photoKey(p)===$('photo').value);if(!photo)return;
  const value=effective();
  workspace=imageWorkspace(photo,{overlay:(ctx,geometry)=>{
    for(const region of value.regions.filter(r=>r.photoKey===photoKey(photo)&&r.photoKey!==failedPhoto)){
      const object=value.objects.find(o=>o.id===region.objectId),color=!aiPreview&&saved.revision===0?'#52a8ff':PART_LABELS.find(l=>l.id===object.category).color;
      drawOutline(ctx,region.points,geometry,color,false);
    }
  }});
  $('preview').append(workspace.root);$('previewTools').append(workspace.toolbar);
}
async function mount(value){
  const [parts,candidate]=await Promise.all([api(`/api/task/${value.id}/parts`),api(`/api/task/${value.id}/house-proposal`)]);
  task=value;saved=parts;proposal=candidate;aiPreview=null;failedPhoto=null;
  $('wholeMain').checked=saved.revision===0||saved.regions.every(r=>(saved.mainCompletePhotos??[]).includes(r.photoKey));
  $('address').textContent=task.address.text;
  $('googleMaps').href=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.address.text)}`;$('googleMaps').hidden=false;
  $('proposalInfo').textContent=(saved.revision===0?'Automatisk forslag: ':'Dine gemte markeringer vises. ')+proposal.warnings.join(' ');
  $('approve').textContent=saved.revision===0?'Godkend forslag og næste hus':'Godkend markeringer og næste hus';
  $('photo').replaceChildren();
  for(const photo of task.photos.slice().sort((a,b)=>Number(b.direction==='nadir')-Number(a.direction==='nadir')))$('photo').add(new Option(`${photo.direction==='nadir'?'Luftfoto':photo.direction} · ${photo.capturedAt.slice(0,10)}`,photoKey(photo)));
  history.replaceState(null,'',`/hus?task=${task.id}`);preview();await status();await trainingStatus();
  say(saved.revision===0?(proposal.regions.length?'Kontrollér omridset i billederne. Godkend, hvis det passer, eller ret det i fuld skærm.':'Intet sikkert forslag. Tegn hovedhuset i fuld skærm.'):`Markeringer gemt · ${saved.status} · revision ${saved.revision}.`);
}
async function next(){say('Henter næste hus …');await mount(await api('/api/parts/next',{after:task?.id}));}
$('next').onclick=()=>run(next);
$('history').onchange=()=>{const id=$('history').value;if(id)void run(async()=>mount(await api(`/api/task/${id}`)));};
$('photo').onchange=preview;
$('ai').onclick=()=>run(async()=>{
  const key=$('photo').value;
  say('AI analyserer det valgte foto lokalt … Første analyse tager lidt længere tid.');
  const candidate=await api(`/api/task/${task.id}/house-ai`,{photoKey:key});
  if(!candidate.regions.length){failedPhoto=key;$('proposalInfo').textContent=candidate.warnings.join(' ');preview();say('AI fandt ikke et sikkert hovedhus. Prøv et andet foto, ret omridset manuelt, eller skjul AI-resultatet. Dine gemte markeringer er bevaret.');return;}
  failedPhoto=null;
  const base=saved.revision>0?saved:{...saved,objects:[],regions:[],completePhotos:[]};
  const regions=[...base.regions.filter(r=>r.photoKey!==key),...candidate.regions];
  const objects=[...base.objects.filter(o=>regions.some(r=>r.objectId===o.id)),...candidate.objects];
  aiPreview={...base,revision:saved.revision,objects,regions,completePhotos:base.completePhotos.filter(k=>k!==key),aiProposal:{photoKey:key,signature:candidate.signature}};
  $('proposalInfo').textContent=candidate.warnings.join(' ');$('approve').textContent='Godkend AI-forslag og næste hus';
  preview();say(`AI fandt ${candidate.objects.length} bygningsdele på ${candidate.seconds.toFixed(1)} sekunder${candidate.cached?' · hentet fra lokal cache':''}. Forslaget er ikke gemt endnu. Kontrollér det før godkendelse.`);
});
$('discardAI').onclick=()=>run(async()=>mount(task));
$('edit').onclick=()=>{
  if(busy||!task)return;
  const seed=effective(),id=task.id;
  editBuildingParts(task,{...seed,mainCompletePhotos:$('wholeMain').checked?[...new Set(seed.regions.filter(r=>seed.objects.find(o=>o.id===r.objectId)?.category==='main-house').map(r=>r.photoKey))]:seed.mainCompletePhotos??[]},async value=>{await api(`/api/task/${id}/parts`,value);await mount(task);},value=>{drawing=value;controls();});
};
$('approve').onclick=()=>run(async()=>{
  const value=effective();await api(`/api/task/${task.id}/parts`,{revision:saved.revision,status:'reviewed',objects:value.objects,regions:value.regions,completePhotos:value.completePhotos,mainCompletePhotos:$('wholeMain').checked?[...new Set(value.regions.filter(r=>value.objects.find(o=>o.id===r.objectId)?.category==='main-house').map(r=>r.photoKey))]:[],proposalSignature:value.proposalSignature,aiProposal:value.aiProposal});
  // Keep the saved state visible if fetching a new house fails.
  await mount(task);await next();
});
$('skip').onclick=()=>run(async()=>{await api(`/api/task/${task.id}/parts`,{revision:saved.revision,status:'skipped',objects:saved.objects,regions:saved.regions,completePhotos:saved.completePhotos});await mount(task);await next();});
window.addEventListener('beforeunload',event=>{if(drawing){event.preventDefault();event.returnValue='';}});
void run(async()=>{const state=await status(),id=new URLSearchParams(location.search).get('task');if(id)await mount(await api(`/api/task/${id}`));else if(state.history.length)await mount(await api(`/api/task/${state.history.find(t=>!['reviewed','skipped'].includes(t.status))?.id??state.history[0].id}`));else await next();});
