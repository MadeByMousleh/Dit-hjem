import assert from 'node:assert/strict';
import * as THREE from 'three';
import {build} from 'esbuild';
const compiled=await build({entryPoints:['src/web/aerial-facades.ts'],bundle:true,platform:'node',format:'esm',external:['three'],write:false});
// Keep bare Three imports resolvable from the repository for the test module.
const code=compiled.outputFiles[0].text.replaceAll('from "three"',`from ${JSON.stringify(new URL('../node_modules/three/build/three.module.js',import.meta.url).href)}`);
const {aerialFacades}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const mesh=new THREE.Mesh(new THREE.PlaneGeometry(10,4),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.position.set(5,2,.2);mesh.userData.houseSurface={id:'house',kind:'walls'};mesh.updateMatrixWorld(true);
const camera=new THREE.PerspectiveCamera(45,1,.1,100);camera.position.set(5,2,15);camera.lookAt(5,2,0);camera.updateMatrixWorld(true);
const e=camera.matrixWorldInverse.elements,focal=500/Math.tan(Math.PI/8),photo={image:'source',width:1000,height:1000,camera:{center:[5,-15,2],rotation:[e[0],-e[8],e[4],e[1],-e[9],e[5],e[2],-e[10],e[6]],crop:[0,0,1000,1000],focal:[focal,focal],principal:[500,500]}};
const quad=[[2,3,.2],[4,3,.2],[4,1,.2],[2,1,.2]].map(p=>new THREE.Vector3(...p).project(camera)).map(p=>[(p.x+1)/2,(1-p.y)/2]);
const geometry={buildings:[{id:'house',main:true,rings:[[[0,0],[10,0],[10,8],[0,8],[0,0]]],height:7}]},detections={version:1,views:[{viewId:'photo-0',openings:[{kind:'window',quad,confidence:.9,frameColor:'#000000',panelColor:'#000000'}]}]};
const models=aerialFacades(geometry,{photos:[photo]},detections,[mesh],0,0,0,()=>({base:0,height:4}));assert.equal(models.length,1);const model=models[0],opening=model.analysis.openings[0];
assert.ok(Math.abs(model.face.a[1]+.2)<1e-6,'Opening plane follows photo mesh, not the registered line');assert.equal(model.anchor.height,4,'Projection/render use the identical height');
assert.ok(Math.abs(opening.x-.2)<1e-6);assert.ok(Math.abs(opening.y-.25)<1e-6);assert.ok(Math.abs(opening.width-.2)<1e-6);assert.ok(Math.abs(opening.height-.5)<1e-6);
assert.equal(opening.frameColor,'#dddcd8','Ignore guessed black when frame pixels are unavailable');
console.log('Aerial placement: calibrated source contour, real mesh offset, shared anchor and exact normalized rectangle pass.');

// Multi-view openings arrive in wall coordinates and need no photo or ray casting.
const wall={kind:'window',wallId:'house:0',p0:[2,0],p1:[4,0],z0:1,z1:3,confidence:.9,support:2};
const fused=aerialFacades(geometry,null,{version:1,views:[],method:'multiview-v1',walls:[wall,{...wall,kind:'door',p0:[4,0],p1:[2,0]},{...wall,p0:[2,1.5],p1:[4,1.5]},{...wall,p0:[2,8],p1:[4,8]}]},[],0,0,0,()=>({base:0,height:4}));
assert.equal(fused.length,1,'only the correctly oriented opening on the physical wall is placed');
assert.equal(fused[0].id.startsWith('aerial-multiview-v1:'),true);
const placed=fused[0].analysis.openings;assert.equal(placed.length,1);
assert.ok(Math.abs(placed[0].x-.2)<1e-9&&Math.abs(placed[0].width-.2)<1e-9&&Math.abs(placed[0].y-.25)<1e-9&&Math.abs(placed[0].height-.5)<1e-9,'wall metres become the same normalized rectangle');
assert.equal(placed[0].kind,'window');
const raised=aerialFacades(geometry,null,{version:1,views:[],walls:[{...wall,z0:3.5,z1:5}]},[],0,0,0,()=>({base:0,height:4}));assert.equal(raised.length,0,'an opening above the wall anchor is not forced inside it');
console.log('Aerial placement: multi-view wall openings map to the matching face, orientation and height anchor.');
