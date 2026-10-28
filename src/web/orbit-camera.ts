import * as THREE from 'three';
import type {OrbitControls} from 'three/addons/controls/OrbitControls.js';

export const closeOrbitDistance=.8;
export function configureOrbitCamera(controls:OrbitControls){
 controls.enablePan=true;
 controls.screenSpacePanning=false;
 controls.touches.ONE=THREE.TOUCH.ROTATE;
 controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;
 controls.mouseButtons.RIGHT=THREE.MOUSE.PAN;
 controls.minDistance=closeOrbitDistance;
 const canvas=controls.domElement as HTMLElement|null;
 if(!canvas)return ()=>{};
 const points=new Map<number,{x:number;y:number}>(),moved=new Set<number>();
 let start:{x:number;y:number;gap:number;at:number}|null=null,intent:'pan'|'zoom'|null=null;
 let originalPan=true,originalZoom=true;
 const measure=()=>{const [a,b]=[...points.values()];return a&&b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2,gap:Math.hypot(a.x-b.x,a.y-b.y)}:null;};
 function down(event:PointerEvent){
  if(event.pointerType!=='touch'||!controls.enabled)return;
  points.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(points.size===2){originalPan=controls.enablePan;originalZoom=controls.enableZoom;const value=measure()!;start={...value,at:event.timeStamp};intent=null;moved.clear();}
 }
 function move(event:PointerEvent){
  if(event.pointerType!=='touch'||!controls.enabled||!points.has(event.pointerId))return;
  points.set(event.pointerId,{x:event.clientX,y:event.clientY});moved.add(event.pointerId);
  if(points.size!==2||!start)return;
  const value=measure()!,translation=Math.hypot(value.x-start.x,value.y-start.y),pinch=Math.abs(value.gap-start.gap);
  // Wait for both pointer updates: the first event of a parallel drag can
  // temporarily look like a pinch. Once identified, lock intent until release.
  if(!intent&&(moved.size===2||event.timeStamp-start.at>80)){
   if(pinch>Math.max(10,start.gap*.12)&&pinch>translation*1.7)intent='zoom';
   else if(translation>8)intent='pan';
  }
  if(!intent){event.preventDefault();event.stopImmediatePropagation();return;}
  controls.enableZoom=originalZoom&&intent==='zoom';controls.enablePan=originalPan&&intent==='pan';
 }
 function up(event:PointerEvent){
  if(!points.delete(event.pointerId))return;
  if(points.size<2&&start){controls.enablePan=originalPan;controls.enableZoom=originalZoom;start=null;intent=null;moved.clear();}
 }
 canvas.addEventListener('pointerdown',down,true);canvas.addEventListener('pointermove',move,true);canvas.addEventListener('pointerup',up,true);canvas.addEventListener('pointercancel',up,true);
 return ()=>{if(start){controls.enablePan=originalPan;controls.enableZoom=originalZoom;}canvas.removeEventListener('pointerdown',down,true);canvas.removeEventListener('pointermove',move,true);canvas.removeEventListener('pointerup',up,true);canvas.removeEventListener('pointercancel',up,true);};
}

export function fitOrbitFootprint(camera:THREE.Camera,controls:OrbitControls,hits:THREE.Vector3[],bounds:readonly [number,number,number,number]){
 if(!hits.length)return false;
 const xs=hits.map(hit=>hit.x),zs=hits.map(hit=>hit.z);
 const shift=(lo:number,hi:number,min:number,max:number)=>hi-lo>max-min?(min+max-lo-hi)/2:lo<min?min-lo:hi>max?max-hi:0;
 const delta=new THREE.Vector3(shift(Math.min(...xs),Math.max(...xs),bounds[0],bounds[2]),0,shift(Math.min(...zs),Math.max(...zs),bounds[1],bounds[3]));
 if(delta.lengthSq()<1e-10)return false;
 camera.position.add(delta);controls.target.add(delta);return true;
}
export function clampOrbitTarget(camera:THREE.Camera,controls:OrbitControls,bounds:readonly number[]){
 const [left,bottom,right,top]=bounds as readonly [number,number,number,number];
 const margin=Math.min(8,(right-left)*.2,(top-bottom)*.2);
 const previous=controls.target.clone();
 controls.target.x=THREE.MathUtils.clamp(controls.target.x,left+margin,right-margin);
 controls.target.z=THREE.MathUtils.clamp(controls.target.z,bottom+margin,top-margin);
 camera.position.add(controls.target.clone().sub(previous));
}
