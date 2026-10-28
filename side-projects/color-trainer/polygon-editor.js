import {polygonMask} from './polygon.mjs';
import {imageWorkspace,drawOutline} from './image-workspace.js';

export function editPolygon(photo,existing,onApply,onEditing=()=>{}){
  const wasFullscreen=!!document.fullscreenElement;
  const dialog=document.createElement('dialog');dialog.className='polygon-dialog fullscreen-editor';
  dialog.setAttribute('aria-label','Ret facadeområde');
  const title=document.createElement('h2');title.textContent='Tegn et tydeligt vægområde';
  const help=document.createElement('p');help.className='editor-help';help.textContent='Klik eller tryk rundt om væggen. Undgå tag, vinduer, døre og planter. Zoom med +/−, musehjul eller to fingre. Brug Flyt til at panorere.';
  let points=existing?.points.map(p=>[...p])??[],busy=false;
  const workspace=imageWorkspace(photo,{onPoint:p=>{if(!busy&&points.length<64){if(points.length>=3){const a=workspace.imagePoint(p),b=workspace.imagePoint(points[0]);if(Math.hypot(a[0]-b[0],a[1]-b[1])<8){apply.focus();return;}}points.push(p);draw();}},overlay:(ctx,view)=>drawOutline(ctx,points,view)});
  workspace.root.classList.add('polygon-photo');
  const note=document.createElement('p');note.setAttribute('role','status');
  const actions=document.createElement('div');actions.className='actions editor-actions';
  const button=text=>{const b=document.createElement('button');b.type='button';b.textContent=text;actions.append(b);return b;};
  const undo=button('Fortryd punkt'),clear=button('Tegn om'),remove=button('Fjern dette område'),cancel=button('Annuller'),apply=button('Gem område');apply.className='primary';
  function draw(){workspace.redraw();undo.disabled=busy||!points.length;clear.disabled=busy||!points.length;remove.disabled=busy||!existing;apply.disabled=busy||points.length<3;cancel.disabled=busy;note.textContent=points.length+' punkter valgt. Området gemmes som kladde; godkend farven bagefter.';}
  undo.onclick=()=>{points.pop();draw();};clear.onclick=()=>{points=[];draw();};
  const close=()=>{workspace.destroy();dialog.close();dialog.remove();onEditing(false);if(!wasFullscreen&&document.fullscreenElement)void document.exitFullscreen?.().catch(()=>{});};cancel.onclick=close;
  dialog.oncancel=e=>{e.preventDefault();if(!busy)close();};
  async function commit(value){if(busy)return;try{if(value)polygonMask(value,...workspace.dimensions);busy=true;draw();note.textContent='Gemmer område …';await onApply(value);close();}catch(e){busy=false;draw();note.textContent=e.message;}}
  apply.onclick=()=>commit(points);remove.onclick=()=>commit(null);
  dialog.append(title,help,workspace.toolbar,workspace.root,note,actions);document.body.append(dialog);dialog.showModal();onEditing(true);draw();
}
