// Browser verification uses only synthetic tasks in an OS temporary directory.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
import jpeg from 'jpeg-js';
import {Store} from './store.mjs';
import {houseProposal,partsStatus,nextPartsId} from './house-proposal.mjs';
import {readParts,saveParts} from './parts-store.mjs';
import {houseAICandidate} from './house-ai.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.argv[2])).href);
const dir=await mkdtemp(join(tmpdir(),'house-pages-')),store=new Store(dir);
const aiCacheRoot=join(dir,'ai-cache');
const aiWorker={infer:async photos=>({views:photos.map(p=>({photoKey:p.photoKey,width:100,height:100,seconds:1,detections:1,regions:[{category:'main-house',points:[[.3,.3],[.7,.3],[.7,.7],[.3,.7]],score:.8,maskQuality:.95,label:'house',pixels:1600}]}))})};
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
const pixels=Buffer.alloc(100*100*4,180);for(let i=3;i<pixels.length;i+=4)pixels[i]=255;
const photo={direction:'nadir',capturedAt:'2026-01-01',image:'data:image/jpeg;base64,'+jpeg.encode({data:pixels,width:100,height:100},90).data.toString('base64'),camera:{center:[0,0,100],rotation:[1,0,0,0,1,0,0,0,1],principal:[50,50],focal:[100,100],crop:[0,0,100,100]}};
const tasks=ids.map((id,i)=>({id,address:{text:`Synthetic house ${i+1}`},status:i?'draft':'approved',revision:3,labels:[],faces:[],history:[],config:{geometry:{buildings:[{id:'building-'+i,main:true,height:3,rings:[[[-15,-15],[15,-15],[15,15],[-15,15]]]}]},heights:null,photos:{photos:[photo,{...photo,direction:'south'}]}}}));
const errors=[],calls=[];
let trainingFixture=null,trainingPolls=0;
const trainingCounts={train:{houses:3},validation:{houses:1},test:{houses:1}};
const server=createServer(async(req,res)=>{try{
  const path=new URL(req.url,'http://localhost').pathname;calls.push(path);
  const json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
  if(!path.startsWith('/api/')){const name=path==='/hus'?'house.html':path==='/facade'?'index.html':path.slice(1);res.setHeader('Content-Type',/\.m?js$/.test(name)?'text/javascript':name.endsWith('.css')?'text/css':'text/html; charset=utf-8');return res.end(await readFile(`side-projects/color-trainer/${name}`));}
  if(path==='/api/parts/status')return json(await partsStatus(store,readParts));
  if(path==='/api/parts/training'){
    if(trainingFixture&&++trainingPolls>1)trainingFixture.job={status:'complete'};
    return json({counts:trainingCounts,eligiblePhotos:5,ready:true,job:trainingFixture?.job??null,latest:trainingFixture?.job.status==='complete'?trainingFixture.result:null,active:null});
  }
  const chunks=[];for await(const c of req)chunks.push(c);const input=chunks.length?JSON.parse(Buffer.concat(chunks)):{};
  if(path==='/api/parts/train'){
    trainingPolls=0;trainingFixture={job:{status:'running',stage:'training',epoch:1},result:{counts:trainingCounts,promote:true,test:{before:{iou:.6,precision:.7,recall:.8},after:{iou:.75,precision:.8,recall:.9},preliminary:true}}};return json(trainingFixture.job);
  }
  if(path==='/api/parts/next'){const state=await partsStatus(store,readParts),id=nextPartsId(state.history,input.after);if(!id)throw Error('No more synthetic houses');const t=await store.read(`task-${id}.json`);return json({...t,photos:t.config.photos.photos,config:undefined});}
  const match=path.match(/^\/api\/task\/([^/]+)(?:\/(.*))?$/),task=match&&await store.read(`task-${match[1]}.json`);
  if(match?.[2]==='house-proposal')return json(houseProposal(task));
  if(match?.[2]==='house-ai')return json(await houseAICandidate(task,input.photoKey,aiWorker,{cacheRoot:aiCacheRoot,learningRoot:dir}));
  if(match?.[2]==='parts')return json(req.method==='POST'?await saveParts(store,task.id,input,{aiCacheRoot:aiCacheRoot}):await readParts(store,task.id));
  if(task)return json({...task,photos:task.config.photos.photos,config:undefined});
  throw Error('Unexpected path '+path);
}catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}});
let browser;
try{
  await new Promise(done=>server.listen(0,'127.0.0.1',done));await mkdir('.tmp/house-pages',{recursive:true});
  browser=await chromium.launch({channel:'chrome',headless:true});
  for(const width of [390,1280]){
    trainingFixture=null;trainingPolls=0;
    for(const task of tasks){await store.write(`task-${task.id}.json`,task);await rm(join(dir,`parts-${task.id}.json`),{force:true});}
    const page=await browser.newPage({viewport:{width,height:1000},hasTouch:width===390});page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/hus?task=${ids[0]}`);
    await page.waitForFunction(()=>!document.querySelector('#approve').disabled);
    assert.equal((await readParts(store,ids[0])).revision,0,'Proposal GET never persists');
    assert.equal(await page.locator('#scene').count(),0);assert.equal(await page.locator('#train').count(),0);
    await page.locator('#trainHouse').click();await page.waitForFunction(()=>document.querySelector('#trainingStatus').textContent.includes('Træner runde'));
    assert.equal(await page.locator('#trainHouse').isDisabled(),true);
    await page.waitForFunction(()=>document.querySelector('#trainingMetrics').textContent.includes('60.0 % → 75.0 %'));
    await page.locator('#ai').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('AI fandt'));
    assert.equal((await readParts(store,ids[0])).revision,0,'AI preview never saves review labels');
    await page.locator('#discardAI').click();await page.waitForFunction(()=>!document.querySelector('#approve').disabled);
    await page.locator('#approve').click();await page.waitForFunction(()=>document.querySelector('#address').textContent==='Synthetic house 2');
    const accepted=await readParts(store,ids[0]);assert.equal(accepted.status,'reviewed');assert.equal(accepted.provenance.review,'accepted');assert.deepEqual(accepted.completePhotos,[]);
    await page.locator('#ai').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('AI fandt'));
    await page.locator('#edit').click();const dialog=page.getByRole('dialog',{name:'Marker bygningsdele'});await dialog.waitFor();
    const box=await dialog.boundingBox();assert.ok(Math.abs(box.width-width)<1&&Math.abs(box.height-1000)<1);
    await dialog.getByRole('button',{name:'Fortryd punkt',exact:true}).click();
    await dialog.getByRole('button',{name:'Gem kladde',exact:true}).click();await dialog.waitFor({state:'detached'});
    const draft=await readParts(store,ids[1]);assert.equal(draft.status,'draft');assert.equal(draft.provenance.review,'corrected');
    assert.equal(draft.provenance.method,'grounded-sam2-house-v3');
    await page.reload();await page.waitForFunction(()=>!document.querySelector('#edit').disabled);
    await page.locator('#edit').click();await dialog.getByRole('button',{name:'Godkend markeringer',exact:true}).click();await dialog.waitFor({state:'detached'});
    assert.equal((await readParts(store,ids[1])).status,'reviewed');
    for(const task of tasks)assert.deepEqual(await store.read(`task-${task.id}.json`),task,'Color tasks unchanged');
    await page.screenshot({path:`.tmp/house-pages/house-${width}.png`,fullPage:true});
    assert.equal(await page.locator('nav a[aria-current=page]').getAttribute('href'),'/hus');
    await page.close();console.log(JSON.stringify({width,separatePage:true,readOnlyProposal:true,directApprove:true,ownQueue:true,fullscreenEdit:true,correctedDraftReload:true,colorTasksUnchanged:true}));
  }
  assert.deepEqual(errors,[]);assert.ok(!calls.includes('/api/train')&&!calls.some(p=>p.endsWith('/patches')||p.endsWith('/save')));
}finally{await browser?.close();server.closeAllConnections();await new Promise(done=>server.close(done));await rm(dir,{recursive:true,force:true});}
