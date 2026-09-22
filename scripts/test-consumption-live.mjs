// Explicit integration test: creates isolated fixtures and removes only those fixtures.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import vercelHandler from '../api/eloverblik/usage.mjs';
import { createAdminClient, createContextClient } from '@supabase/server/core';
import { storedUsage, usageResponse } from '../src/services/household-usage.mjs';
import { expectedIntervals, midnight } from '../src/services/consumption-data.mjs';
import { backgroundWindow } from '../src/services/background-usage.mjs';

const db=createAdminClient();
const checked=async promise=>{const {data,error}=await promise;if(error)throw new Error(`Database test failed (${error.code})`);return data;};
const users=[], households=[];
process.env.VERCEL='1';
const {handler:localHandler}=await import('../server.mjs');
const server=createServer(localHandler);
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const meterPoint='123456789012345678';
function fixture(quantity=1, missing=false) {
  const points=expectedIntervals('2026-01-01','2026-01-02','hour').map((_,i)=>({position:i+1,'out_Quantity.quantity':quantity}));
  if(missing) points.pop();
  return {result:[{success:true,MyEnergyData_MarketDocument:{TimeSeries:[{businessType:'A04','MarketEvaluationPoint.mRID':{name:meterPoint},Period:[{resolution:'PT1H',timeInterval:{start:midnight('2026-01-01')},Point:points}]}]}}]};
}
try {
  for(let i=0;i<2;i++) {
    const email=`dit-hjem-test-${randomUUID()}@example.invalid`;
    const password=randomUUID()+randomUUID();
    const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true});
    if(error)throw new Error('Test user creation failed');
    users.push(data.user.id);
    const client=createContextClient();
    const signed=await client.auth.signInWithPassword({email,password});
    assert.equal(signed.error,null);
    const h=await checked(db.from('households').insert({name:'Integration test'}).select('id').single());
    households.push(h.id);
    if(i===0) {
      await checked(db.from('household_invitations').insert({household_id:h.id,email}));
      await checked(client.rpc('claim_household_invitations'));
      await checked(client.rpc('claim_household_invitations'));
    } else await checked(db.from('household_members').insert({household_id:h.id,user_id:data.user.id}));
    const meter=await checked(db.from('electricity_meters').insert({household_id:h.id,metering_point_id:meterPoint}).select('id').single());
    h.meter=meter.id; h.client=client; h.token=signed.data.session.access_token;
    households[i]=h;
  }
  const [a,b]=households;
  for(const [own,other] of [[a,b],[b,a]]) {
    assert.deepEqual((await checked(own.client.from('households').select('id'))).map(h=>h.id),[own.id]);
    assert.deepEqual(await checked(own.client.from('electricity_meters').select('id').eq('household_id',other.id)),[]);
    assert.ok((await own.client.from('household_members').insert({household_id:other.id,user_id:users[0]})).error);
    assert.ok((await own.client.from('household_invitations').select('*')).error);
  }
  const anon=createContextClient();
  assert.ok((await anon.from('electricity_readings').select('*')).error);
  assert.ok((await a.client.rpc('import_electricity_range',{})).error);
  const request=token=>new Request('https://localhost/api/eloverblik/usage',{headers:token?{authorization:`Bearer ${token}`}:{}});
  const selection={from:'2026-01-01',to:'2026-01-02',aggregation:'Hour'};
  assert.equal((await usageResponse(request(),{...selection,householdId:a.id})).status,401);
  assert.equal((await usageResponse(request('invalid'),{...selection,householdId:a.id})).status,401);
  assert.equal((await usageResponse(request(a.token),{...selection,householdId:b.id})).status,403);
  let calls=0;
  const options={fetchMeter:async()=>{calls++;return fixture();}};
  const initial=await storedUsage(db,a.id,selection,options);
  assert.equal(initial.totalKwh,24); assert.equal(initial.incomplete,false);
  assert.equal((await storedUsage(db,a.id,selection,options)).totalKwh,24);
  assert.equal(calls,1);
  assert.equal((await usageResponse(request(a.token),{...selection,householdId:a.id})).status,200);
  for(const [token,householdId,expected] of [[null,a.id,401],['invalid',a.id,401],[a.token,b.id,403],[a.token,a.id,200]]) {
    const body={...selection,householdId};
    const headers=token?{authorization:`Bearer ${token}`} : {};
    let status;
    const response={setHeader(){},status(code){status=code;return this;},json(){return this;}};
    await vercelHandler({method:'POST',headers,body},response);
    assert.equal(status,expected,'Vercel adapter authorization');
    const local=await fetch(origin+'/api/eloverblik/usage',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal(local.status,expected,'Local adapter authorization');
    assert.equal(local.headers.get('cache-control'),'no-store');
  }
  assert.deepEqual(await checked(b.client.from('electricity_readings').select('*').eq('household_id',a.id)),[]);
  await checked(db.from('electricity_sync_ranges').update({fetched_at:'2020-01-01T00:00:00Z'}).eq('household_id',a.id));
  const corrected=await storedUsage(db,a.id,selection,{fetchMeter:async()=>fixture(2,true)});
  assert.equal(corrected.totalKwh,46); assert.equal(corrected.points.at(-1).kwh,null); assert.equal(corrected.incomplete,true);
  const rows=await checked(db.from('electricity_readings').select('*').eq('household_id',a.id));
  assert.equal(rows.length,23);
  const args={p_household:a.id,p_meter:a.meter,p_from:selection.from,p_to:selection.to,p_resolution:'hour',p_fetched:new Date(Date.now()+1000).toISOString(),p_complete:true,p_readings:rows.map(({starts_at,ends_at,kwh,quality})=>({starts_at,ends_at,kwh,quality}))};
  await checked(db.rpc('import_electricity_range',args));
  await checked(db.rpc('import_electricity_range',args));
  await checked(db.rpc('import_electricity_range',{...args,p_fetched:'2020-01-01T00:00:00Z',p_readings:[]}));
  assert.equal((await checked(db.from('electricity_readings').select('starts_at').eq('household_id',a.id))).length,23);
  const backgroundSelection=backgroundWindow();
  let quarterCalls=0;
  const quarterOptions={fetchMeter:async (_meter,from,to)=>{
    quarterCalls++;
    return {result:[{success:true,MyEnergyData_MarketDocument:{TimeSeries:[{businessType:'A04','MarketEvaluationPoint.mRID':{name:meterPoint},Period:[{resolution:'PT15M',timeInterval:{start:midnight(from),end:midnight(to)},Point:expectedIntervals(from,to,'quarter').map((_,i)=>({position:i+1,'out_Quantity.quantity':0.025}))}]}]}}]};
  }};
  await storedUsage(db,a.id,backgroundSelection,quarterOptions);
  await storedUsage(db,a.id,backgroundSelection,quarterOptions);
  assert.equal(quarterCalls,1,'seven adjacent quarter-hour days are fetched once and then cached');
  const estimate=await usageResponse(request(a.token),{householdId:a.id,view:'background'});
  assert.equal(estimate.status,200);assert.equal(estimate.body.watts,100);assert.equal(estimate.body.dailyKwh,2.4);
  assert.equal((await usageResponse(request(b.token),{householdId:a.id,view:'background'})).status,403);
  assert.equal((await usageResponse(request(),{householdId:a.id,view:'background'})).status,401);
  console.log('PASS: real JWTs, invitations, anonymous access, cross-household RLS/API isolation, client write restrictions, cache reuse, corrections, missing data, idempotency and stale import protection.');
} finally {
  await new Promise(resolve=>server.close(resolve));
  for(const h of households) await checked(db.from('households').delete().eq('id',typeof h==='string'?h:h.id));
  for(const id of users) {const {error}=await db.auth.admin.deleteUser(id);if(error)throw new Error('Test user cleanup failed');}
  console.log('Integration fixtures removed.');
}
