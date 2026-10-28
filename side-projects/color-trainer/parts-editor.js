import {PART_LABELS} from './part-labels.mjs';
import {photoKey} from './sampling.mjs';
import {polygonMask} from './polygon.mjs';
import {imageWorkspace,drawOutline} from './image-workspace.js';

export function editBuildingParts(task,saved,onSave,onEditing=()=>{}){
  const wasFullscreen=!!document.fullscreenElement;
  const dialog=document.createElement('dialog');dialog.className='fullscreen-editor parts-dialog';dialog.setAttribute('aria-label','Marker bygningsdele');
  const title=document.createElement('h2');title.textContent=`Bygningsdele · ${task.address.text}`;
  const help=document.createElement('p');help.className='editor-help';help.textContent='Tegn det synlige omrids. Vælg samme del i flere fotos. Umarkerede områder forbliver ukendte, medmindre du markerer fotoet som færdigt. Fotos © Klimadatastyrelsen.';
  const controls=document.createElement('div');controls.className='parts-controls';
  const settings=document.createElement('details');settings.className='part-settings';settings.open=window.innerHeight>=650;
  const summary=document.createElement('summary');summary.textContent='Foto og bygningsdele';settings.append(summary,controls);
  const select=label=>{const box=document.createElement('label'),text=document.createElement('span'),input=document.createElement('select');text.textContent=label;box.append(text,input);controls.append(box);return input;};
  const photoSelect=select('Foto'),objectSelect=select('Bygningsdel'),categorySelect=select('Type');
  for(const label of PART_LABELS)categorySelect.add(new Option(label.name,label.id));
  const includeBox=document.createElement('label');includeBox.className='parts-include';
  const include=document.createElement('input');include.type='checkbox';includeBox.append(include,document.createTextNode('Med i ønsket husmodel'));controls.append(includeBox);
  const photos=task.photos.slice().sort((a,b)=>Number(b.direction==='nadir')-Number(a.direction==='nadir'));
  for(const photo of photos)photoSelect.add(new Option(`${photo.direction==='nadir'?'Luftfoto':photo.direction} · ${photo.capturedAt.slice(0,10)}`,photoKey(photo)));
  let objects=structuredClone(saved.objects),regions=structuredClone(saved.regions),complete=new Set(saved.completePhotos),mainComplete=new Set(saved.mainCompletePhotos??[]),points=[],workspace=null,busy=false,currentKey=photoSelect.value;
  if(!objects.length)objects.push({id:crypto.randomUUID(),category:'main-house',includeInModel:true});
  let objectId=objects[0].id;
  const tools=document.createElement('div');tools.className='parts-view-tools';
  const status=document.createElement('p');status.setAttribute('role','status');status.className='editor-status';
  const completeBox=document.createElement('label');completeBox.className='sampling-toggle';
  const completeInput=document.createElement('input');completeInput.type='checkbox';completeBox.append(completeInput,document.createTextNode('Alle synlige bygningsdele på dette foto er markeret'));
  const mainCompleteBox=document.createElement('label');mainCompleteBox.className='sampling-toggle';
  const mainCompleteInput=document.createElement('input');mainCompleteInput.type='checkbox';mainCompleteBox.append(mainCompleteInput,document.createTextNode('Hele hovedhuset er afgrænset på dette foto · udenfor er ikke hovedhus'));
  const actions=document.createElement('div');actions.className='actions editor-actions';
  const button=(text,root=actions)=>{const b=document.createElement('button');b.type='button';b.textContent=text;root.append(b);return b;};
  const add=button('Ny del',controls),removeObject=button('Fjern del i alle fotos',controls);
  const undo=button('Fortryd punkt'),clear=button('Slet omrids'),cancel=button('Annuller'),draft=button('Gem kladde'),approve=button('Godkend markeringer');approve.className='primary';
  const labelFor=id=>PART_LABELS.find(p=>p.id===id);
  const currentObject=()=>objects.find(o=>o.id===objectId);
  function refreshControls(){
    objectSelect.replaceChildren();objects.forEach((o,i)=>objectSelect.add(new Option(`Del ${i+1} · ${labelFor(o.category).name}`,o.id)));objectSelect.value=objectId;
    categorySelect.value=currentObject().category;include.checked=currentObject().includeInModel===true;include.disabled=busy||currentObject().category==='unknown';
    completeInput.checked=complete.has(currentKey);
    mainCompleteInput.checked=mainComplete.has(currentKey);
    for(const b of [photoSelect,objectSelect,categorySelect,completeInput,mainCompleteInput,add,removeObject,cancel,draft,approve])b.disabled=busy;
    undo.disabled=busy||!points.length;clear.disabled=busy||!points.length;
  }
  function redraw(){workspace?.redraw();refreshControls();status.textContent=`${points.length} punkter på valgt del · ${regions.length} gemte omrids i denne kladde. Zoom med hjul/to fingre; brug Flyt til at panorere.`;}
  function flush(){
    if(points.length&&points.length<3)throw Error('Færdiggør omridset med mindst tre punkter, eller vælg Slet omrids.');
    const index=regions.findIndex(r=>r.objectId===objectId&&r.photoKey===currentKey);
    if(!points.length){if(index>=0)regions.splice(index,1);return;}
    const mask=polygonMask(points,...workspace.dimensions);if(mask.indices.length<9)throw Error('Omridset er for lille.');
    const region={id:index>=0?regions[index].id:crypto.randomUUID(),objectId,photoKey:currentKey,points:points.map(p=>[...p])};
    if(index>=0)regions[index]=region;else regions.push(region);
  }
  function view(){
    workspace?.destroy();workspace?.root.remove();tools.replaceChildren();
    points=regions.find(r=>r.objectId===objectId&&r.photoKey===currentKey)?.points.map(p=>[...p])??[];
    const photo=photos.find(p=>photoKey(p)===currentKey);
    workspace=imageWorkspace(photo,{onPoint:p=>{if(!busy&&points.length<64){if(points.length>=3){const a=workspace.imagePoint(p),b=workspace.imagePoint(points[0]);if(Math.hypot(a[0]-b[0],a[1]-b[1])<8)return;}points.push(p);redraw();}},overlay:(ctx,geometry)=>{
      for(const r of regions.filter(r=>r.photoKey===currentKey&&r.objectId!==objectId))drawOutline(ctx,r.points,geometry,labelFor(objects.find(o=>o.id===r.objectId).category).color,false);
      drawOutline(ctx,points,geometry,labelFor(currentObject().category).color);
    }});
    tools.append(workspace.toolbar);dialog.insertBefore(workspace.root,status);redraw();
  }
  photoSelect.onchange=()=>{try{flush();currentKey=photoSelect.value;view();}catch(e){photoSelect.value=currentKey;status.textContent=e.message;}};
  objectSelect.onchange=()=>{try{flush();objectId=objectSelect.value;view();}catch(e){objectSelect.value=objectId;status.textContent=e.message;}};
  categorySelect.onchange=()=>{const o=currentObject(),label=labelFor(categorySelect.value);o.category=label.id;o.includeInModel=label.include;redraw();};
  include.onchange=()=>{currentObject().includeInModel=include.checked;};
  completeInput.onchange=()=>{completeInput.checked?complete.add(currentKey):complete.delete(currentKey);};
  mainCompleteInput.onchange=()=>{mainCompleteInput.checked?mainComplete.add(currentKey):mainComplete.delete(currentKey);};
  add.onclick=()=>{try{flush();const o={id:crypto.randomUUID(),category:'garage-carport',includeInModel:false};objects.push(o);objectId=o.id;view();}catch(e){status.textContent=e.message;}};
  removeObject.onclick=()=>{regions=regions.filter(r=>r.objectId!==objectId);objects=objects.filter(o=>o.id!==objectId);if(!objects.length)objects.push({id:crypto.randomUUID(),category:'main-house',includeInModel:true});objectId=objects[0].id;view();};
  undo.onclick=()=>{points.pop();redraw();};clear.onclick=()=>{points=[];redraw();};
  const close=()=>{workspace.destroy();dialog.close();dialog.remove();onEditing(false);if(!wasFullscreen&&document.fullscreenElement)void document.exitFullscreen?.().catch(()=>{});};cancel.onclick=close;
  dialog.oncancel=e=>{e.preventDefault();if(!busy)close();};
  async function save(statusValue){
    if(busy)return;
    try{flush();busy=true;refreshControls();status.textContent='Gemmer markeringer …';await onSave({revision:saved.revision,status:statusValue,objects,regions,completePhotos:[...complete],mainCompletePhotos:[...mainComplete],proposalSignature:saved.proposalSignature,aiProposal:saved.aiProposal});close();}
    catch(e){busy=false;refreshControls();status.textContent=e.message;}
  }
  draft.onclick=()=>save('draft');approve.onclick=()=>save('reviewed');
  dialog.append(title,help,settings,tools,status,mainCompleteBox,completeBox,actions);document.body.append(dialog);dialog.showModal();onEditing(true);view();
}
