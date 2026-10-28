import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTrainingOverview} from './overview.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from './store.mjs';
import {ReviewBatch} from './review.mjs';
const accepted=(id,extra={})=>({id,buildingId:id,status:'done',trainingEligibility:{wholeHouse:true,calibrated:true,visible:true},review:{status:'accepted',revision:1,at:'2026-10-22T08:00:00Z'},...extra});
test('Training total uses distinct buildings in the completed model, not accepted labels, samples or reported counts',()=>{
 const model={version:'2026-10-22T09:00:00Z',trainingBuildings:999,samples:[{buildingId:'manual-a'},{buildingId:'manual-a'},{buildingId:'manual-b'},{buildingId:'trained'},{buildingId:'changed'}],includedReviews:[{id:'trained',buildingId:'trained',revision:1,split:'train'},{id:'changed',buildingId:'changed',revision:1,split:'train'},{id:'test',buildingId:'test',revision:1,split:'test'}],trainingExclusions:[{id:'pixels',revision:1,reason:'No pixels'}]};
 const items=[accepted('trained'),accepted('changed',{review:{status:'accepted',revision:2}}),accepted('test'),accepted('mixed',{trainingEligibility:{wholeHouse:false,calibrated:true}}),accepted('pixels'),{id:'queued',status:'queued'},{id:'stale-running',status:'running'},{id:'active',status:'running'},{id:'failed',status:'failed',error:'503'},{id:'removed',review:{status:'excluded'}}];
 const o=buildTrainingOverview({model,items,activeHouseIds:['active'],busy:true});assert.equal(o.model.trainingHouses,4);assert.equal(o.acceptedLabels,5);assert.equal(o.waitingTrainingHouses,1);assert.equal(o.counts.inModel,1);assert.equal(o.counts.heldOut,1);assert.equal(o.counts.notUsable,2);assert.equal(o.counts.waitingAnalysis,2);assert.equal(o.counts.analysing,1);assert.equal(o.activity.activeHouses,1);assert.equal(Object.values(o.counts).reduce((a,n)=>a+n,0),items.length);assert.equal(o.houseStates.changed.trainingState,'waitingTraining');
});
test('Last completed model and its exclusions remain visible while a new model is sampling',()=>{
 const model={version:'old-completed',samples:[{buildingId:'manual'}],trainingExclusions:[{id:'pixels',revision:1,reason:'No usable facade pixels'}]};
 const result=buildTrainingOverview({model,items:[accepted('pixels')],training:{status:'sampling',busy:true,completed:2,total:730,excluded:[]}});assert.equal(result.model.trainingHouses,1);assert.equal(result.counts.notUsable,1);assert.equal(result.waitingTrainingHouses,0);assert.equal(result.activity.trainingBusy,true);
});
test('Legacy completed report keeps failed pixel checks stable during sampling without hiding newer revisions',()=>{
 const completedTraining={status:'trained',modelVersion:'old',startedAt:'2026-10-22T08:30:00Z',excluded:[{id:'pixels',reason:'No pixels'},{id:'changed',reason:'Previous failure'}]};
 const o=buildTrainingOverview({model:{version:'old',samples:[{buildingId:'manual'}]},completedTraining,training:{status:'sampling',busy:true,startedAt:'2026-10-22T10:00:00Z',excluded:[]},items:[accepted('pixels'),accepted('changed',{review:{status:'accepted',revision:2,at:'2026-10-22T09:00:00Z'}})]});assert.equal(o.model.trainingHouses,1);assert.equal(o.counts.notUsable,1);assert.equal(o.waitingTrainingHouses,1);
});
test('An exclusion for an old label revision cannot hide a newly changed label from the training queue',()=>{
 const model={version:'old',samples:[],trainingExclusions:[{id:'house',revision:1,reason:'Old failure'}]};
 const o=buildTrainingOverview({model,items:[accepted('house',{review:{status:'accepted',revision:2}})]});assert.equal(o.waitingTrainingHouses,1);assert.equal(o.counts.notUsable,0);
});
test('Legacy exclusions only apply to reviews that predate the matching completed training run',()=>{
 const training={status:'trained',modelVersion:'version',startedAt:'2026-10-22T09:00:00Z',excluded:[{id:'early',reason:'No facade pixels'},{id:'changed',reason:'Old failure'}]};
 const o=buildTrainingOverview({model:{version:'version',samples:[]},training,items:[accepted('early'),accepted('changed',{review:{status:'accepted',revision:2,at:'2026-10-22T09:01:00Z'}})]});assert.equal(o.counts.notUsable,1);assert.equal(o.waitingTrainingHouses,1);
});
test('User removal is tracked as pending removal until a new completed model replaces the snapshot',()=>{
 const model={version:'old',samples:[{buildingId:'house'}],includedReviews:[{id:'house',buildingId:'house',revision:1,split:'train'}]};
 const o=buildTrainingOverview({model,items:[{id:'house',review:{status:'excluded',revision:2}}]});assert.equal(o.model.trainingHouses,1);assert.equal(o.counts.removed,1);assert.equal(o.model.pendingRemoval,1);
});
test('Full-gallery rechecks and provider cooldown remain visible even when accepted count does not change',()=>{
 const items=[accepted('done',{multilabel:true,appearance:{exteriorVersion:'all-exterior-v2'}}),accepted('more-photos',{multilabel:true,exteriorStatus:'running'})],queue={phase:'cooldown',nextAttemptAt:'2026-10-22T10:00:00Z',error:{httpStatus:503}};
 const o=buildTrainingOverview({items,queue,busy:true,activeHouseIds:['more-photos']});assert.equal(o.acceptedLabels,2);assert.equal(o.exterior.completed,1);assert.equal(o.exterior.remaining,1);assert.equal(o.activity.queue.error.httpStatus,503);assert.equal(o.activity.activeHouses,1);
});
test('Restart resumes an interrupted exterior attempt and reports real activity without consuming another house attempt',async()=>{
 const root=await mkdtemp(join(tmpdir(),'overview-resume-'));try{
  const files=new Store(root);await files.init();const batch=new ReviewBatch(files),id=randomUUID();await files.write('review-list.json',{target:730,items:[{id,multilabel:true,status:'done',exteriorStatus:'running',exteriorAttempts:2}]});
  const store=batch.house(id);await store.init();await store.write('pilot.json',{teacher:{result:{}},appearance:{}});batch.prepare=async()=>batch.init();let calls=0;
  batch.enrich=async()=>{calls++;assert.equal(batch.active.has(id),true);const task={teacher:{result:{}},appearance:{exteriorVersion:'all-exterior-v2'}};await store.write('pilot.json',task);return task;};await batch.run();
  const entry=(await batch.init()).items[0];assert.equal(entry.exteriorAttempts,2);assert.equal(entry.exteriorStatus,'completed');assert.equal(calls,1);assert.equal(batch.active.size,0);assert.equal(batch.busy,false);
 }finally{await rm(root,{recursive:true,force:true});}
});
