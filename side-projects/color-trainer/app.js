import {renderEvidence} from './inspection.js';
const $=id=>document.getElementById(id);
const colorPresets=[...document.querySelectorAll('.color-preset')];
let task=null,selected=null,labels=new Map(),houseColor=null,busy=false,dirty=false,drawing=false,viewerReady=false,timeout;
let semanticPreview=null;
const say=message=>{$('status').textContent=message;};
async function api(path,data){
  const response=await fetch(path,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Trainer':'1'},body:JSON.stringify(data)});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Forespørgslen fejlede.');return result;
}
function controls(){
  for(const id of ['next','train','history'])$(id).disabled=busy;
  for(const id of ['color','hex','confirm','unknown','reset'])$(id).disabled=busy||!selected;
  for(const button of colorPresets){
    button.disabled=busy||!selected;
    button.setAttribute('aria-pressed',String(houseColor?.visibility==='known'&&houseColor.hex===button.dataset.color));
  }
  for(const id of ['draft','skip'])$(id).disabled=busy||!task;
  for(const button of document.querySelectorAll('.sampling-action'))button.disabled=busy;
  $('automaticSampling').disabled=busy||!(task?.manualSelections?.length||task?.semanticSampling);
  $('aiSampling').disabled=busy||!task;
  $('applyAiSampling').hidden=!semanticPreview;
  $('applyAiSampling').disabled=busy||!semanticPreview?.views.some(v=>v.feature);
  $('aiSampling').textContent=semanticPreview?'Skjul AI-forslag':'Find facade med AI';
  $('approve').disabled=busy||!task?.faces.length||!/^#[0-9a-f]{6}$/i.test($('hex').value);
}
async function run(fn){if(busy)return;busy=true;controls();try{await fn();}catch(e){say(e.message);}finally{busy=false;controls();}}
function sendColors(original=false){
  if(!viewerReady||!task)return;
  $('scene').contentWindow.postMessage({type:'trainer-colors',houseColor:houseColor?.visibility==='known'?houseColor.hex:selected?.prediction,colors:[]},location.origin);
}
function choose(faceId){
  selected=task?.faces.find(f=>f.faceId===faceId)||null;
  if(!selected){controls();return;}
  const label=houseColor,color=label?.hex||selected.prediction;
  $('color').value=color;$('hex').value=color;
  $('swatches').replaceChildren();
  for(const [title,value] of [['Forslag',selected.prediction],['Din farve',color]]){
    const div=document.createElement('div'),swatch=document.createElement('span');swatch.style.background=value;div.append(swatch,document.createTextNode(title));$('swatches').append(div);
  }
  $('faceInfo').textContent=`${label?(label.visibility==='known'?'Farve valgt for hele huset':'Kan ikke vurderes'):'Én farve til alle husets facader'} · ${selected.split==='test'?'Reserveret til test':'Træning'}`;
  $('patches').replaceChildren();
  for(const p of selected.patches){const img=document.createElement('img');img.src=`data:image/jpeg;base64,${p.image}`;img.alt=`Facadeudsnit ${p.viewId}, ${p.year}`;$('patches').append(img);}
  controls();
}
function paintFaces(){
  const rejected=task.rejectedFaces?.length??0;
  $('analysisInfo').textContent=rejected?`${rejected} ${rejected===1?'facadeflade':'facadeflader'} udeladt: for få brugbare pixels. ${task.faces.length?'Godkendelsen bruger kun de resterende brugbare facadeudsnit.':'Ingen brugbare facadeudsnit tilbage. Spring huset over.'}`:'';
  // Use the best-covered surface as the initial house suggestion.
  const best=task.faces.slice().sort((a,b)=>b.patches.reduce((n,p)=>n+p.width*p.height,0)-a.patches.reduce((n,p)=>n+p.width*p.height,0))[0];
  choose(selected?.faceId||best?.faceId);
}
function paintEvidence(){
  renderEvidence(task,{candidate:semanticPreview,onSelection:async(key,points)=>{
    const selections=(task.manualSelections??[]).filter(s=>s.photoKey!==key);
    if(points)selections.push({photoKey:key,points});
    await saveSampling(selections);
  },onEditing:value=>{drawing=value;}});
  $('samplingInfo').textContent=semanticPreview?`AI-forsøg: ${semanticPreview.views.filter(v=>v.feature).length} af ${semanticPreview.views.length} fotos har et facadeforslag. Blå områder er kun forslag og bruges først, når du vælger “Brug AI-områder”. Kontrollér især tag og vinduer.`:task.semanticSampling?'AI-områder er valgt til denne analyse. Grønne punkter viser de målte pixels. Du kan rette ved at tegne eller gendanne de automatiske områder.':task.manualSelections?.length?`${task.manualSelections.length} tegnede områder bruges til farveanalysen. Automatiske udsnit er slået fra. Grønne punkter viser de pixels, der måles.`:task.samplingVersion===2?`${task.rejectedViews?.length??0} fotoudsnit udeladt af facadechecks. Grønne områder bruges; orange områder er udeladt. Lysegrønne punkter viser de pixels, der måles.`:'Ældre analyse: stiplede rammer viser kun udsnittenes placering, ikke en præcis pixelmaske. Eksisterende godkendelser er bevaret. Nye huse bruger de strengere facadechecks.';
  controls();
}
async function saveSampling(manualSelections){
  return saveEvidence({manualSelections});
}
async function saveEvidence(extra){
  if(busy)throw Error('Vent til den igangværende handling er færdig.');
  busy=true;controls();
  try{
    task=await api(`/api/task/${task.id}/save`,{revision:task.revision,status:'draft',labels:[...labels.values()],houseColor,...extra});
    semanticPreview=null;
    labels=new Map(task.labels.map(l=>[l.faceId,l]));selected=null;dirty=false;
    paintFaces();paintEvidence();sendColors();await status();
    say(extra.semanticSignature?'AI-områder er gemt som kladde. Kontrollér facaden og godkend husets farve.':extra.manualSelections.length?'Dit facadeområde er gemt som kladde. Vælg eller bekræft farven og godkend huset.':'Automatiske facadeområder er gendannet som kladde. Godkend husets farve igen.');
  }finally{busy=false;controls();}
}
function mount(value){
  semanticPreview=null;
  task=value;selected=null;labels=new Map(value.labels.map(l=>[l.faceId,l]));dirty=false;viewerReady=false;
  houseColor=value.houseColor??null;
  if(!houseColor&&value.labels.length===value.faces.length&&value.labels.length&&value.labels.every(l=>l.visibility==='known'&&l.hex===value.labels[0].hex))houseColor={visibility:'known',hex:value.labels[0].hex};
  $('address').textContent=value.address.text;
  const maps=$('googleMaps');
  maps.href=`https://www.google.com/maps/search/?${new URLSearchParams({api:'1',query:`${value.address.text}, Danmark`})}`;
  maps.hidden=false;
  paintFaces();paintEvidence();$('scene').src=`/api/task/${task.id}/scene`;
  clearTimeout(timeout);timeout=setTimeout(()=>{if(!viewerReady)say('3D-visningen tager længere tid end forventet. Du kan genåbne huset eller springe det over.');},90000);
  say('Huset er hentet. Kobler skråfotos til synlige facadeflader …');
}
async function status(){
  const s=await api('/api/status');$('progress').textContent=`${s.approved} godkendte huse · ${s.labels} farveeksempler`;
  $('history').replaceChildren(new Option('Genåbn tidligere hus',''));
  for(const t of s.history)$('history').append(new Option(`${t.text} · ${t.status}`,t.id));
  $('metrics').textContent=s.model?`Seneste model: ${s.model.version}. Trænet på ${s.model.trainingBuildings} huse. Test: ${s.model.evaluation.testBuildings} huse. RGB-fejl: ${s.model.evaluation.rgbMAE?.toFixed(1)??'afventer testdata'} / 255; pixelforslag: ${s.model.evaluation.baselineRgbMAE?.toFixed(1)??'afventer testdata'}.`:'Ingen model trænet endnu. Godkend huse, og tryk “Træn på godkendelser”. Huse til test bruges aldrig til træning.';
}
async function save(state){
  task=await api(`/api/task/${task.id}/save`,{revision:task.revision,labels:[...labels.values()],houseColor,status:state});
  dirty=false;await status();say(state==='approved'?'Huset er godkendt og gemt.':state==='skipped'?'Huset er sprunget over.':'Kladde gemt på computeren.');
}
async function next(){say('Finder et tilfældigt hus med geometri og skråfotos. Det kan tage et par minutter …');mount(await api('/api/next',{}));await status();}
$('next').onclick=()=>run(async()=>{if(dirty)await save('draft');await next();});
$('history').onchange=()=>run(async()=>{const id=$('history').value;if(!id)return;if(dirty)await save('draft');mount(await api(`/api/task/${id}`));});
function edit(value){
  if(!selected||!/^#[0-9a-f]{6}$/i.test(value))return;
  $('color').value=value;$('hex').value=value;
  houseColor={hex:value.toLowerCase(),visibility:'known'};dirty=true;
  sendColors();paintFaces();
}
$('color').oninput=()=>edit($('color').value);
for(const button of colorPresets)button.onclick=()=>{if(!busy)edit(button.dataset.color);};
$('hex').oninput=()=>{if(/^#[0-9a-f]{6}$/i.test($('hex').value))edit($('hex').value);controls();};
$('confirm').onclick=()=>{if(!/^#[0-9a-f]{6}$/i.test($('hex').value)){say('Indtast en HEX-kode med # og seks tegn.');return;}edit($('hex').value);};
$('unknown').onclick=()=>run(async()=>{houseColor={hex:null,visibility:'unknown'};await save('skipped');await next();});
$('reset').onclick=()=>{houseColor=null;labels.clear();dirty=true;paintFaces();sendColors();};
$('draft').onclick=()=>run(()=>save('draft'));
$('skip').onclick=()=>run(async()=>{await save('skipped');await next();});
$('approve').onclick=()=>run(async()=>{edit($('hex').value);await save('approved');await next();});
$('train').onclick=()=>run(async()=>{if(dirty)await save('draft');say('Træner farvemodellen på godkendte huse …');const m=await api('/api/train',{});await status();say(`Model gemt. Den bruger ${m.trainingBuildings} træningshuse. Nye huse får forslag fra denne model.`);});
window.addEventListener('message',async event=>{
  if(event.origin!==location.origin||event.source!==$('scene').contentWindow||!task)return;
  const message=event.data?.home3d;if(!message)return;
  if(message.type==='error')say('3D-visningen kunne ikke startes. Prøv Chrome/Edge med hardwareacceleration.');
  if(message.type==='trainer-patches'){
    const id=task.id;
    try{
      const result=await api(`/api/task/${id}/patches`,{patches:message.patches});
      if(task.id!==id||result.revision<task.revision)return;
      task=result;viewerReady=true;clearTimeout(timeout);paintFaces();paintEvidence();sendColors();
      say(task.faces.length?'Vælg husets farve én gang, og tryk “Godkend og næste hus”. Farven gælder alle husets facader.':'Ingen brugbare facadeudsnit. Spring huset over; der gemmes ingen falske farvelabels.');
    }catch(e){if(task.id!==id)return;clearTimeout(timeout);say(e.message);}
  }
});
window.addEventListener('beforeunload',e=>{if(dirty||drawing){e.preventDefault();e.returnValue='';}});
$('automaticSampling').onclick=()=>saveSampling([]).catch(e=>say(e.message));
$('aiSampling').onclick=()=>run(async()=>{
  if(semanticPreview){semanticPreview=null;paintEvidence();return;}
  say('Den lokale billedmodel ser på hele huset og leder efter facade frem for tag …');
  semanticPreview=await api(`/api/task/${task.id}/semantic`,{});paintEvidence();
  say('AI-forslaget er vist med blåt. Dine gemte områder er uændrede.');
});
$('applyAiSampling').onclick=()=>saveEvidence({semanticSignature:semanticPreview.signature}).catch(e=>say(e.message));
$('showSampling').onchange=()=>{$('photos').classList.toggle('hide-sampling',!$('showSampling').checked);};
status().catch(e=>say(e.message));
