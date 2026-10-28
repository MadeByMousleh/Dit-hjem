import assert from 'node:assert/strict';
import {accountPrivacyResponse} from '../src/services/account-privacy-server.mjs';
const actor='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',home='33333333-3333-4333-8333-333333333333';
const now=Date.parse('2026-10-26T12:00:00Z'),writes=[],deletes=[];
let current={id:actor,email_confirmed_at:'2026-10-01',last_sign_in_at:new Date(now).toISOString()},deleteError=false,prepareError=false;
const ctx={userClaims:{id:actor},supabase:{auth:{getUser:async()=>({data:{user:current}})},from:()=>({select:()=>({eq:async()=>({data:[{household_id:home,family_role:'owner'}]})})})},supabaseAdmin:{
 rpc:async()=>({data:{name:'Synthetic home',members:[{id:actor,name:'Owner',role:'owner',email:'private-owner@example.invalid'},{id:other,name:'Member',role:'member',email:'private-member@example.invalid'}]}}),
 from:name=>({upsert:async value=>{writes.push({name,value});return{error:prepareError?{}:null};}}),auth:{admin:{getUserById:async()=>({data:{user:current}}),deleteUser:async(...args)=>{deletes.push(args);return{error:deleteError?{}:null};}}}}};
const deps={env:{ACCOUNT_DELETION_ENABLED:'true',SUPABASE_URL:'https://fixture.invalid'},now:()=>now,contextFactory:async(req,config)=>{assert.equal(config.auth,'user');assert.equal(config.issuer,'https://fixture.invalid/auth/v1');assert.equal(config.audience,'authenticated');return{data:ctx};}};
const request=new Request('https://fixture.invalid',{method:'POST',headers:{authorization:'Bearer synthetic'}});
assert.equal((await accountPrivacyResponse(new Request(request.url,{method:'POST'}),{action:'delete'},deps)).status,401);
assert.equal((await accountPrivacyResponse(request,{action:'preview'},{...deps,env:{}})).status,503);
const preview=await accountPrivacyResponse(request,{action:'preview'},deps);assert.equal(preview.status,200);assert.equal(preview.body.homes[0].needsSuccessor,true);assert(!JSON.stringify(preview).includes('private-member@'));assert.equal(writes.length,0);
assert.equal((await accountPrivacyResponse(request,{action:'delete',confirmation:'wrong'},deps)).status,400);assert.equal(deletes.length,0);
current={...current,last_sign_in_at:'2026-10-25T12:00:00Z'};assert.equal((await accountPrivacyResponse(request,{action:'delete',confirmation:'SLET MIN KONTO'},deps)).status,403);assert.equal(writes.length,0);
current={...current,last_sign_in_at:new Date(now).toISOString()};assert.equal((await accountPrivacyResponse(request,{action:'delete',confirmation:'SLET MIN KONTO',successors:{bad:other}},deps)).status,400);
prepareError=true;assert.equal((await accountPrivacyResponse(request,{action:'delete',confirmation:'SLET MIN KONTO'},deps)).status,503);assert.equal(deletes.length,0);prepareError=false;
deleteError=true;const failed=await accountPrivacyResponse(request,{action:'delete',confirmation:'SLET MIN KONTO'},deps);assert.equal(failed.status,409);assert(!failed.body.deleted);deleteError=false;
const result=await accountPrivacyResponse(request,{action:'delete',confirmation:'SLET MIN KONTO',actor:other,successors:{[home]:other}},deps);assert.equal(result.body.deleted,true);assert.deepEqual(deletes.at(-1),[actor,false]);assert.equal(writes.at(-1).value.user_id,actor);
current=null;assert.equal((await accountPrivacyResponse(request,{action:'preview'},deps)).status,401);
console.log('PASS account privacy: auth/issuer, feature gate, live user, recipient privacy, fresh login, confirmation, preparation/deletion failure and actor binding');
