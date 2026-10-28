import * as THREE from 'three';
import type {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import type {HomeCameraMode} from '../services/home-3d-document';

export const eyeHeight=1.7;
export function lookDirection(yaw:number,pitch:number){
 return new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
}
export function groundCamera(camera:THREE.PerspectiveCamera,controls:OrbitControls,canvas:HTMLCanvasElement,pick:(point:THREE.Vector2)=>THREE.Vector3|null,report:(mode:HomeCameraMode,message?:string)=>void){
 let mode:HomeCameraMode='orbit',standing:THREE.Vector3|null=null,yaw=0,pitch=0,changed=false;
 let saved:{position:THREE.Vector3;target:THREE.Vector3;fov:number}|null=null;
 let pointer:{id:number;x:number;y:number;startX:number;startY:number}|null=null;
 const point=new THREE.Vector2();
 function restore(){
  if(saved){camera.position.copy(saved.position);controls.target.copy(saved.target);camera.fov=saved.fov;camera.updateProjectionMatrix();}
  controls.enabled=true;controls.update();changed=true;
 }
 function look(){if(standing){camera.position.copy(standing);camera.lookAt(standing.clone().add(lookDirection(yaw,pitch)));camera.updateMatrixWorld(true);changed=true;}}
 function setMode(next:HomeCameraMode){
  if(next===mode)return;
  pointer=null;
  if(mode==='orbit'&&next!=='orbit'){
   const damping=controls.enableDamping;controls.enableDamping=false;controls.update();controls.enableDamping=damping;
   saved={position:camera.position.clone(),target:controls.target.clone(),fov:camera.fov};
  }
  if(next==='ground'&&!standing){report('place','Vælg først et frit sted på grunden.');next='place';}
  mode=next;
  if(mode==='ground'){controls.enabled=false;camera.fov=60;camera.updateProjectionMatrix();look();}
  else{restore();if(mode==='orbit')saved=null;}
  canvas.style.cursor=mode==='place'?'crosshair':mode==='ground'?'grab':'';
 }
 function down(event:PointerEvent){
  if(mode==='orbit')return;
  if(mode==='ground'){event.stopImmediatePropagation();event.preventDefault();}
  if(!event.isPrimary||event.button!==0){pointer=null;return;}
  pointer={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY};
  if(mode==='ground')canvas.setPointerCapture(event.pointerId);
 }
 function move(event:PointerEvent){
  if(mode!=='ground'||pointer?.id!==event.pointerId)return;
  event.stopImmediatePropagation();event.preventDefault();
  const scale=THREE.MathUtils.degToRad(camera.fov)/Math.max(1,canvas.clientHeight);
  yaw-=(event.clientX-pointer.x)*scale;
  pitch=THREE.MathUtils.clamp(pitch+(event.clientY-pointer.y)*scale,-Math.PI/2+.01,Math.PI/2-.01);
  pointer.x=event.clientX;pointer.y=event.clientY;look();
 }
 function up(event:PointerEvent){
  if(mode==='ground'){event.stopImmediatePropagation();event.preventDefault();}
  const down=pointer;pointer=null;
  if(!down||down.id!==event.pointerId||mode!=='place'||Math.hypot(event.clientX-down.startX,event.clientY-down.startY)>7)return;
  const rect=canvas.getBoundingClientRect();point.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
  const hit=pick(point);
  if(!hit){report('place','Vælg et frit sted på grunden, væk fra huset og tagene.');return;}
  standing=hit.clone();standing.y+=eyeHeight;
  const toward=controls.target.clone().sub(hit);yaw=Math.atan2(toward.x,-toward.z);pitch=THREE.MathUtils.degToRad(15);
  setMode('ground');report('ground');
 }
 function cancel(){pointer=null;}
 function wheel(event:WheelEvent){if(mode==='ground'){event.preventDefault();event.stopImmediatePropagation();}}
 canvas.addEventListener('pointerdown',down,true);canvas.addEventListener('pointermove',move,true);canvas.addEventListener('pointerup',up,true);canvas.addEventListener('pointercancel',cancel,true);
 canvas.addEventListener('wheel',wheel,{capture:true,passive:false});
 return {setMode,update(){if(mode!=='ground')return controls.update();const result=changed;changed=false;return result;},resize(){if(mode==='ground')look();},dispose(){
  canvas.removeEventListener('pointerdown',down,true);canvas.removeEventListener('pointermove',move,true);canvas.removeEventListener('pointerup',up,true);canvas.removeEventListener('pointercancel',cancel,true);canvas.removeEventListener('wheel',wheel,true);
 }};
}
