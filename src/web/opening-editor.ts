import * as THREE from 'three';
import type {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import type {OpeningRect,SceneEdits} from '../utils/scene-opening-edits';
export function openingEditor(canvas:HTMLCanvasElement,camera:THREE.Camera,controls:OrbitControls,groups:()=>THREE.Group[],edits:()=>SceneEdits,commit:(edits:SceneEdits)=>void,rebuild:()=>void){
 let selected:{id:string;group:THREE.Group;rect:OpeningRect}|null=null,timer:ReturnType<typeof setTimeout>|undefined,down:{x:number;y:number;id:number}|null=null,drag:{at:THREE.Vector3;rect:OpeningRect;resize:boolean}|null=null;
 const ray=new THREE.Raycaster(),bar=document.createElement('div');bar.style.cssText='position:fixed;bottom:12px;left:12px;right:12px;display:none;gap:8px;justify-content:center;z-index:40;font:14px sans-serif';document.body.appendChild(bar);
 function button(label:string,action:()=>void){const b=document.createElement('button');b.textContent=label;b.style.cssText='border:1px solid #dce1e8;background:white;color:#26364b;border-radius:14px;padding:12px';b.onpointerdown=e=>e.stopPropagation();b.onclick=action;bar.appendChild(b);}
 const finish=()=>{selected=null;drag=null;controls.enabled=true;bar.style.display='none';canvas.style.cursor='';};
 button('↔ / ↕ Træk',()=>{if(selected)bar.dataset.resize='false';});button('↗ Størrelse',()=>{if(selected)bar.dataset.resize='true';});button('Slet',()=>{if(selected){commit({...edits(),openings:{...edits().openings,[selected.id]:null}});rebuild();finish();}});button('Færdig',finish);
 function cast(e:PointerEvent){const r=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);}
 function point(e:PointerEvent){if(!selected)return null;cast(e);const normal=new THREE.Vector3(0,0,1).applyQuaternion(selected.group.quaternion),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,selected.group.position),p=ray.ray.intersectPlane(plane,new THREE.Vector3());return p?selected.group.worldToLocal(p):null;}
 function choose(e:PointerEvent){cast(e);const hit=ray.intersectObjects(groups(),true).find(h=>typeof h.object.userData.openingId==='string');if(!hit)return null;let group=hit.object.parent;while(group&&!group.userData.facadeHeight)group=group.parent;return group?{id:hit.object.userData.openingId as string,group:group as THREE.Group,rect:{...hit.object.userData.openingRect} as OpeningRect}:null;}
 function start(e:PointerEvent){if(down){clearTimeout(timer);finish();down=null;return;}const found=choose(e);if(selected){if(!found||found.id!==selected.id){finish();return;}e.stopImmediatePropagation();const p=point(e);if(p){down={x:e.clientX,y:e.clientY,id:e.pointerId};drag={at:p,rect:{...selected.rect},resize:bar.dataset.resize==='true'};canvas.setPointerCapture(e.pointerId);}return;}
  if(!found)return;down={x:e.clientX,y:e.clientY,id:e.pointerId};timer=setTimeout(()=>{selected=found;controls.enabled=false;bar.style.display='flex';bar.dataset.resize='false';canvas.style.cursor='move';down=null;},550);
 }
 function move(e:PointerEvent){if(!selected){if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>8){clearTimeout(timer);down=null;}return;}if(!drag)return;e.stopImmediatePropagation();const p=point(e);if(!p)return;const width=selected.group.userData.facadeLength as number,height=selected.group.userData.facadeHeight as number,dx=(p.x-drag.at.x)/width,dy=(p.y-drag.at.y)/height,r={...drag.rect};
  if(drag.resize){r.width=Math.max(.015,Math.min(1-r.x,r.width+dx));const bottom=r.y+r.height;r.height=Math.max(.03,Math.min(bottom,r.height+dy));r.y=bottom-r.height;}else{r.x=Math.max(0,Math.min(1-r.width,r.x+dx));r.y=Math.max(0,Math.min(1-r.height,r.y-dy));}
  selected.rect=r;commit({...edits(),openings:{...edits().openings,[selected.id]:r}});rebuild();const replacement=groups().find(g=>g.userData.faceId===selected!.group.userData.faceId);if(replacement)selected.group=replacement;
 }
 function end(){clearTimeout(timer);down=null;drag=null;}
 canvas.addEventListener('pointerdown',start,true);canvas.addEventListener('pointermove',move,true);canvas.addEventListener('pointerup',end,true);canvas.addEventListener('pointercancel',end,true);
 return {cancel(){end();finish();},dispose(){clearTimeout(timer);finish();bar.remove();canvas.removeEventListener('pointerdown',start,true);canvas.removeEventListener('pointermove',move,true);canvas.removeEventListener('pointerup',end,true);canvas.removeEventListener('pointercancel',end,true);}};
}
