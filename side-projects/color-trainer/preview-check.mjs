// Synthetic browser fixture: no provider requests and no annotation writes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {buildRenderer} from './renderer.mjs';

const {chromium}=await import(pathToFileURL(resolve(process.argv[2])).href);
let engine=await buildRenderer();
const needle='renderer.render(scene, camera);';
assert.ok(engine.includes(needle),'Renderer inspection anchor exists');
const renderAt=engine.lastIndexOf(needle);
engine=engine.slice(0,renderAt)+engine.slice(renderAt).replace(needle,`${needle}
 window.trainerCheck=()=>{
  renderer.render(scene,camera);
  const gl=renderer.getContext(),pixels=[],ray=new Raycaster();
  for(const mesh of buildingRenderMeshes){
   if(mesh.userData.houseSurface?.kind!=='walls'||mesh.userData.houseSurface.id!=='house')continue;
   const p=mesh.geometry.attributes.position,ix=mesh.geometry.index;
   for(let i=0;i<(ix?ix.count:p.count);i+=3){
    const centre=new Vector3();
    for(let j=0;j<3;j++)centre.add(new Vector3().fromBufferAttribute(p,ix?ix.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));
    centre.divideScalar(3);const projected=centre.clone().project(camera);
    if(Math.abs(projected.x)>.95||Math.abs(projected.y)>.95)continue;
    ray.setFromCamera(new Vector2(projected.x,projected.y),camera);
    const hit=ray.intersectObjects(allMeshes,false)[0];
    if(!hit||hit.object!==mesh||hit.point.distanceTo(centre)>.05)continue;
    const pixel=new Uint8Array(4);
    gl.readPixels(Math.floor((projected.x+1)*gl.drawingBufferWidth/2),Math.floor((projected.y+1)*gl.drawingBufferHeight/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
    pixels.push(Array.from(pixel).slice(0,3));
   }
  }
  return {pixels,materials:buildingRenderMeshes.map(m=>({surface:m.userData.houseSurface??null,type:m.material.type,color:m.material.color.getHexString()}))};
 };
 `);
const ring=(x,y)=>[[x-5,y-5],[x+5,y-5],[x+5,y+5],[x-5,y+5],[x-5,y-5]];
const geometry={addressId:'trainer-preview-fixture',point:[500020,6100020],bbox:[500000,6100000,500040,6100040],latitude:55.68,longitude:12.57,parcels:[{id:'parcel',number:'1',polygons:[[[[500000,6100000],[500040,6100000],[500040,6100040],[500000,6100040],[500000,6100000]]]]}],buildings:[{id:'house',main:true,associated:false,rings:[ring(500016,6100016)],height:5},{id:'neighbour',main:false,associated:false,rings:[ring(500031,6100031)],height:4}],source:'Synthetic',notice:'',warnings:[]};
const sun={minute:720,active:true,playing:false,photographic:false,photoColors:true,vectors:Array(97).fill([0,1,0])};
const config={geometry,heights:null,photos:null,texture:null,sun};
const server=createServer((req,res)=>{
 res.setHeader('Content-Type',req.url==='/engine.js'?'text/javascript':'text/html');
 res.end(req.url==='/engine.js'?engine:req.url==='/scene'?`<body style="margin:0"><script>window.HOME_MODEL=${JSON.stringify(config)}</script><script src="/engine.js"></script>`:'<body style="margin:0"><iframe style="width:100vw;height:100vh;border:0" src="/scene"></iframe>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 await mkdir('.tmp/color-preview',{recursive:true});
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:800}}),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.log('Page error:',e.message);});
  page.on('console',m=>{if(m.type()==='error')console.log('Console error:',m.text().slice(0,600));});
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const frame=page.frames().find(f=>f.url().endsWith('/scene'));
  await frame.waitForFunction(()=>!!window.trainerCheck);
  const inspect=()=>frame.evaluate(()=>{window.home3d.update({...window.HOME_MODEL.sun});return new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done(window.trainerCheck()))));});
  const before=await inspect();
  for(const color of ['#ffffff','#f7f7f7','#96533a']){
   await page.evaluate(color=>document.querySelector('iframe').contentWindow.postMessage({type:'trainer-colors',houseColor:color},location.origin),color);
   await page.waitForTimeout(150);
   const result=await inspect();
   console.log(JSON.stringify({width,color,samples:result.pixels.length,colors:[...new Set(result.pixels.map(p=>p.join(',')))]}));
   assert.ok(result.pixels.length>=2,'Visible wall samples');
   if(!process.argv.includes('--record')){
    const expected=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
    for(const pixel of result.pixels)pixel.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<=2,`Preview ${color}: got ${pixel}, expected ${expected}`));
   }
   const unchanged=r=>r.materials.filter(m=>m.surface?.id!=='house'||m.surface?.kind!=='walls');
   assert.deepEqual(unchanged(result),unchanged(before),'Roof and neighbour materials unchanged');
   if(color==='#ffffff')await page.screenshot({path:`.tmp/color-preview/white-${width}${process.argv.includes('--record')?'-before':''}.png`});
  }
  assert.deepEqual(errors,[]);await page.close();
 }
}finally{await browser?.close();await new Promise(done=>server.close(done));}
