import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from './store.mjs';
import {adaptiveImageChecks,adaptiveAppearance} from './adaptive-images.mjs';
import {GeminiRequestError,GeminiQueue} from './gemini-queue.mjs';
import {askTeacher,estimatedCost} from './teacher.mjs';
import {ReviewBatch} from './review.mjs';
import {randomUUID} from 'node:crypto';
const image='data:image/jpeg;base64,AA==';
const aerial=['east','west','north','south','nadir'].map((direction,i)=>({id:`oblique-${direction}-${i}`,direction,image:image+i}));
const sales=Array.from({length:5},(_,i)=>({id:`sale-${i}`,sha256:String(i),image,audit:{facadeAccepted:i<2}}));
async function fixture(fn){const root=await mkdtemp(join(tmpdir(),'adaptive-images-'));try{const files=new Store(root);await files.init();await fn(files);}finally{await rm(root,{recursive:true,force:true});}}
test('Full-resolution audit starts small and retains every exterior image without a large probe',async()=>fixture(async files=>{
 const calls=[];const call=async(images,views,options)=>{calls.push({ids:images.map(p=>p.id),views:views.length,attempts:options.maxAttempts});if(images.length+views.length>4)throw new GeminiRequestError(503,'high demand');return {model:'synthetic',result:{checks:images.map(p=>({id:p.id,kind:'exterior'}))}};};
 const answer=await adaptiveImageChecks(files,sales,aerial,{kind:'audit',call});assert.equal(calls.length,3);assert.equal(answer.capacitySplit,true);assert.deepEqual(answer.result.checks.map(p=>p.id),sales.map(p=>p.id));assert.ok(calls.every(c=>c.ids.length+c.views<=4));const before=calls.length;await adaptiveImageChecks(files,sales,aerial,{kind:'audit',call});assert.equal(calls.length,before);
}));
test('Adaptive appearance processes ALL sale and aerial photos, including roof-only views and nadir',async()=>fixture(async files=>{
 const seen=new Set(),calls=[];const labeler=async(images,views,options)=>{calls.push({count:images.length+views.length,attempts:options.maxAttempts});if(images.length+views.length>4)throw new GeminiRequestError(503,'high demand');images.concat(views).forEach(p=>seen.add(p.id));assert.ok(images.some(p=>p.audit.facadeAccepted));assert.ok(views.filter(p=>p.direction!=='nadir').length>=2);return {model:'synthetic',result:{facadeHex:'#96533a'}};};
 const answers=await adaptiveAppearance(files,sales,aerial,{labeler});assert.ok(calls.every(c=>c.count<=4));assert.deepEqual([...seen].sort(),sales.concat(aerial).map(p=>p.id).sort());assert.equal(answers.length,sales.length+3);
}));

test('Gallery classification uses six thumbnails per call and caches every packet',async()=>fixture(async files=>{
 const images=Array.from({length:25},(_,i)=>({id:`sale-${i}`,image:image+i})),sizes=[];
 const call=async batch=>{sizes.push(batch.length);return {result:{checks:batch.map(p=>({id:p.id}))}};};
 const answer=await adaptiveImageChecks(files,images,[],{kind:'selection',call});
 assert.deepEqual(sizes,[6,6,6,6,1]);assert.deepEqual(answer.result.checks.map(p=>p.id),images.map(p=>p.id));
 await adaptiveImageChecks(files,images,[],{kind:'selection',call});assert.equal(sizes.length,5);
}));
test('Authentication, billing and quota failures never cause extra split requests',async()=>fixture(async files=>{
 for(const status of [400,401,402,403,429]){let calls=0;await assert.rejects(adaptiveAppearance(files,sales,aerial,{labeler:async()=>{calls++;throw new GeminiRequestError(status,'blocked');}}));assert.equal(calls,1);}
}));
test('A splittable request gets one attempt but keeps cooldown and normal limits for subsequent calls',async()=>{
 let now=0,calls=0;const q=new GeminiQueue({now:()=>now,sleep:async n=>now+=n,random:()=>0});await assert.rejects(q.run(async()=>{calls++;throw new GeminiRequestError(503,'busy');},{},{maxAttempts:1}));assert.equal(calls,1);assert.equal(q.state.nextAttemptAt,new Date(1000).toISOString());await q.run(async()=>{calls++;});assert.equal(calls,2);assert.equal(now,1000);
});
test('Diagnostic model choice keeps actual model provenance, valid generation parameters and model-specific cost',async()=>{
 let body,url;const answer=await askTeacher('fixture',[],{type:'OBJECT'},{model:'gemini-3.8-flash',key:'synthetic',fetcher:async(u,o)=>{url=u;body=JSON.parse(o.body);return new Response(JSON.stringify({usageMetadata:{promptTokenCount:100},candidates:[{finishReason:'STOP',content:{parts:[{text:'{}'}]}}]}));}});assert.match(url,/gemini-3\.8-flash/);assert.equal(answer.model,'gemini-3.8-flash');assert.equal(body.generationConfig.temperature,undefined);assert.equal(estimatedCost({promptTokenCount:1000000},'gemini-3.1-flash-lite'),.25);
});
test('Old capacity failures receive exactly one recovery attempt; exclusions and new-policy failures are preserved',async()=>fixture(async files=>{
 const batch=new ReviewBatch(files),items=Array.from({length:4},(_,i)=>({id:randomUUID(),multilabel:true,autoTrain:true,status:'done',exteriorStatus:'failed',exteriorAttempts:2,exteriorError:'Gemini 503: high demand',...(i===3?{capacityPolicy:'small-packets-v1'}:{})}));await files.write('review-list.json',{target:730,items});
 for(const [i,item]of items.entries()){const store=batch.house(item.id);await store.init();await store.write('pilot.json',{teacher:{result:{}}});if(i===1)await store.write('review.json',{status:'excluded'});if(i===2)await store.write('review.json',{status:'pending'});}
 assert.deepEqual(await batch.recoverSmallPackets(),{scheduled:1});assert.deepEqual(await batch.recoverSmallPackets(),{scheduled:0});const saved=await batch.init();assert.equal(saved.items[0].exteriorAttemptLimit,3);assert.equal(saved.items[0].exteriorStatus,'queued');assert.equal(saved.items[1].exteriorStatus,'failed');assert.equal(saved.items[2].exteriorStatus,'failed');assert.equal(saved.items[3].exteriorStatus,'failed');
}));
