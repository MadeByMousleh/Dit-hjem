// Real local photos, production-generated renderer, no annotation/backend writes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Store} from '../side-projects/color-trainer/store.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.argv[2])).href);
const source=new Store('side-projects/color-trainer/data');let task;
for(const name of await source.tasks()){const t=await source.read(name);if(t.faces?.filter(f=>f.patches?.some(p=>p.samplingVersion===2)).length>=4){task=t;break;}}
assert.ok(task,'Real calibrated photo fixture');
const generated=await readFile('src/generated/home3d-bundle.ts','utf8'),engine=JSON.parse(generated.slice(generated.indexOf('export const home3dBundle=')+'export const home3dBundle='.length).trim().replace(/;$/,''));
let config={...task.config,sun:{...task.config.sun,photographic:false,playing:false,live:false}};
const server=createServer((req,res)=>{res.setHeader('Cache-Control','no-store');if(req.url==='/engine.js'){res.setHeader('Content-Type','text/javascript');return res.end(engine);}if(req.url!=='/'){res.writeHead(404);return res.end();}res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><script>window.messages=[];window.ReactNativeWebView={postMessage:r=>window.messages.push(JSON.parse(r))};window.HOME_MODEL=${JSON.stringify(config).replaceAll('<','\\u003c')};</script><script src="/engine.js"></script></body></html>`);});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});await mkdir('.tmp/learned-facade',{recursive:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.messages.some(m=>m.type==='prepared-model'),null,{timeout:90000});
 const saved=await page.evaluate(()=>window.messages.find(m=>m.type==='prepared-model').model),learned=Object.entries(saved.scene.colors).filter(([,c])=>c.walls?.method==='trained-facade-knn-v1');
 assert.ok(learned.length>0,'Production-generated renderer applies learned colors to actual photo evidence');
 const mainIds=new Set(task.config.geometry.buildings.filter(b=>b.main).map(b=>b.id));assert.ok(learned.some(([id])=>mainIds.has(id)),'Actual main house receives a learned proposal');
 for(const [id,c]of learned){assert.ok(c.walls.modelVersion);assert.ok(c.walls.evidence.length>=2);assert.ok(saved.scene.buildings.some(b=>b.surface?.id===id&&b.surface.kind==='walls'),'Saved wall mesh retains building identity');}
 await page.screenshot({path:'.tmp/learned-facade/actual-photo-model.png'});
 config={...config,prepared:saved.scene,photos:{...task.config.photos,photos:[{image:'intentionally invalid on saved path'}]}};
 await page.reload();await page.waitForFunction(()=>window.messages.some(m=>m.type==='ready'));
 assert.equal(await page.evaluate(()=>window.messages.filter(m=>m.type==='prepared-model').length),0,'Saved model never recomputes colors or writes on reopening');
 assert.deepEqual(errors,[]);await writeFile('.tmp/learned-facade/actual-evidence.json',JSON.stringify({learned:learned.map(([id,c])=>({id,...c.walls})),annotationWrites:0,backendCalls:0},null,2));
 console.log(JSON.stringify({actualMainHouse:true,learnedBuildings:learned.length,modelVersion:learned[0][1].walls.modelVersion,savedColorAndEvidence:true,reopenWithoutPhotoAnalysis:true,annotationWrites:0,pageErrors:0}));
}finally{await browser?.close();server.closeAllConnections();await new Promise(done=>server.close(done));}
