import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from './store.mjs';
import jpeg from 'jpeg-js';
import {split,train,predict,features,facadeFeatures,InsufficientFacadePixelsError} from './model.mjs';
import {conservativeInterior,runsFor,maskFromRuns,assessMask} from './sampling.mjs';
import {analyzeTaskPatches} from './analysis.mjs';
import {polygonMask} from './polygon.mjs';
import {photoKey} from './sampling.mjs';
import {targetRegion,semanticAnalysis} from './semantic.mjs';
import {buildingGroups,compareRows} from './evaluate-semantic.mjs';
import {readParts,saveParts,exportParts} from './parts-store.mjs';
import {houseProposal,nextPartsId,partsStatus} from './house-proposal.mjs';
import {houseAICandidate,houseAIInput} from './house-ai.mjs';
import {trainingDataset,housePartition,HouseTraining} from './house-training.mjs';

test('house training rejects concurrent jobs and releases a failed preparation without replacing the active model',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'house-learning-lock-')),store=new Store(dir),root=join(dir,'learning'),files=new Store(root);await files.init();
  try{
    const active={version:'previous-model'};await files.write('active.json',active);
    await files.write('train-lock.json',{ownerPid:process.pid,version:'running-elsewhere',status:'running'});
    const trainer=new HouseTraining(store,{root});
    await assert.rejects(trainer.start(),/anden lokal proces/);assert.equal((await files.read('train-lock.json')).version,'running-elsewhere');
    assert.equal((await trainer.status()).job.status,'running');
    await files.write('train-lock.json',{ownerPid:2147483647,version:'stale'});
    await assert.rejects(trainer.start(),/træningshuse/);
    assert.equal(await files.read('train-lock.json'),null);assert.deepEqual(await files.read('active.json'),active);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('house learning isolates physical buildings, preserves unknown pixels and pins confirmed revisions',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'house-learning-data-')),store=new Store(dir);
  try{
    const photo={direction:'nadir',capturedAt:'2026-01-01',image:'data:image/jpeg;base64,'+patch('photo',32,32).image,camera:{crop:[0,0,32,32]}},key=photoKey(photo);
    const ids=['01010101-0101-4101-8101-010101010101','02020202-0202-4202-8202-020202020202'];
    for(const [i,id] of ids.entries()){
      await store.write(`task-${id}.json`,{id,config:{geometry:{buildings:[{id:'same-house',main:true},{id:'linked-'+i,main:true}]},photos:{photos:[photo]}}});
      await store.write(`parts-${id}.json`,{taskId:id,status:'reviewed',revision:i+1,objects:[{id:'main',category:'main-house',includeInModel:true}],regions:[{objectId:'main',photoKey:key,points:[[.1,.1],[.9,.1],[.9,.9],[.1,.9]]}],sources:[],completePhotos:[]});
    }
    assert.equal((await trainingDataset(store)).examples.length,0,'Unknown exterior is never silently treated as negative');
    const confirmed=await trainingDataset(store,{confirmation:{tasks:ids.map((id,i)=>({id,revision:i+1}))}});
    assert.equal(confirmed.examples.length,1,'Duplicate house/photo counted once');assert.equal(confirmed.examples[0].revision,2);assert.equal(confirmed.examples[0].mainComplete,true);
    assert.equal(confirmed.examples[0].split,housePartition(confirmed.examples[0].group));
    const stale=await trainingDataset(store,{confirmation:{tasks:[{id:ids[0],revision:99}]}});assert.equal(stale.examples.length,0);
    const parts=await store.read(`parts-${ids[0]}.json`);parts.objects.push({id:'terrace',category:'terrace',includeInModel:false});parts.regions.push({objectId:'terrace',photoKey:key,points:[[0,0],[.1,0],[.1,.1],[0,.1]]});await store.write(`parts-${ids[0]}.json`,parts);
    const partial=await trainingDataset(store);assert.equal(partial.examples.length,1);assert.equal(partial.examples[0].mainComplete,false);assert.equal(partial.examples[0].regions.length,2);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('active learned model changes inference/cache and earlier image-pinned proposals remain approvable',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'house-learning-active-')),cacheRoot=join(dir,'cache'),files=new Store(dir);
  try{
    const photo={direction:'nadir',capturedAt:'2026-01-01',image:'data:image/jpeg;base64,'+patch('photo',100,100).image,camera:{center:[0,0,100],rotation:[1,0,0,0,1,0,0,0,1],principal:[50,50],focal:[100,100],crop:[0,0,100,100]}};
    const task={id:'33333333-3333-4333-8333-333333333333',config:{geometry:{buildings:[{id:'main',main:true,height:3,rings:[[[-20,-20],[20,-20],[20,20],[-20,20]]]}]},heights:null,photos:{photos:[photo]}}},key=photoKey(photo),seen=[];
    const worker={infer:async photos=>{seen.push(photos[0]);return {views:[{photoKey:key,width:100,height:100,seconds:1,regions:[{category:'main-house',points:[[.2,.2],[.8,.2],[.8,.8],[.2,.8]],score:.8,maskQuality:.9,pixels:3600,label:'house'}]}]};}};
    const original=await houseAICandidate(task,key,worker,{cacheRoot,learningRoot:dir});
    const {writeFile}=await import('node:fs/promises'),{createHash}=await import('node:crypto');const weightsFile=join(dir,'weights.safetensors');await writeFile(weightsFile,'synthetic weights for fake worker');const sha256=createHash('sha256').update('synthetic weights for fake worker').digest('hex');
    await files.write('active.json',{version:'version-one',weightsFile,sha256,method:'sam2-residual-head-v1'});
    const learned=await houseAICandidate(task,key,worker,{cacheRoot,learningRoot:dir});assert.notEqual(learned.signature,original.signature);assert.equal(seen[1].adapterVersion,'version-one');assert.equal(learned.learning.version,'version-one');
    const {readHouseAICandidate}=await import('./house-ai.mjs');assert.equal((await readHouseAICandidate(task,key,original.signature,{cacheRoot})).signature,original.signature);assert.equal((await readHouseAICandidate(task,key,learned.signature,{cacheRoot})).signature,learned.signature);
    await files.write('active.json',{version:'corrupt',weightsFile,sha256:'bad'});await assert.rejects(houseAICandidate(task,key,worker,{cacheRoot,learningRoot:dir}),/kontrolsum/);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('frozen house AI previews are cached independently and only explicit reviewed saves become labels',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'house-ai-test-')),store=new Store(dir),cacheRoot=join(dir,'ai-cache'),id='43214321-4321-4321-8321-432143214321';
  try{
    const photo={direction:'nadir',capturedAt:'2026-01-01',image:'data:image/jpeg;base64,'+patch('photo',100,100).image,camera:{center:[0,0,100],rotation:[1,0,0,0,1,0,0,0,1],principal:[50,50],focal:[100,100],crop:[0,0,100,100]}};
    const task={id,address:{text:'Synthetic'},revision:3,status:'approved',labels:[],faces:[],history:[],config:{geometry:{buildings:[{id:'main',main:true,height:3,rings:[[[-20,-20],[20,-20],[20,20],[-20,20]]]}]},photos:{photos:[photo]},heights:null}};
    await store.write(`task-${id}.json`,task);const key=photoKey(photo);let calls=0;
    const worker={infer:async()=>{calls++;return {views:[{photoKey:key,width:100,height:100,seconds:1,detections:2,regions:[{category:'main-house',points:[[.3,.3],[.7,.3],[.7,.7],[.3,.7]],score:.7,maskQuality:.9,label:'house',pixels:1600},{category:'terrace',points:[[.1,.1],[.2,.1],[.2,.2],[.1,.2]],score:.4,maskQuality:.9,label:'patio',pixels:100}]}]};}};
    const proposal=await houseAICandidate(task,key,worker,{cacheRoot,learningRoot:dir});assert.equal(proposal.objects.length,2);assert.equal((await readParts(store,id)).revision,0);
    assert.equal((await houseAICandidate(task,key,worker,{cacheRoot,learningRoot:dir})).cached,true);assert.equal(calls,1);
    const input={revision:0,status:'reviewed',objects:proposal.objects,regions:proposal.regions,completePhotos:[],aiProposal:{photoKey:key,signature:proposal.signature}};
    await assert.rejects(saveParts(store,id,{...input,aiProposal:{photoKey:key,signature:'foreign'}},{aiCacheRoot:cacheRoot}),/ændret/);
    const accepted=await saveParts(store,id,input,{aiCacheRoot:cacheRoot});assert.equal(accepted.provenance.review,'accepted');assert.equal(accepted.objects[1].includeInModel,false);assert.equal(accepted.provenance.evidence[1].label,'patio');
    const edit=structuredClone(input.regions);edit[0].points[0]=[.31,.31];
    const corrected=await saveParts(store,id,{...input,revision:1,regions:edit},{aiCacheRoot:cacheRoot});assert.equal(corrected.provenance.review,'corrected');
    const changed=structuredClone(task);changed.config.photos.photos[0].camera.crop[0]=1;assert.notEqual(houseAIInput(changed,photoKey(changed.config.photos.photos[0])).signature,proposal.signature);
    assert.deepEqual(await store.read(`task-${id}.json`),task);assert.deepEqual(await readParts(new Store(dir),id),corrected);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('house proposals preserve concavity, reject holes, track corrections and use an independent queue',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'house-proposal-')),store=new Store(dir),id='12345678-1234-4234-8234-123456789012';
  try{
    const photo={direction:'nadir',capturedAt:'2026-01-01',image:'data:image/jpeg;base64,'+patch('photo',100,100).image,camera:{center:[0,0,100],rotation:[1,0,0,0,1,0,0,0,1],principal:[50,50],focal:[100,100],crop:[0,0,100,100]}};
    const task={id,address:{text:'Synthetic'},revision:7,status:'approved',labels:[],faces:[],history:[],config:{geometry:{buildings:[{id:'main',main:true,height:3,rings:[[[-20,-20],[20,-20],[20,0],[0,0],[0,20],[-20,20],[-20,-20]]]}]},heights:null,photos:{photos:[photo]}}};
    await store.write(`task-${id}.json`,task);
    const proposal=houseProposal(task);assert.equal(proposal.regions.length,1);assert.equal(proposal.regions[0].points.length,6,'Keep concave roof outline');
    assert.equal((await readParts(store,id)).revision,0);
    const input={revision:0,status:'reviewed',objects:proposal.objects,regions:proposal.regions,completePhotos:[],proposalSignature:proposal.signature};
    await assert.rejects(saveParts(store,id,{...input,proposalSignature:'bad'}),/ændret/);
    const accepted=await saveParts(store,id,input);assert.equal(accepted.provenance.review,'accepted');
    const edited=structuredClone(input.regions);edited[0].points.pop();
    const corrected=await saveParts(store,id,{...input,revision:1,regions:edited});assert.equal(corrected.provenance.review,'corrected');
    const state=await partsStatus(store,readParts);assert.equal(state.reviewed,1);assert.equal(nextPartsId(state.history),null);
    assert.equal(nextPartsId([{id:'a',status:'reviewed'},{id:'b',status:'draft'},{id:'c',status:'skipped'}],'a'),'b');
    assert.deepEqual(await store.read(`task-${id}.json`),task);
    task.config.geometry.buildings[0].rings.push([[0,0],[1,0],[1,1]]);assert.equal(houseProposal(task).regions.length,0,'No automatic fill over courtyards');
    const skipped=await saveParts(store,id,{...input,proposalSignature:undefined,revision:2,status:'skipped',objects:[],regions:[]});assert.equal(skipped.status,'skipped');assert.equal((await exportParts(store)).rows.length,0);
  }finally{await rm(dir,{recursive:true,force:true});}
});

