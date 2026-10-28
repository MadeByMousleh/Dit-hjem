import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import jpeg from 'jpeg-js';
import {Store} from '../color-trainer/store.mjs';
import {split} from '../color-trainer/model.mjs';
import {listingUrl,parseListing} from './edc.mjs';
import {labelFacade,selectExteriors,verifyExteriors,normalizedFacadeBox,verifiedExteriors} from './teacher.mjs';
import {trainCandidate} from './training.mjs';
import {ReviewBatch} from './review.mjs';
import {randomUUID} from 'node:crypto';
import {ReviewedTraining} from './review-training.mjs';
test('EDC parser separates gallery from floor plans and restricts source URLs',()=>{
 const url='https://www.edc.dk/alle-boliger/villa/3480-by/vej-1/12345678/';
 assert.throws(()=>listingUrl('https://untrusted.invalid/private'));assert.throws(()=>listingUrl('https://www.edc.dk/umbraco/private'));
 const image=n=>({sources:[{width:300,src:`https://billeder.edc.dk/edcmedia/${n}_small.jpg`},{width:1080,src:`https://billeder.edc.dk/edcmedia/${n}_large.jpg`}]});
 const item={estateTypeName:'Villa',caseNumber:'12345678',address:'Vej 1',zipCode:'3480',city:'By',images:[image(1),image(2),image(3)],bluePrints:[image(999)]};
 const parsed=parseListing(`<script type="application/json">${JSON.stringify(item)}</script>`,url);assert.equal(parsed.images.length,3);assert.ok(!parsed.images.some(p=>p.url.includes('999')));
});
test('Teacher rejects mixed facade and unsupported photo identifiers',async()=>{
 const response=result=>async()=>({ok:true,json:async()=>({usageMetadata:{promptTokenCount:100},candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(result)}]}}]})});
 const label=await labelFacade([],[],{key:'synthetic',fetcher:response({sameBuilding:true,uniformFacade:false,appearanceCompatible:true,facadeHex:'#e2c584',confidence:.99,reason:'Mixed',uncertainties:[],colorFamily:'yellow'})});assert.equal(label.accepted,false);
  const selection=await selectExteriors([{id:'sale-1',image:'data:image/jpeg;base64,AA=='}],{key:'synthetic',fetcher:response({exteriors:[{id:'unknown',confidence:1,facadeBox:[.1,.1,.9,.9]},{id:'sale-1',confidence:.9,facadeBox:[.1,.1,.9,.9]},{id:'sale-1',confidence:1,facadeBox:[.1,.1,.9,.9]}]})});assert.equal(selection.selected.length,1);
});
test('Candidate training is isolated and excludes human holdout buildings',async()=>{
 const root=await mkdtemp(join(tmpdir(),'auto-color-test-'));try{
  const manual=new Store(join(root,'manual')),auto=new Store(join(root,'auto'));await manual.init();await auto.init();
  const ids=Array.from({length:100},(_,i)=>String(i)),training=ids.filter(id=>split(id)==='train').slice(0,3),held=ids.find(id=>split(id)==='test');
  for(const [i,id]of [...training,held].entries())await manual.write(`task-${i}.json`,{id:String(i),status:'approved',revision:1,address:{id:'synthetic'},faces:[{faceId:'face-'+id,buildingId:id,feature:Array(9).fill(.5)}],labels:[{faceId:'face-'+id,visibility:'known',hex:'#808080'}],history:[{at:'2026-01-01'}]});
  await manual.write('model.json',{samples:training.map(buildingId=>({buildingId,feature:Array(9).fill(.5),hex:'#808080'}))});const before=await readFile(join(root,'manual/model.json'));
  const pixels=Buffer.alloc(32*32*4);for(let i=0;i<pixels.length;i+=4){pixels[i]=150;pixels[i+1]=83;pixels[i+2]=58;pixels[i+3]=255;}
  const patch={faceId:'pilot',buildingId:held,image:jpeg.encode({data:pixels,width:32,height:32},100).data.toString('base64')};
  const result=await trainCandidate(auto,{id:'pilot',buildingId:held,verification:{accepted:true},teacher:{accepted:true,result:{facadeHex:'#96533a'}},labelProvenance:{humanApproved:false}},[patch],{manualRoot:join(root,'manual')});
  assert.equal(result.aiTrainingHouses,0);assert.equal(result.evaluation.candidate.houses,1);assert.deepEqual(await readFile(join(root,'manual/model.json')),before);
  const candidate=await auto.read(result.file);assert.ok(!candidate.samples.some(s=>s.buildingId===held));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('Full-size audit rejects terrace photos even after confident selection',async()=>{
 const images=[1,2,3].map(n=>({id:'sale-'+n,image:'data:image/jpeg;base64,AA=='}));
 const verify=checks=>verifyExteriors(images,{key:'synthetic',fetcher:async()=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({checks})}]}}]})})});
 const checks=images.map(p=>({id:p.id,mainHouseWall:true,usableForColor:true,facadeBox:[.1,.2,.9,.8],reason:'Tydelig ydermur'}));
 assert.equal((await verify(checks)).accepted,true);
 const terrace=await verify(checks.map((c,i)=>i===2?{...c,mainHouseWall:false,usableForColor:false,reason:'Kun terrasse og tagkant'}:c));assert.equal(terrace.accepted,false);assert.equal(terrace.checks.filter(c=>c.accepted).length,2);
 assert.equal((await verify(checks.slice(0,2))).accepted,false);
 assert.equal((await verify([...checks,checks[0]])).accepted,false);
 assert.equal((await verify(checks.map(c=>({...c,facadeBox:[.1,.1,.2,.2]})))).accepted,false);
 await assert.rejects(trainCandidate(null,{verification:{accepted:false}},[]),/billedkontrol/);
});

