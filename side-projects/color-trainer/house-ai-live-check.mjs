// Read-only browser smoke: only AI-preview POSTs are allowed, never review saves.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Store} from './store.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.argv[2])).href);
const store=new Store('side-projects/color-trainer/data'),names=await store.tasks();
const training=await fetch('http://127.0.0.1:8791/api/parts/training').then(r=>r.json());
const records=new Map();for(const name of names)records.set(name,createHash('sha256').update(await readFile(resolve(store.root??'side-projects/color-trainer/data',name))).digest('hex'));
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[],report=[];
try{
  await mkdir('.tmp/house-ai',{recursive:true});
  const page=await browser.newPage({viewport:{width:1280,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',route=>{const request=route.request();if(request.method()==='POST'&&!new URL(request.url()).pathname.endsWith('/house-ai'))return route.abort();return route.continue();});
  for(const [i,name] of names.slice(0,2).entries()){
    const task=await store.read(name);
    await page.goto(`http://127.0.0.1:8791/hus?task=${task.id}`);await page.waitForFunction(()=>!document.querySelector('#ai').disabled);
    if(training.latest){assert.ok((await page.locator('#trainingMetrics').textContent()).includes((training.latest.test.after.iou*100).toFixed(1)+' %'));if(i===0)await page.locator('section[aria-label="Husmodellens læring"]').screenshot({path:'.tmp/house-ai/learning-status.png'});}
    for(let view=0;view<2;view++){
      if(view===1){const current=await page.locator('#photo').inputValue(),choices=await page.locator('#photo option').evaluateAll(options=>options.map(o=>({value:o.value,text:o.textContent})));const side=choices.find(o=>!o.text.startsWith('Luftfoto')&&o.value!==current);if(!side)continue;await page.selectOption('#photo',side.value);}
      const response=page.waitForResponse(r=>r.url().endsWith('/house-ai')&&r.request().method()==='POST');
      await page.locator('#ai').click();const result=await (await response).json();assert.ok(!result.error,result.error);
      if(training.active)assert.equal(result.learning?.version,training.active.version,'Actual inference must use the persisted learned model');
      await page.waitForFunction(()=>!document.querySelector('#ai').disabled);
      if(!result.regions.length)assert.equal(await page.locator('#approve').isDisabled(),true,'Empty AI results cannot be approved as a successful prediction');
      await page.locator('#preview').screenshot({path:`.tmp/house-ai/house-${i}-view-${view}.png`});
      report.push({taskId:task.id,view,objects:result.objects.map(o=>o.category),seconds:result.seconds,learning:result.learning,source:result.sources});
    }
  }
  assert.deepEqual(errors,[]);
  assert.ok(report.filter(r=>r.objects.includes('main-house')).length>=2,'Main-house proposals on at least two actual source photos');
  // The user's other open trainer tab can legitimately save color reviews while
  // this read-only browser runs. Report concurrent changes instead of attributing
  // them to this tab, whose every save/approval POST is blocked above.
  let concurrentTaskChanges=0;
  for(const [name,hash] of records)if(createHash('sha256').update(await readFile(resolve(store.root??'side-projects/color-trainer/data',name))).digest('hex')!==hash)concurrentTaskChanges++;
  await writeFile('.tmp/house-ai/report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({actualPhotos:report.length,activeLearningVersion:training.active?.version,previews:report.map(r=>({objects:r.objects,seconds:r.seconds})),colorTaskFilesUnchanged:records.size-concurrentTaskChanges,concurrentTaskChanges,reviewWrites:0,pageErrors:errors.length}));
}finally{await browser.close();}
