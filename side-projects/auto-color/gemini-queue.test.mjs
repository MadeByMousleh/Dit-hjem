import test from 'node:test';import assert from 'node:assert/strict';
import {GeminiQueue,GeminiRequestError,retryAfterMs} from './gemini-queue.mjs';
import {askTeacher} from './teacher.mjs';
const clock=()=>{let now=0;return {now:()=>now,sleep:async ms=>{now+=ms;},random:()=>0};};
test('Persistent overload gets four bounded attempts with 1/2/4-second waits and an 8-second final cooldown',async()=>{
 const time=clock(),queue=new GeminiQueue(time),starts=[];
 await assert.rejects(queue.run(async()=>{starts.push(time.now());throw new GeminiRequestError(503,'busy');}));
 assert.deepEqual(starts,[0,1000,3000,7000]);assert.equal(queue.state.nextAttemptAt,new Date(15000).toISOString());
});
test('Legacy overload cooldown migrates once; explicit provider waits survive restarts',()=>{
 const state={phase:'cooldown',updatedAt:new Date(0).toISOString(),error:{httpStatus:503,attempts:3},nextAttemptAt:new Date(120000).toISOString()};
 const queue=new GeminiQueue(clock());queue.restore(state);assert.equal(queue.nextAllowed,4800);assert.equal(queue.state.retryPolicy,'short-v1');
 const provider=new GeminiQueue(clock());provider.restore({...state,error:{...state.error,retryAfter:120000}});assert.equal(provider.nextAllowed,120000);
 const timeout=new GeminiQueue(clock());timeout.restore({...state,error:{httpStatus:null,retryable:true,attempts:2}});assert.equal(timeout.nextAllowed,2400);
});
test('Model switch clears only the old model capacity cooldown, preserving quota and account stops',()=>{
 const state={phase:'cooldown',retryPolicy:'short-v1',error:{httpStatus:503},nextAttemptAt:new Date(60000).toISOString()};
 const switched=new GeminiQueue(clock());switched.restore(state,{model:'gemini-3.8-flash'});assert.equal(switched.nextAllowed,0);
 const same=new GeminiQueue(clock());same.restore({...state,context:{model:'gemini-3.8-flash'}},{model:'gemini-3.8-flash'});assert.equal(same.nextAllowed,60000);
 const quota=new GeminiQueue(clock());quota.restore({...state,error:{httpStatus:429}},{model:'gemini-3.8-flash'});assert.equal(quota.nextAllowed,60000);
 const account=new GeminiQueue(clock());account.restore({...state,phase:'blocked',error:{httpStatus:403}},{model:'gemini-3.8-flash'});assert.equal(account.state.phase,'blocked');
});

test('Default teacher uses 3.8 Flash, records its model in the queue and prices its usage',async()=>{
 let seenUrl,seenBody;const queue=new GeminiQueue(clock());
 const result=await askTeacher('fixture',[],{type:'OBJECT'},{key:'fixture',queue,fetcher:async(url,options)=>{seenUrl=url;seenBody=JSON.parse(options.body);return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:'{}'}]}}]}));}});
 assert.match(seenUrl,/gemini-3\.8-flash/);assert.equal(result.model,'gemini-3.8-flash');assert.equal(queue.state.context.model,result.model);assert.equal(seenBody.generationConfig.temperature,undefined);
});
test('503 requests back off exponentially and queued operations never overlap',async()=>{
 const time=clock(),queue=new GeminiQueue(time),starts=[];let attempts=0,active=0,maximum=0;
 const operation=async()=>{maximum=Math.max(maximum,++active);starts.push(time.now());await Promise.resolve();active--;if(++attempts<3)throw new GeminiRequestError(503,'High demand','UNAVAILABLE');return 'ok';};
 const values=await Promise.all([queue.run(operation),queue.run(async()=>{starts.push(time.now());return 'second';})]);
 assert.deepEqual(values,['ok','second']);assert.deepEqual(starts,[0,1000,3000,3000]);assert.equal(maximum,1);
});
test('Successful requests run back-to-back without artificial sleeps',async()=>{
 const waits=[],queue=new GeminiQueue({sleep:async ms=>waits.push(ms)});
 await Promise.all(Array.from({length:5},()=>queue.run(async()=> 'ok')));
 assert.deepEqual(waits,[]);
});
test('Retry-After takes precedence, and retries remain bounded',async()=>{
 const time=clock(),queue=new GeminiQueue({...time,maxAttempts:2});let calls=0;
 await assert.rejects(queue.run(async()=>{calls++;throw new GeminiRequestError(429,'Quota','RESOURCE_EXHAUSTED',120000);}),/Quota/);
 assert.equal(calls,2);assert.equal(time.now(),120000);assert.equal(queue.state.phase,'cooldown');assert.equal(retryAfterMs('120',0),120000);assert.equal(retryAfterMs('Thu, 01 Jan 1970 00:02:00 GMT',0),120000);
});
test('Payment/authentication failures block queued calls and survive restart',async()=>{
 const queue=new GeminiQueue(clock());let calls=0;
 await assert.rejects(queue.run(async()=>{calls++;throw new GeminiRequestError(402,'Payment required','PAYMENT_REQUIRED');}),/Payment required/);
 await assert.rejects(queue.run(async()=>{calls++;}),/Payment required/);assert.equal(calls,1);assert.equal(queue.state.phase,'blocked');
 const restored=new GeminiQueue(clock());restored.restore(queue.state);await assert.rejects(restored.run(async()=>{calls++;}),/Payment required/);assert.equal(calls,1);assert.equal(restored.state.phase,'blocked');
});
test('Client retains provider error details and accounts for a successful response once',async()=>{
 const time=clock(),queue=new GeminiQueue(time);let calls=0,usage=0;
 const result=await askTeacher('fixture',[],{type:'OBJECT'},{key:'fixture-secret',queue,onUsage:async()=>usage++,fetcher:async()=>++calls===1?new Response(JSON.stringify({error:{status:'UNAVAILABLE',message:'High demand fixture-secret'}}),{status:503,headers:{'Retry-After':'60'}}):new Response(JSON.stringify({usageMetadata:{promptTokenCount:1},candidates:[{finishReason:'STOP',content:{parts:[{text:'{}'}]}}]}),{status:200})});
 assert.deepEqual(result.result,{});assert.equal(calls,2);assert.equal(usage,1);assert.equal(time.now(),60000);
 const blocked=new GeminiQueue(clock());await assert.rejects(askTeacher('fixture',[],{type:'OBJECT'},{key:'fixture-secret',queue:blocked,fetcher:async()=>new Response('Payment required fixture-secret',{status:402})}),/\[redacted\]/);assert.ok(!blocked.state.error.message.includes('fixture-secret'));
});