test('Review saves the actual AI color with revisions, history and mixed-material scope',async()=>{
 const root=await mkdtemp(join(tmpdir(),'auto-color-review-'));try{
  const files=new Store(root);await files.init();const id=randomUUID(),batch=new ReviewBatch(files);
  await files.write('review-list.json',{target:30,items:[{id,url:'https://www.edc.dk/example',status:'done'}]});
  const store=batch.house(id);await store.init();await store.write('pilot.json',{images:[{id:'sale-1'}],imageReview:{rejectedImageIds:[]},teacher:{model:'synthetic',result:{sameBuilding:true,appearanceCompatible:true,uniformFacade:false,facadeHex:'#96533A'}},labelProvenance:{sourceImageHashes:['synthetic-sha']}});
  const accepted=await batch.saveReview(id,{revision:0,status:'accepted',hex:'#FFFFFF'});
  assert.equal(accepted.hex,'#96533a');assert.equal(accepted.scope,'visible-facade-material');assert.equal(accepted.history.length,1);
  assert.equal((await new ReviewBatch(files).status()).items[0].review.status,'accepted');
  await assert.rejects(batch.saveReview(id,{revision:0,status:'skipped'}),/Genindlæs/);
  await batch.saveReview(id,{revision:1,status:'pending'});assert.equal((await store.read('review.json')).history.length,2);
  await store.write('pilot.json',{images:[],teacher:{result:{sameBuilding:false,facadeHex:'#FFFFFF'}}});
  await assert.rejects(batch.saveReview(id,{revision:2,status:'accepted'}),/Ingen brugbar/);
  assert.throws(()=>batch.house('../outside'),/Ugyldigt/);
 }finally{if(!root.startsWith(join(tmpdir(),'auto-color-review-')))throw Error('Unsafe temporary root');await rm(root,{recursive:true,force:true});}
});

test('Real Gemini 0–1000 boxes normalize and review can use a small clear wall patch',()=>{
 assert.deepEqual(normalizedFacadeBox([240,85,798,725]),[.24,.085,.798,.725]);
 assert.equal(normalizedFacadeBox([0,0,2000,2000]),null);
 assert.equal(normalizedFacadeBox([.8,.8,.1,.1]),null);
 const answer={result:{checks:[{id:'sale-2',mainHouseWall:true,usableForColor:true,facadeBox:[191,436,456,620],reason:'Tydelig facade af mursten'}]}};
 assert.equal(verifiedExteriors(answer,[{id:'sale-2'}],1,.005).accepted,true);
 assert.equal(verifiedExteriors(answer,[{id:'sale-2'}]).accepted,false);
 answer.result.checks[0].mainHouseWall=false;assert.equal(verifiedExteriors(answer,[{id:'sale-2'}],1,.005).accepted,false);
});

test('Additional 100-house authorization is idempotent and capped at 130',async()=>{
 const root=await mkdtemp(join(tmpdir(),'auto-color-extend-'));try{
  const files=new Store(root);await files.init();const batch=new ReviewBatch(files);await batch.init();
  assert.equal((await batch.extend(100,'2026-10-22-add100')).target,130);
  assert.equal((await batch.extend(100,'2026-10-22-add100')).target,130);
  assert.equal((await batch.init()).authorizations.length,1);
  await assert.rejects(batch.extend(1000,'2026-10-22-add100'),/autoriseret/);
  assert.equal((await batch.extend(300,'2026-10-22-add300')).target,430);
  assert.equal((await batch.extend(300,'2026-10-22-add300')).target,430);
  assert.equal((await batch.init()).authorizations.length,2);
 }finally{if(!root.startsWith(join(tmpdir(),'auto-color-extend-')))throw Error('Unsafe root');await rm(root,{recursive:true,force:true});}
});

