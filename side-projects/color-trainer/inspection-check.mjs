// Read-only source fixture from existing local photos. All analysis/review writes
// go to an OS temporary directory, never the user's training dataset.
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
const assertSame=(a,b,message='Persisted evidence must match')=>assert.ok(isDeepStrictEqual(a,b),message);
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Store} from './store.mjs';
import {analyzeTaskPatches} from './analysis.mjs';
import {buildRenderer} from './renderer.mjs';
import jpeg from 'jpeg-js';
import {semanticAnalysis} from './semantic.mjs';
import {photoKey,runsFor} from './sampling.mjs';
import {readParts,saveParts,exportParts,emptyParts} from './parts-store.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.argv[2])).href);
const source=new Store('side-projects/color-trainer/data');
let original;
for(const name of await source.tasks()){const t=await source.read(name);if(t.faces.length>=8){original=t;break;}}
assert.ok(original,'Existing calibrated photo fixture');
const dir=await mkdtemp(join(tmpdir(),'facade-inspection-')),store=new Store(dir),engine=await buildRenderer();
const id='55555555-5555-4555-8555-555555555555';
const publicTask=t=>({...t,photos:t.config.photos.photos,config:undefined});
const reset=async()=>store.write(`task-${id}.json`,{...original,id,address:{...original.address,text:'Local photo inspection fixture'},revision:0,status:'draft',labels:[],history:[],faces:[],samplingVersion:undefined,rejectedFaces:[],rejectedViews:[]});
const errors=[];
let semanticFixture=null;
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
  if(url.pathname==='/engine.js'){res.setHeader('Content-Type','text/javascript');return res.end(engine);}
  if(['/','/app.js','/style.css','/sampling.mjs','/inspection.js','/polygon.mjs','/polygon-editor.js','/image-workspace.js','/parts-editor.js','/part-labels.mjs'].includes(url.pathname)){const name=url.pathname==='/'?'index.html':url.pathname.slice(1);res.setHeader('Content-Type',/\.m?js$/.test(name)?'text/javascript':name.endsWith('.css')?'text/css':'text/html; charset=utf-8');return res.end(await readFile(`side-projects/color-trainer/${name}`));}
  const task=await store.read(`task-${id}.json`);
  if(url.pathname==='/api/status')return json({approved:0,labels:0,model:null,history:[]});
  if(url.pathname==='/api/parts/export')return json(await exportParts(store));
  if(req.method==='GET'&&url.pathname.endsWith('/parts'))return json(await readParts(store,id));
  if(url.pathname==='/api/next')return json(publicTask(task));
  if(url.pathname.endsWith('/semantic'))return json(semanticFixture);
  if(url.pathname.endsWith('/scene')){res.setHeader('Content-Type','text/html');return res.end(task.syntheticManual?'<body>Synthetic manual selection fixture</body>':`<body style="margin:0"><script>window.HOME_MODEL=${JSON.stringify(task.config).replaceAll('<','\\u003c')}</script><script src="/engine.js"></script>`);}
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const body=chunks.length?JSON.parse(Buffer.concat(chunks)):{};
  if(url.pathname.endsWith('/parts'))return json(await saveParts(store,id,body));
  if(url.pathname.endsWith('/patches'))return json(publicTask(await analyzeTaskPatches(store,id,body.patches)));
  if(url.pathname.endsWith('/save')){
    let analysis;
    if(body.semanticSignature!==undefined){assert.equal(body.semanticSignature,semanticFixture.signature);analysis=semanticAnalysis(task,semanticFixture,null);}
    return json(publicTask(await store.save(id,body.revision,body.labels,body.status,body.houseColor,body.manualSelections,analysis)));
  }
  res.writeHead(404);res.end();
 }catch(e){errors.push(e.message);res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}
});
await reset();await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 await mkdir('.tmp/facade-inspection',{recursive:true});
 for(const width of [390,1280]){
  await reset();const page=await browser.newPage({viewport:{width,height:1000},hasTouch:width===390});
  page.on('pageerror',e=>{errors.push(e.message);console.log('Page error:',e.message);});
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('#next').click();
  await page.waitForFunction(()=>document.querySelector('#samplingInfo').textContent.includes('fotoudsnit udeladt'),null,{timeout:60000});
  const task=await store.read(`task-${id}.json`);
  assert.equal(task.samplingVersion,2);assert.ok(task.faces.length>0,'Retain at least one usable facade');
  assert.ok(task.faces.every(f=>f.patches.every(p=>p.maskRuns?.length&&p.sampleRuns?.length&&p.sampleCount>=32&&p.photoKey&&p.contextSize)));
  await page.waitForFunction(()=>[...document.querySelectorAll('.photo-evidence canvas')].some(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return d.some((v,i)=>i%4===3&&v>0);}));
  const overlays=await page.locator('.photo-evidence canvas').count();assert.ok(overlays>=2);
  await page.locator('#showSampling').uncheck();assert.equal(await page.locator('.photo-evidence canvas:visible').count(),0);
  await page.locator('#showSampling').check();assert.equal(await page.locator('.photo-evidence canvas:visible').count(),overlays);
  await page.getByRole('button',{name:'Hvid',exact:true}).click();await page.locator('#draft').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Kladde gemt'));
  const saved=await store.read(`task-${id}.json`);assert.equal(saved.houseColor.hex,'#f7f7f4');
  assertSame(saved.faces,task.faces,'Choosing a label never changes sampling');
  await page.locator('#photos').screenshot({path:`.tmp/facade-inspection/overlay-${width}.png`});
  await page.reload();await page.locator('#next').click();
  await page.waitForFunction(()=>document.querySelector('#hex').value==='#f7f7f4');
  assertSame((await store.read(`task-${id}.json`)).faces,saved.faces);
  console.log(JSON.stringify({width,acceptedFaces:task.faces.length,acceptedViews:task.faces.reduce((n,f)=>n+f.patches.length,0),rejectedViews:task.rejectedViews.length,overlays,saveReload:true,realAnnotationWrites:0}));
  // Previously reviewed tasks retain their original evidence and are clearly
  // identified as legacy rather than displaying freshly recomputed masks.
  const legacy={...original,id,address:{...original.address,text:'Legacy evidence fixture'}};
  await store.write(`task-${id}.json`,legacy);
  await page.reload();await page.locator('#next').click();
  await page.waitForFunction(()=>document.querySelector('#samplingInfo').textContent.includes('Ældre analyse'));
  await page.waitForFunction(()=>!document.querySelector('#next').disabled);
  assert.equal(await page.locator('#photos').textContent().then(t=>t.includes('© Klimadatastyrelsen')),true);
  assertSame(await store.read(`task-${id}.json`),legacy);
  const empty={...saved,revision:0,status:'draft',labels:[],history:[],faces:[],rejectedFaces:['empty']};
  await store.write(`task-${id}.json`,empty);
  await page.reload();await page.locator('#next').click();
  await page.waitForFunction(()=>document.querySelector('#analysisInfo').textContent.includes('Ingen brugbare facadeudsnit'));
  assert.equal(await page.locator('#approve').isDisabled(),true);
  // Synthetic image: grey wall centre, red background. This lets us verify
  // both pointer placement and that the server measures only the drawn wall.
  const data=Buffer.alloc(64*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++)data.set(x>=16&&x<48&&y>=16&&y<48?[128,128,128,255]:[220,40,40,255],(y*64+x)*4);
  const photo={...original.config.photos.photos.find(p=>p.direction!=='nadir'),image:'data:image/jpeg;base64,'+jpeg.encode({data,width:64,height:64},100).data.toString('base64')};
  const manualFixture={...saved,syntheticManual:true,config:{...saved.config,photos:{...saved.config.photos,photos:[photo]}}};
  await store.write(`task-${id}.json`,manualFixture);
  await page.reload();await page.locator('#next').click();
  const edit=()=>page.getByRole('button',{name:'Ret facadeområde',exact:true}).click();
  await edit();
  const dialog=page.getByRole('dialog'),drawCanvas=dialog.locator('canvas');
  await page.waitForFunction(()=>document.querySelector('.polygon-photo canvas').dataset.naturalWidth==='64');
  const click=async(x,y)=>{await page.waitForFunction(()=>!!document.querySelector('.polygon-photo canvas')?.dataset.imageRect);const r=await drawCanvas.boundingBox(),im=JSON.parse(await drawCanvas.getAttribute('data-image-rect')),px=r.x+im.x+x*im.width,py=r.y+im.y+y*im.height;if(width===390)await page.touchscreen.tap(px,py);else await page.mouse.click(px,py);};
  await click(.25,.25);await dialog.getByRole('button',{name:'Annuller',exact:true}).click();
  assertSame(await store.read(`task-${id}.json`),manualFixture);
  await edit();await click(.25,.25);await click(.75,.75);await click(.25,.75);await click(.75,.25);
  await dialog.getByRole('button',{name:'Gem område',exact:true}).click();
  await dialog.getByRole('status').filter({hasText:'krydse'}).waitFor();
  assertSame(await store.read(`task-${id}.json`),manualFixture);
  await dialog.getByRole('button',{name:'Tegn om',exact:true}).click();
  await click(.25,.25);await click(.75,.25);await click(.75,.75);await click(.25,.75);
  await dialog.getByRole('button',{name:'Fortryd punkt',exact:true}).click();
  await click(.25,.75);
  await dialog.screenshot({path:`.tmp/facade-inspection/polygon-${width}.png`});
  await dialog.getByRole('button',{name:'Gem område',exact:true}).click();await dialog.waitFor({state:'detached'});
  await page.waitForFunction(()=>document.querySelector('#samplingInfo').textContent.includes('1 tegnede'));
  const drawn=await store.read(`task-${id}.json`);assert.equal(drawn.manualSelections.length,1);assert.equal(drawn.faces.length,1);
  assert.ok(drawn.faces[0].feature.every(v=>Math.abs(v-128/255)<.02));
  assertSame(drawn.automaticAnalysis.faces,saved.faces);
  await page.getByRole('button',{name:'Hvid',exact:true}).click();await page.locator('#approve').click();
  await page.waitForFunction(()=>!document.querySelector('#next').disabled);
  const approvedManual=await store.read(`task-${id}.json`);assert.equal(approvedManual.status,'approved');
  assert.equal((await store.rows())[0].selectionMethod,'human-polygon');
  await page.reload();await page.locator('#next').click();
  await page.getByRole('button',{name:'Ret tegnet område',exact:true}).click();
  await dialog.getByRole('status').filter({hasText:'4 punkter'}).waitFor();
  await dialog.getByRole('button',{name:'Annuller',exact:true}).click();
  await page.locator('#automaticSampling').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('er gendannet')&&!document.querySelector('#next').disabled);
  const restored=await store.read(`task-${id}.json`);assertSame(restored.faces,saved.faces);assert.equal(restored.status,'draft');
  semanticFixture={model:'fixture-clipseg',revision:'pinned',signature:'b'.repeat(64),views:[{photoKey:photoKey(photo),width:64,height:64,feature:Array(9).fill(.5),maskRuns:runsFor(Array.from({length:32*32},(_,i)=>(16+Math.floor(i/32))*64+16+i%32)),usableRuns:runsFor(Array.from({length:32*32},(_,i)=>(16+Math.floor(i/32))*64+16+i%32)),pixels:1024,usablePixels:1024}]};
  await page.locator('#aiSampling').click();
  await page.waitForFunction(()=>document.querySelector('#samplingInfo').textContent.includes('AI-forsøg'));
  assertSame(await store.read(`task-${id}.json`),restored,'AI preview never changes saved task');
  await page.locator('#applyAiSampling').click();
  await page.waitForFunction(()=>document.querySelector('#samplingInfo').textContent.includes('AI-områder er valgt'));
  const ai=await store.read(`task-${id}.json`);assert.equal(ai.status,'draft');assert.equal(ai.semanticSampling.signature,semanticFixture.signature);
  assert.equal((await store.rows()).length,0);
  await page.locator('#approve').click();await page.waitForFunction(()=>!document.querySelector('#next').disabled);
  assert.equal((await store.rows())[0].selectionMethod,'whole-house-clipseg-v2');
  await page.reload();await page.locator('#next').click();
  await page.waitForFunction(()=>document.querySelector('#samplingInfo').textContent.includes('AI-områder er valgt'));
  await page.locator('#automaticSampling').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('er gendannet')&&!document.querySelector('#next').disabled);
  assertSame((await store.read(`task-${id}.json`)).faces,saved.faces);
  console.log(JSON.stringify({width,aiPreviewReadOnly:true,explicitApply:true,reapproval:true,aiReload:true,aiReset:true}));
  console.log(JSON.stringify({width,polygonPointer:width===390?'touch':'mouse',cancel:true,undo:true,crossingRejected:true,onlySelectedPixels:true,manualApproval:true,polygonReload:true,automaticReset:true}));
  await page.close();
 }
 assertSame(errors,[]);
}finally{await browser?.close();server.closeAllConnections();await new Promise(done=>server.close(done));await rm(dir,{recursive:true,force:true});}
