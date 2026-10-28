import assert from'node:assert/strict';import{readFile,writeFile,mkdtemp,access}from'node:fs/promises';import{execFile}from'node:child_process';import{promisify}from'node:util';import{createHash}from'node:crypto';import{resolve,relative}from'node:path';
const run=promisify(execFile),dir=await mkdtemp(resolve('.tmp/erasure-tool-'));
const actor='11111111-1111-4111-8111-111111111111',home='22222222-2222-4222-8222-222222222222';
const record={user_hash:createHash('sha256').update(actor).digest('hex'),deleted_at:'2026-10-26T12:00:00Z',deleted_households:[home],successors:{}};
const input=dir+'/ledger.json',output=dir+'/review.sql';await writeFile(input,JSON.stringify({rows:[record]}));
const command=['scripts/prepare-erasure-restore.mjs','--ledger',input,'--out',output];
const result=JSON.parse((await run(process.execPath,command)).stdout);assert.equal(result.executed,false);assert.equal(result.databaseContacted,false);assert.equal(result.events,1);
await assert.rejects(run(process.execPath,command),'Existing output must not be overwritten');
const sql=await readFile(output,'utf8');assert(sql.includes('Offline restore approval required'));assert(!sql.includes(actor),'Ledger must not contain raw account ID');
await writeFile(input,JSON.stringify({rows:[{...record,user_hash:"x');drop table auth.users;--"}]}));
const invalid=dir+'/invalid.sql';await assert.rejects(run(process.execPath,['scripts/prepare-erasure-restore.mjs','--ledger',input,'--out',invalid]));await assert.rejects(access(invalid));
await writeFile(input,JSON.stringify({rows:[record]}));await assert.rejects(run(process.execPath,['scripts/prepare-erasure-restore.mjs','--ledger',input,'--out','../erasure-outside.sql']));
// Produce, but do not execute, a rollback-only dev fixture. Refuse a nonempty
// ledger so reconciliation cannot act on unrelated existing rows during test.
const fixture=`begin;
do $$ begin if exists(select 1 from public.account_erasure_ledger) then raise exception 'Dev erasure ledger must be empty for isolated fixture';end if;end $$;
insert into auth.users(id,email,email_confirmed_at) values('${actor}','synthetic-restore@example.invalid',now());
insert into public.households(id,name) values('${home}','Synthetic restored home');
insert into public.household_members(household_id,user_id,family_role) values('${home}','${actor}','owner');
set local huslyg.restore_mode='approved_offline';
${sql.replace(/^begin;$/m,'').replace(/commit;\s*$/,'')}
do $$ begin
 assert not exists(select 1 from auth.users where id='${actor}'),'Erased Auth user resurrected';
 assert not exists(select 1 from public.households where id='${home}'),'Erased household resurrected';
 assert exists(select 1 from public.account_erasure_ledger where user_hash='${record.user_hash}' and deleted_at='${record.deleted_at}'::timestamptz),'Original erasure chronology lost';
end $$;
rollback;
`;
const fixturePath=dir+'/restore-dev-test.sql';await writeFile(fixturePath,fixture);
const evidence={offlineGenerator:true,explicitApprovalGuard:true,invalidInputRejected:true,overwriteRejected:true,outsideWorkspaceRejected:true,devFixture:relative(process.cwd(),fixturePath),devFixtureExecuted:false};await writeFile('.tmp/legal-all/erasure-tool-test.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
