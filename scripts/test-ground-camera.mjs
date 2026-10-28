import assert from 'node:assert/strict';
import {build} from 'esbuild';
import * as THREE from 'three';

const result=await build({entryPoints:['src/web/ground-camera.ts'],bundle:true,platform:'node',write:false,format:'esm'});
const {groundCamera,lookDirection,eyeHeight}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
class Canvas extends EventTarget{
 style={};clientHeight=480;
 setPointerCapture(){}
 getBoundingClientRect(){return {left:0,top:0,width:390,height:480};}
}
const canvas=new Canvas(),camera=new THREE.PerspectiveCamera(42,390/480,.1,1000),controls={target:new THREE.Vector3(0,2,0),enabled:true,enableDamping:true,update:()=>false};
camera.position.set(20,30,40);camera.lookAt(controls.target);
const original=camera.position.clone(),reports=[];
let picked=new THREE.Vector3(8,3,-7);
const observer=groundCamera(camera,controls,canvas,()=>picked,(mode,message)=>reports.push({mode,message}));
const pointer=(type,x,y,extra={})=>{const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y,...extra});canvas.dispatchEvent(e);};
observer.setMode('place');
pointer('pointerdown',100,100);pointer('pointerup',150,100);
assert.equal(reports.length,0,'An overview drag is not a placement');
picked=null;pointer('pointerdown',100,100);pointer('pointerup',100,100);
assert.equal(reports.at(-1).mode,'place');assert.match(reports.at(-1).message,/frit sted/);
picked=new THREE.Vector3(8,3,-7);pointer('pointerdown',100,100);pointer('pointerup',100,100);
assert.equal(reports.at(-1).mode,'ground');assert.equal(controls.enabled,false);
assert.ok(Math.abs(camera.position.y-picked.y-eyeHeight)<1e-12);
const eye=camera.position.clone(),direction=camera.getWorldDirection(new THREE.Vector3());
pointer('pointerdown',100,100);pointer('pointermove',250,400);pointer('pointerup',250,400);
observer.update();assert.ok(camera.position.equals(eye),'Turning cannot translate the observer');
assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(direction)>.3);
pointer('pointerdown',100,100);pointer('pointermove',100,10000);pointer('pointerup',100,10000);
assert.ok(camera.getWorldDirection(new THREE.Vector3()).y>.99,'Can look to the zenith without flipping');
pointer('pointerdown',100,100);pointer('pointercancel',100,100);pointer('pointermove',300,300);
observer.resize();assert.ok(camera.position.equals(eye),'Cancel and resize preserve the eye position');
const wheel=new Event('wheel',{cancelable:true});canvas.dispatchEvent(wheel);assert.ok(wheel.defaultPrevented);
observer.setMode('place');assert.ok(camera.position.equals(original));assert.equal(camera.fov,42);
observer.setMode('orbit');assert.ok(camera.position.equals(original));assert.equal(controls.enabled,true);
assert.ok(lookDirection(0,0).distanceTo(new THREE.Vector3(0,0,-1))<1e-12);
assert.ok(Math.abs(lookDirection(2,1).length()-1)<1e-12);
observer.dispose();
console.log('PASS: placement versus drag, rejection feedback, 1.7 m eye height, fixed-position look, zenith, cancel, resize, wheel and orbit restoration.');