test('Automatic labels train directly and user removal persists across collection runs',async()=>{
 const root=await mkdtemp(join(tmpdir(),'auto-color-direct-'));try{
  const files=new Store(join(root,'auto')),manual=new Store(join(root,'manual'));await files.init();await manual.init();
  const ids=Array.from({length:100},(_,i)=>String(i)),trainIds=ids.filter(id=>split(id)==='train'),testIds=ids.filter(id=>split(id)==='test');
  for(const [i,id]of [...trainIds.slice(0,3),testIds[0]].entries())await manual.write(`task-${i}.json`,{id:String(i),status:'approved',revision:1,address:{id:'fixture'},faces:[{faceId:'face-'+id,buildingId:id,feature:Array(9).fill(.5)}],labels:[{faceId:'face-'+id,visibility:'known',hex:'#808080'}],history:[{at:'2026-01-01'}]});
  await manual.write('model.json',{samples:trainIds.slice(0,3).map(buildingId=>({buildingId,feature:Array(9).fill(.5),hex:'#808080'}))});
  const batch=new ReviewBatch(files),item={id:randomUUID(),autoTrain:true,status:'done'};await files.write('review-list.json',{target:430,items:[item]});
  const store=batch.house(item.id);await store.init();await store.write('input.json',{fixture:1});
  await store.write('pilot.json',{buildingId:testIds[1],inputFile:'input.json',images:[{id:'sale-1'}],imageReview:{rejectedImageIds:[]},teacher:{model:'fixture',result:{sameBuilding:true,appearanceCompatible:true,uniformFacade:true,facadeHex:'#96533a'}}});
  assert.equal(await batch.autoInclude(item),true);let review=await store.read('review.json');assert.equal(review.origin,'gemini-auto');assert.equal(review.humanVerified,false);
  const pixels=Buffer.alloc(32*32*4,128);for(let i=3;i<pixels.length;i+=4)pixels[i]=255;
  const extract=async()=>[{buildingId:testIds[1],faceId:'auto-face',samplingVersion:2,width:32,height:32,maskRuns:[[0,1024]],quality:{accepted:true},image:jpeg.encode({data:pixels,width:32,height:32},100).data.toString('base64')}];
  const training=new ReviewedTraining(files,batch,'http://fixture',{manualRoot:manual.root,extract});await training.run();let model=await files.read('review-model.json');
  assert.ok(model.samples.some(s=>s.buildingId===testIds[1]));assert.ok(!model.samples.some(s=>s.buildingId===testIds[0]));
  const state=await files.read('review-training.json');assert.equal(state.automaticTrainingBuildings,1);assert.equal(state.evaluation.newReviewHoldout,null);
  await batch.saveReview(item.id,{revision:review.revision,status:'excluded'});assert.equal(await batch.autoInclude(item),false);
  await training.run();model=await files.read('review-model.json');assert.ok(!model.samples.some(s=>s.buildingId===testIds[1]));
  review=await store.read('review.json');assert.equal(review.status,'excluded');assert.equal(review.origin,'gemini-auto');assert.equal(review.history.length,2);
  await batch.saveReview(item.id,{revision:review.revision,status:'accepted'});assert.equal((await store.read('review.json')).origin,'gemini-auto');await training.run();assert.ok((await files.read('review-model.json')).samples.some(s=>s.buildingId===testIds[1]));
  let emptyExtractions=0;training.extract=async()=>{emptyExtractions++;return [];};await store.write('input.json',{fixture:2});await training.run();await training.run();assert.equal(emptyExtractions,1);assert.equal((await files.read('review-training.json')).excluded.length,1);assert.ok(!(await files.read('review-model.json')).samples.some(s=>s.buildingId===testIds[1]));await store.write('input.json',{fixture:3});await training.run();assert.equal(emptyExtractions,2);
 }finally{if(!root.startsWith(join(tmpdir(),'auto-color-direct-')))throw Error('Unsafe root');await rm(root,{recursive:true,force:true});}
});

