import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const {chromium}=await import(pathToFileURL(resolve(process.argv[2])).href);
const code=await build({stdin:{resolveDir:process.cwd(),loader:'ts',contents:`
import * as THREE from 'three';import {OrbitControls} from 'three/addons/controls/OrbitControls.js';import {configureOrbitCamera,clampOrbitTarget,fitOrbitFootprint} from './src/web/orbit-camera';
const canvas=document.querySelector('canvas');canvas.style.touchAction='none';const camera=new THREE.PerspectiveCamera(42,390/700,.1,1000);camera.position.set(10,12,20);const controls=new OrbitControls(camera,canvas);configureOrbitCamera(controls);controls.update();
window.check=()=>({target:controls.target.toArray(),position:camera.position.toArray(),distance:camera.position.distanceTo(controls.target),min:controls.minDistance});
window.fit=()=>{const distance=camera.position.distanceTo(controls.target),limit=controls.maxDistance;const adjusted=fitOrbitFootprint(camera,controls,[new THREE.Vector3(35,0,-10),new THREE.Vector3(65,0,10)],[-50,-50,50,50]);return {adjusted,before:distance,after:camera.position.distanceTo(controls.target),limitBefore:limit,limitAfter:controls.maxDistance};};
window.bounds=()=>{const before=camera.position.clone().sub(controls.target);controls.target.set(100,0,-100);camera.position.copy(controls.target).add(before);clampOrbitTarget(camera,controls,[-50,-50,50,50]);return {target:controls.target.toArray(),offset:camera.position.clone().sub(controls.target).distanceTo(before)};};
`},bundle:true,format:'iife',write:false});
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':'text/html');res.end(req.url==='/app.js'?code.outputFiles[0].text:'<meta name="viewport" content="width=device-width,initial-scale=1"><canvas style="width:390px;height:700px"></canvas><script src="/app.js"></script>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:390,height:740},hasTouch:true});await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.check);
 const initial=await page.evaluate(()=>window.check());const cdp=await page.context().newCDPSession(page);
 const points=(x,y,gap=60)=>[{x:x-gap/2,y,id:1},{x:x+gap/2,y,id:2}];
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(180,300)});for(let x=185;x<=240;x+=5)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(x,330,60+(x%3)*2)});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const panned=await page.evaluate(()=>window.check());assert.ok(Math.hypot(...panned.target.map((v,i)=>v-initial.target[i]))>.5,'Two-finger drag moves orbit centre');assert.ok(Math.abs(panned.target[1]-initial.target[1])<1e-6,'Panning stays horizontal');assert.ok(Math.abs(panned.distance-initial.distance)<1e-6,'Pan with finger-spacing jitter must not zoom');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(180,300,60)});for(let gap=70;gap<=180;gap+=10)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(180,300,gap)});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok((await page.evaluate(()=>window.check())).distance<panned.distance,'Pinch zoom remains available');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(180,300,180)});for(let gap=170;gap>=60;gap-=10)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(180,300,gap)});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const zoomedOut=await page.evaluate(()=>window.check());assert.ok(zoomedOut.distance>panned.distance*.98,'Pinching back must restore zoom-out distance');
 const fit=await page.evaluate(()=>window.fit());assert.ok(fit.adjusted);assert.ok(Math.abs(fit.before-fit.after)<1e-8,'Map edge correction must not change zoom');assert.equal(fit.limitBefore,fit.limitAfter,'Map correction must not reduce zoom-out limit');
 const beforeMouse=await page.evaluate(()=>window.check());await page.mouse.move(180,300);await page.mouse.down({button:'right'});await page.mouse.move(240,330,{steps:8});await page.mouse.up({button:'right'});const afterMouse=await page.evaluate(()=>window.check());assert.notDeepEqual(afterMouse.target,beforeMouse.target,'Right drag pans');assert.equal(afterMouse.min,.8,'Close inspection enabled');
 const bounds=await page.evaluate(()=>window.bounds());assert.deepEqual(bounds.target,[42,0,-42]);assert.ok(bounds.offset<1e-9,'Bounds preserve viewing offset');console.log('PASS: touch pan, pinch zoom, mouse pan, close inspection and mapped bounds.');
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