function patch(faceId,width,height,color=128){
  const data=Buffer.alloc(width*height*4,color);
  for(let i=3;i<data.length;i+=4)data[i]=255;
  return {faceId,buildingId:'building',width,height,image:jpeg.encode({data,width,height},100).data.toString('base64')};
}
const rect=(width,x,y,w,h)=>Array.from({length:w*h},(_,i)=>(y+Math.floor(i/w))*width+x+i%w);
const strictPatch=(faceId,width=32,height=32)=>({...patch(faceId,width,height),samplingVersion:2,quality:{accepted:true},maskRuns:[[0,width*height]]});

test('building-part annotations persist independently, link views and export only reviewed labels',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'color-trainer-parts-')),store=new Store(dir),id='88888888-8888-4888-8888-888888888888';
  try{
    const photo={direction:'nadir',capturedAt:'2026-01-01T12:00:00Z',camera:{crop:[0,0,64,64]},image:'data:image/jpeg;base64,'+patch('photo',64,64).image};
    const side={...photo,direction:'south'},task={id,revision:3,status:'approved',labels:[{faceId:'wall',visibility:'known',hex:'#ffffff'}],faces:[{faceId:'wall',buildingId:'building',feature:Array(9).fill(.5)}],history:[{revision:3,at:'2026-01-01T12:00:00Z'}],address:{id:'fixture'},config:{geometry:{buildings:[{id:'building',main:true}]},photos:{photos:[photo,side]}}};
    await store.write(`task-${id}.json`,task);
    const objectId='99999999-9999-4999-8999-999999999999',regionId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',secondRegion='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const input={revision:0,status:'draft',objects:[{id:objectId,category:'main-house',includeInModel:true}],regions:[{id:regionId,objectId,photoKey:photoKey(photo),points:[[.1,.1],[.8,.1],[.8,.8],[.1,.8]]},{id:secondRegion,objectId,photoKey:photoKey(side),points:[[.2,.2],[.7,.2],[.7,.7],[.2,.7]]}],completePhotos:[]};
    assert.equal((await readParts(store,id)).revision,0);
    const draft=await saveParts(store,id,input);assert.equal(draft.revision,1);
    assert.equal(draft.regions[0].objectId,draft.regions[1].objectId);assert.equal((await exportParts(store)).rows.length,0);
    assert.deepEqual(await store.read(`task-${id}.json`),task);
    assert.equal((await store.rows())[0].hex,'#ffffff');
    await assert.rejects(saveParts(store,id,input),/ændret/);
    await assert.rejects(saveParts(store,id,{...input,revision:1,regions:[{...input.regions[0],photoKey:'foreign'}]}),/originalfoto/);
    const reviewed=await saveParts(store,id,{...input,revision:1,status:'reviewed',completePhotos:[photoKey(photo)]});
    const reload=await readParts(new Store(dir),id);assert.deepEqual(reload,reviewed);assert.equal(reload.history.length,2);
    assert.ok(reload.sources.every(s=>/^[a-f0-9]{64}$/.test(s.imageSha256)));
    const exported=await exportParts(store);assert.equal(exported.rows.length,1);assert.equal(exported.rows[0].regions.length,2);assert.deepEqual(exported.rows[0].completePhotos,[photoKey(photo)]);
    assert.match(exported.unmarkedPixels,/unknown/);
    assert.deepEqual(await store.read(`task-${id}.json`),task);
    await assert.rejects(saveParts(store,id,{...input,revision:2,status:'reviewed',objects:[{id:objectId,category:'garage-carport',includeInModel:false}]}),/hovedbygning/);
    assert.equal((await readParts(store,id)).revision,2);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('semantic target uses the whole building projection rather than existing wall masks',()=>{
  const task={config:{geometry:{buildings:[{id:'house',main:true,height:10,rings:[[[-5,-5],[5,-5],[5,5],[-5,5]]]}]},heights:null}};
  const photo={camera:{center:[0,0,100],rotation:[1,0,0,0,1,0,0,0,1],principal:[50,50],focal:[100,100],crop:[0,0,100,100]}};
  assert.deepEqual(targetRegion(task,photo,100,100),[40,40,60,60]);
  assert.throws(()=>targetRegion(task,{camera:{...photo.camera,center:[0,0,-100]}},100,100),/placeres/);
});
test('comparison groups connected buildings and reports missing semantic coverage honestly',()=>{
  const task=(id,ids)=>({id,config:{geometry:{buildings:ids.map(id=>({id,main:true}))}}});
  const groups=buildingGroups([task('a',['A','B']),task('b',['B','C']),task('c',['D'])]);
  assert.equal(groups.get('a'),groups.get('b'));assert.notEqual(groups.get('a'),groups.get('c'));
  const f=Array(9).fill(.5),r=compareRows([{group:'A',split:'train',baseline:f,semantic:f,hex:'#808080'},{group:'B',split:'test',baseline:f,semantic:null,hex:'#808080'}]);
  assert.equal(r.semanticCoverage,0);assert.equal(r.pairedTestHouses,0);assert.equal(r.semanticRgbMAE,null);
});
test('semantic samples exclude background, preserve provenance and require explicit draft save',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'color-trainer-semantic-')),store=new Store(dir),id='77777777-7777-4777-8777-777777777777';
  try{
    const photo={direction:'south',capturedAt:'2026-01-01T12:00:00Z',camera:{crop:[0,0,32,32]},image:'data:image/jpeg;base64,'+patch('photo',32,32).image};
    const task={id,revision:0,status:'draft',history:[],labels:[],faces:[{faceId:'original',buildingId:'building',feature:Array(9).fill(.2)}],address:{id:'fixture'},config:{geometry:{buildings:[{id:'building',main:true}]},photos:{photos:[photo]}}};
    const candidate={model:'fixture',revision:'pinned',signature:'a'.repeat(64),views:[{photoKey:photoKey(photo),width:32,height:32,feature:Array(9).fill(.5),maskRuns:[[0,1024]]}]};
    const analysis=semanticAnalysis(task,candidate,null);
    assert.equal(analysis.faces.length,1);assert.equal(analysis.semanticSampling.signature,candidate.signature);
    assert.equal(analysis.faces[0].patches[0].selectionMethod,'whole-house-clipseg-v2');
    await store.write(`task-${id}.json`,task);
    await assert.rejects(store.save(id,0,[],'approved',{visibility:'known',hex:'#ffffff'},undefined,analysis),/kladde/);
    assert.deepEqual(await store.read(`task-${id}.json`),task);
    const saved=await store.save(id,0,[],'draft',{visibility:'known',hex:'#ffffff'},undefined,analysis);
    assert.deepEqual(saved.automaticAnalysis.faces,task.faces);assert.equal(saved.semanticSampling.model,'fixture');
    assert.equal((await store.rows()).length,0);
    await store.save(id,1,[],'approved',{visibility:'known',hex:'#ffffff'});
    assert.equal((await store.rows())[0].selectionMethod,'whole-house-clipseg-v2');
    const reset=await store.save(id,2,[],'draft',{visibility:'known',hex:'#ffffff'},[]);
    assert.deepEqual(reset.faces,task.faces);assert.equal(reset.semanticSampling,null);
    assert.throws(()=>semanticAnalysis(task,{...candidate,views:[]},null),/ingen sikre/);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('normalized polygon rasterization stays inside the selected region and rejects crossing edges',()=>{
  const mask=polygonMask([[.25,.25],[.75,.25],[.75,.75],[.25,.75]],32,32);
  assert.deepEqual(mask.contextCrop,[8,8,24,24]);assert.equal(mask.indices.length,256);
  assert.throws(()=>polygonMask([[0,0],[1,1],[0,1],[1,0]],32,32),/krydse/);
  assert.throws(()=>polygonMask([[-.1,0],[1,0],[1,1]],32,32),/punkter/);
  assert.throws(()=>polygonMask([[0,0],[1,0]],32,32),/punkter/);
});

test('manual polygons persist as draft, replace automatic samples only after explicit save, and can be reset',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'color-trainer-polygons-')),store=new Store(dir),id='66666666-6666-4666-8666-666666666666';
  try{
    const photo={direction:'south',capturedAt:'2026-01-01T12:00:00Z',camera:{crop:[0,0,64,64]},image:'data:image/jpeg;base64,'+patch('photo',64,64).image};
    const faces=[{faceId:'automatic',buildingId:'building',feature:Array(9).fill(.8),prediction:'#123456',patches:[patch('automatic',32,32)]}];
    const task={id,revision:1,status:'approved',history:[{revision:1,at:'2026-01-01T12:00:00Z',labels:[{faceId:'automatic',visibility:'known',hex:'#abcdef'}]}],labels:[{faceId:'automatic',visibility:'known',hex:'#abcdef'}],faces,samplingVersion:2,address:{id:'fixture'},config:{geometry:{buildings:[{id:'building',main:true}]},photos:{photos:[photo]}}};
    await store.write(`task-${id}.json`,task);
    const selections=[{photoKey:photoKey(photo),points:[[.2,.2],[.8,.2],[.8,.8],[.2,.8]]}];
    await assert.rejects(store.save(id,1,[],'draft',{visibility:'known',hex:'#f7f7f4'},[{...selections[0],photoKey:'wrong-photo'}]),/originalfoto/);
    assert.deepEqual(await store.read(`task-${id}.json`),task);
    const saved=await store.save(id,1,[],'draft',{visibility:'known',hex:'#f7f7f4'},selections);
    assert.equal(saved.revision,2);assert.equal(saved.status,'draft');assert.deepEqual(saved.automaticAnalysis.faces,faces);
    assert.deepEqual(saved.analysisHistory[0].faces,faces);assert.equal((await store.rows()).length,0);
    assert.ok(saved.faces.every(f=>f.selectionMethod==='human-polygon'&&f.feature.every(v=>Math.abs(v-128/255)<.02)));
    const reopened=await new Store(dir).read(`task-${id}.json`);assert.deepEqual(reopened.manualSelections,selections);
    assert.deepEqual(reopened.faces[0].patches[0].sampleRuns,saved.faces[0].patches[0].sampleRuns);
    await assert.rejects(store.save(id,1,[],'draft',{visibility:'known',hex:'#ffffff'},[]),/ændret/);
    const approved=await store.save(id,2,[],'approved',{visibility:'known',hex:'#f7f7f4'});
    const rows=await store.rows();assert.equal(rows.length,1);assert.equal(rows[0].selectionMethod,'human-polygon');assert.notEqual(rows[0].faceId,'automatic');
    await assert.rejects(store.save(id,approved.revision,[],'draft',{visibility:'known',hex:'#f7f7f4'},[{...selections[0],points:[[.1,.1],[.11,.1],[.11,.11]]}]),/petit|lille|smalt/);
    assert.deepEqual(await store.read(`task-${id}.json`),approved);
    const reset=await store.save(id,approved.revision,[],'draft',{visibility:'known',hex:'#f7f7f4'},[]);
    assert.deepEqual(reset.faces,faces);assert.deepEqual(reset.manualSelections,[]);assert.equal(reset.analysisHistory.length,2);
    assert.equal(reset.labels[0].faceId,'automatic');assert.equal(reset.history[0].labels[0].hex,'#abcdef');
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('conservative mask erodes edges and rejects slivers and fragmented pixels',()=>{
  const original=rect(60,10,10,40,40),safe=conservativeInterior(original,60,60);
  assert.equal(safe.accepted,true);assert.equal(safe.margin,2);
  assert.equal(safe.indices.length,36*36);
  assert.ok(safe.indices.every(i=>i%60>=12&&i%60<=47&&Math.floor(i/60)>=12&&Math.floor(i/60)<=47));
  assert.equal(conservativeInterior(rect(80,10,10,6,50),80,80).accepted,false);
  assert.equal(conservativeInterior(Array.from({length:200},(_,i)=>(i*13)%3600).sort((a,b)=>a-b),60,60).accepted,false);
  assert.equal(assessMask(rect(32,0,0,8,16),32).accepted,true);
  assert.equal(assessMask(rect(32,0,0,8,15),32).accepted,false);
});
test('exact masks exclude colored background and reject malformed coordinates',()=>{
  const width=32,height=32,data=Buffer.alloc(width*height*4);
  for(let i=0;i<width*height;i++){const wall=i%width>=8&&i%width<24&&Math.floor(i/width)>=8&&Math.floor(i/width)<24;data.set(wall?[128,128,128,255]:[220,40,40,255],i*4);}
  const mask=rect(width,8,8,16,16),p={...strictPatch('wall'),maskRuns:runsFor(mask),image:jpeg.encode({width,height,data},100).data.toString('base64')};
  const f=features([p]);assert.ok(f.every(v=>Math.abs(v-128/255)<.02));
  const analyzed=facadeFeatures([p]);
  assert.ok(analyzed.faces[0].views[0].sampleCount>=32);
  const selected=maskFromRuns(analyzed.faces[0].views[0].sampleRuns,width,height);
  assert.ok([...selected].every((v,i)=>!v||mask.includes(i)));
  assert.throws(()=>maskFromRuns([[1020,8]],32,32),/maske/);
  assert.throws(()=>features([{...p,width:31}]),/størrelse/);
});
test('weak views cannot pool their pixels to pass; a good view survives separately',()=>{
  const weak={...strictPatch('shared',8,8),viewId:'weak'},good={...strictPatch('shared'),viewId:'good'};
  const result=facadeFeatures([weak,good]);
  assert.equal(result.faces.length,1);assert.deepEqual(result.faces[0].views.map(p=>p.viewId),['good']);
  assert.equal(result.rejectedViews.length,1);
  assert.equal(facadeFeatures([weak,{...weak,viewId:'weak2'}]).faces.length,0);
});
test('analysis persists exact masks and rejects weak views without changing reviewed tasks',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'color-trainer-analysis-')),store=new Store(dir),id='44444444-4444-4444-8444-444444444444';
  try{
    const task={id,revision:0,status:'draft',labels:[],history:[],faces:[{faceId:'legacy'}],address:{id:'fixture'},config:{geometry:{buildings:[{id:'building',main:true}]},photos:{photos:[]}}};
    await store.write(`task-${id}.json`,task);
    const input=[strictPatch('good'),{...strictPatch('bad'),quality:{accepted:false,reason:'For smalt'}}];
    const result=await analyzeTaskPatches(store,id,input);
    assert.equal(result.samplingVersion,2);assert.equal(result.faces.length,1);assert.equal(result.rejectedViews.length,1);
    assert.deepEqual(result.previousAnalysis.faces,task.faces);
    const reopened=await new Store(dir).read(`task-${id}.json`);
    assert.deepEqual(reopened.faces[0].patches[0].sampleRuns,result.faces[0].patches[0].sampleRuns);
    await store.save(id,0,[],'approved',{visibility:'known',hex:'#f7f7f4'});
    const approved=await store.read(`task-${id}.json`);
    assert.equal(approved.labels.length,1);assert.equal(approved.labels[0].faceId,'good');
    assert.deepEqual(await analyzeTaskPatches(store,id,[]),approved);
    const legacy={...task,revision:1,history:[{revision:1,at:'2026-10-21T12:00:00Z'}],status:'approved',labels:[{faceId:'legacy',visibility:'known',hex:'#abcdef'}]};
    await store.write(`task-${id}.json`,legacy);
    assert.deepEqual(await analyzeTaskPatches(store,id,input),legacy);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('facade pixel threshold stays at 20 usable sampled pixels',()=>{
  assert.throws(()=>features([patch('small',4,19)]),InsufficientFacadePixelsError);
  assert.equal(features([patch('enough',4,20)]).length,9);
});
test('sparse or dark facades do not discard valid faces; malformed images still fail',()=>{
  const good=patch('good',16,16),sparse=patch('sparse',4,19),dark=patch('dark',16,16,0);
  const result=facadeFeatures([sparse,good,dark]);
  assert.deepEqual(result.faces.map(f=>f.faceId),['good']);
  assert.deepEqual(result.faces[0].feature,features([good]));
  assert.deepEqual(result.rejectedFaces,['sparse','dark']);
  assert.deepEqual(facadeFeatures([sparse,dark]),{faces:[],rejectedFaces:['sparse','dark'],rejectedViews:[]});
  assert.deepEqual(facadeFeatures([]),{faces:[],rejectedFaces:[],rejectedViews:[]});
  assert.equal(facadeFeatures([patch('shared',4,10),patch('shared',4,10)]).faces.length,1);
  assert.throws(()=>facadeFeatures([good,{...sparse,image:'not-a-jpeg'}]),e=>!(e instanceof InsufficientFacadePixelsError));
});
test('partial analysis approves only retained faces; empty analysis cannot be approved',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'color-trainer-test-')),store=new Store(dir);
  const id='33333333-3333-4333-8333-333333333333';
  try{
    const {faces,rejectedFaces}=facadeFeatures([patch('good',16,16),patch('small',4,19)]);
    const task={id,revision:0,status:'draft',history:[],labels:[],address:{id:'a'},faces:faces.map(f=>({...f,buildingId:'building'})),rejectedFaces};
    await store.write(`task-${id}.json`,task);
    await store.save(id,0,[],'approved',{visibility:'known',hex:'#aabbcc'});
    const reopened=new Store(dir),saved=await reopened.read(`task-${id}.json`);
    assert.deepEqual(saved.labels.map(l=>l.faceId),['good']);
    assert.deepEqual(saved.rejectedFaces,['small']);
    assert.deepEqual((await reopened.rows()).map(r=>r.faceId),['good']);
    await store.write(`task-${id}.json`,{...task,faces:[]});
    await assert.rejects(store.save(id,0,[],'approved',{visibility:'known',hex:'#aabbcc'}),/Vurder/);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('durable review, concurrency, malformed color and unknown exclusion',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'color-trainer-test-')),store=new Store(dir);
  const id='11111111-1111-4111-8111-111111111111';
  try{
    await store.write(`task-${id}.json`,{id,revision:0,status:'draft',history:[],labels:[],address:{id:'a'},faces:[{faceId:'wall',buildingId:'building',feature:Array(9).fill(.5)}]});
    await assert.rejects(store.save(id,0,[{faceId:'wall',hex:'red',visibility:'known'}],'approved'));
    await assert.rejects(store.save(id,0,[],'approved'));
    await store.save(id,0,[{faceId:'wall',hex:'#aabbcc',visibility:'known'}],'approved');
    await assert.rejects(store.save(id,0,[],'draft'),/ændret/);
    const reopened=new Store(dir);assert.equal((await reopened.rows())[0].hex,'#aabbcc');
    await reopened.save(id,1,[{faceId:'wall',visibility:'unknown'}],'approved');
    assert.equal((await reopened.rows()).length,0);
    assert.equal((await reopened.read(`task-${id}.json`)).history.length,2);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('learned mapping and building-disjoint frozen evaluation',()=>{
  const ids=Array.from({length:100},(_,i)=>`synthetic-building-${i}`),training=ids.filter(id=>split(id)==='train').slice(0,3),heldout=ids.find(id=>split(id)==='test');
  const rows=[...training,heldout].map(buildingId=>({buildingId,faceId:'wall',status:'approved',feature:Array(9).fill(.4),hex:'#ddbb99'}));
  const model=train(rows);
  assert.equal(model.trainingBuildings,3);
  assert.equal(model.samples.some(s=>s.buildingId===heldout),false);
  assert.equal(predict(model,Array(9).fill(.4)),'#ddbb99');
  assert.equal(model.evaluation.rgbMAE,0);
  assert.ok(model.evaluation.baselineRgbMAE>0);
  assert.throws(()=>train(rows.slice(0,2)),/tre/);
});

test('one house color covers every facade, persists scope and supports reset',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'color-trainer-test-')),store=new Store(dir);
  const id='22222222-2222-4222-8222-222222222222';
  try{
    await store.write(`task-${id}.json`,{id,revision:0,status:'draft',history:[],labels:[],address:{id:'a'},faces:['north','south','east','west'].map(faceId=>({faceId,buildingId:'building',feature:Array(9).fill(.5)}))});
    await assert.rejects(store.save(id,0,[],'approved',{visibility:'known',hex:'bad'}));
    await store.save(id,0,[],'approved',{visibility:'known',hex:'#ABCDEF'});
    const saved=await new Store(dir).read(`task-${id}.json`);
    assert.equal(saved.houseColor.hex,'#abcdef');
    assert.equal(saved.labels.length,4);
    assert.ok(saved.labels.every(l=>l.hex==='#abcdef'));
    assert.ok((await store.rows()).every(r=>r.annotationScope==='whole-house'));
    await store.save(id,1,[],'draft',null);
    assert.equal((await store.read(`task-${id}.json`)).labels.length,0);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('duplicate building faces use approval time rather than random task filename order',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'color-trainer-test-')),store=new Store(dir);
  try{
    const newer='11111111-1111-4111-8111-111111111111',older='ffffffff-ffff-4fff-8fff-ffffffffffff';
    for(const [id,hex,at] of [[newer,'#abcdef','2026-10-21T10:00:00.000Z'],[older,'#123456','2026-10-20T10:00:00.000Z']]){
      const labels=[{faceId:'wall',visibility:'known',hex}];
      await store.write(`task-${id}.json`,{id,revision:1,status:'approved',history:[{revision:1,at,status:'approved',labels}],labels,address:{id},faces:[{faceId:'wall',buildingId:'shared-building',feature:Array(9).fill(.5)}]});
    }
    const rows=await new Store(dir).rows();
    assert.equal(rows.length,1);
    assert.equal(rows[0].hex,'#abcdef');
    assert.equal(rows[0].taskId,newer);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('trained model and archive survive disk reload with identical predictions and held-out evaluation',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'color-trainer-test-')),store=new Store(dir);
  try{
    const ids=Array.from({length:100},(_,i)=>`reload-building-${i}`);
    const training=ids.filter(id=>split(id)==='train').slice(0,3),heldout=ids.find(id=>split(id)==='test');
    const rows=[...training,heldout].flatMap((buildingId,i)=>['north','south'].map(faceId=>({buildingId,faceId,status:'approved',feature:Array(9).fill(.2+i*.15),hex:['#223344','#778899','#aabbcc','#eeeeee'][i]})));
    const model=train(rows),archive=`model-${model.version.replaceAll(':','-')}.json`;
    await store.write(archive,model);await store.write('model.json',model);
    const reopened=new Store(dir),saved=await reopened.read('model.json');
    assert.deepEqual(saved,model);
    assert.deepEqual(saved,await reopened.read(archive));
    assert.equal(saved.samples.length,6);
    assert.equal(saved.evaluation.testFacades,2);
    assert.ok(saved.samples.every(s=>s.buildingId!==heldout));
    for(const r of rows)assert.equal(predict(saved,r.feature),predict(model,r.feature));
  }finally{await rm(dir,{recursive:true,force:true});}
});