test('Reviewed training uses real masks, excludes mixed/skipped houses and honors undo',async()=>{
 const root=await mkdtemp(join(tmpdir(),'auto-color-training-'));try{
  const manual=new Store(join(root,'manual')),files=new Store(join(root,'auto'));await manual.init();await files.init();
  const candidates=Array.from({length:200},(_,i)=>String(i)),trainIds=candidates.filter(id=>split(id)==='train'),testIds=candidates.filter(id=>split(id)==='test');
  for(const [i,id]of [...trainIds.slice(0,3),testIds[0]].entries())await manual.write(`task-${i}.json`,{id:String(i),status:'approved',revision:1,address:{id:'fixture'},faces:[{faceId:'face-'+id,buildingId:id,feature:Array(9).fill(.5)}],labels:[{faceId:'face-'+id,visibility:'known',hex:'#808080'}],history:[{at:'2026-01-01'}]});
  await manual.write('model.json',{samples:trainIds.slice(0,3).map(buildingId=>({buildingId,feature:Array(9).fill(.5),hex:'#808080'}))});const original=await readFile(join(root,'manual/model.json'));
  const items=Array.from({length:4},()=>({id:randomUUID(),status:'done'})),batch=new ReviewBatch(files),buildingIds=[trainIds[3],testIds[1],trainIds[4],trainIds[5]];
  await files.write('review-list.json',{target:4,items});
  for(const [i,item]of items.entries()){const store=batch.house(item.id);await store.init();await store.write('input.json',{fixture:item.id});await store.write('pilot.json',{buildingId:buildingIds[i],inputFile:'input.json',teacher:{result:{uniformFacade:i!==2}}});await store.write('review.json',{status:i===3?'skipped':'accepted',scope:i===2?'visible-facade-material':'whole-house',revision:1,hex:'#96533a'});}
  let extractionCount=0;const pixels=Buffer.alloc(32*32*4);for(let i=0;i<pixels.length;i+=4){pixels[i]=150;pixels[i+1]=83;pixels[i+2]=58;pixels[i+3]=255;}
  const extract=async(_origin,{houseId})=>{extractionCount++;const i=items.findIndex(t=>t.id===houseId);return [{buildingId:buildingIds[i],faceId:'review-face',samplingVersion:2,width:32,height:32,maskRuns:[[0,1024]],quality:{accepted:true},image:jpeg.encode({data:pixels,width:32,height:32},100).data.toString('base64')}];};
  const training=new ReviewedTraining(files,batch,'http://fixture',{manualRoot:manual.root,extract});await training.run();
  let model=await files.read('review-model.json'),state=await files.read('review-training.json');assert.equal(state.status,'trained');assert.equal(state.addedTrainingBuildings,1);assert.equal(state.reviewTestBuildings,1);assert.equal(state.excluded.length,1);assert.equal(extractionCount,2);assert.ok(model.samples.some(s=>s.buildingId===trainIds[3]));assert.ok(!model.samples.some(s=>s.buildingId===testIds[1]));assert.equal(state.evaluation.candidate.houses,1);
  await batch.house(items[0].id).write('review.json',{status:'pending',revision:2});await training.run();model=await files.read('review-model.json');assert.ok(!model.samples.some(s=>s.buildingId===trainIds[3]));assert.equal(extractionCount,2);assert.deepEqual(await readFile(join(root,'manual/model.json')),original);
 }finally{if(!root.startsWith(join(tmpdir(),'auto-color-training-')))throw Error('Unsafe root');await rm(root,{recursive:true,force:true});}
});

test('Paced recovery only requeues transient failures once and preserves exclusions',async()=>{
 const root=await mkdtemp(join(tmpdir(),'auto-color-recover-'));try{
  const files=new Store(root);await files.init();const batch=new ReviewBatch(files),items=Array.from({length:4},()=>({id:randomUUID(),autoTrain:true,status:'failed',attempts:3}));await files.write('review-list.json',{target:430,items});
  for(const [i,item]of items.entries()){const store=batch.house(item.id);await store.init();await store.write('pilot.json',{error:i===2?'Ingen tydelige facadefotos':'Gemini svarede 503. Der gentages ikke automatisk.',...(i===3?{teacher:{result:{}}}:{})});if(i===1)await store.write('review.json',{status:'excluded',revision:1});}
  assert.deepEqual(await batch.recoverFailed(),{scheduled:1});assert.deepEqual(await batch.recoverFailed(),{scheduled:0});const saved=await batch.init();assert.equal(saved.items[0].attempts,3);assert.equal(saved.items[0].recoveryAttemptLimit,4);assert.equal(saved.items[0].status,'queued');assert.equal(saved.items[1].status,'failed');assert.equal((await batch.house(items[1].id).read('review.json')).status,'excluded');
 }finally{if(!root.startsWith(join(tmpdir(),'auto-color-recover-')))throw Error('Unsafe root');await rm(root,{recursive:true,force:true});}
});
