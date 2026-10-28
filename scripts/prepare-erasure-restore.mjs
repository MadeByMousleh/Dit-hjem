// Offline preparation only. This script never connects to a database.
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {resolve,relative,isAbsolute,dirname} from 'node:path';
const args=process.argv.slice(2),input=args[args.indexOf('--ledger')+1],output=args[args.indexOf('--out')+1];
if(!args.includes('--ledger')||!args.includes('--out')||!input||!output)throw Error('Usage: node scripts/prepare-erasure-restore.mjs --ledger private.json --out review.sql');
const target=resolve(output),path=relative(process.cwd(),target);
if(!path||path.startsWith('..')||isAbsolute(path))throw Error('Output must stay inside the current workspace.');
const parent=relative(await realpath(process.cwd()),await realpath(dirname(target)));
if(parent.startsWith('..')||isAbsolute(parent))throw Error('Output parent resolves outside the workspace.');
const bytes=await readFile(input);if(bytes.length>50*1024*1024)throw Error('Ledger input too large.');
const value=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,'')),rows=Array.isArray(value)?value:value.rows;
if(!Array.isArray(rows)||rows.length>100000)throw Error('Expected an explicit ledger row array.');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,seen=new Set();
const checked=rows.map(row=>{
 if(!row||typeof row!=='object'||!(/^[0-9a-f]{64}$/).test(row.user_hash)||seen.has(row.user_hash))throw Error('Invalid or duplicate erasure hash.');
 seen.add(row.user_hash);
 if(typeof row.deleted_at!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(row.deleted_at)||!Number.isFinite(Date.parse(row.deleted_at)))throw Error('Invalid deletion time.');
 if(!Array.isArray(row.deleted_households)||row.deleted_households.length>100||row.deleted_households.some(home=>typeof home!=='string'||!uuid.test(home)))throw Error('Invalid household IDs.');
 if(!row.successors||typeof row.successors!=='object'||Array.isArray(row.successors)||Object.entries(row.successors).some(([home,member])=>!uuid.test(home)||typeof member!=='string'||!uuid.test(member)))throw Error('Invalid successor metadata.');
 return{user_hash:row.user_hash,deleted_at:new Date(row.deleted_at).toISOString(),deleted_households:row.deleted_households,successors:row.successors};
});
const data=JSON.stringify(checked).replaceAll("'","''");
const sql=`-- REVIEW ONLY: reconcile a complete, current erasure ledger after a restore.
-- Keep all app traffic/automatic imports OFFLINE until full reconciliation.
-- This is not a complete membership-revocation or provider-token restore tool.
-- An operator must explicitly set huslyg.restore_mode='approved_offline' in
-- this SAME session before running. Missing successors fail closed.
begin;
do $$ begin
 if current_setting('huslyg.restore_mode',true) is distinct from 'approved_offline' then
  raise exception 'Offline restore approval required';
 end if;
 if to_regclass('public.account_erasure_ledger') is null then
  raise exception 'Apply reviewed schema migrations before reconciliation';
 end if;
end $$;
create temporary table restore_erasure_events on commit drop as
 select * from jsonb_to_recordset('${data}'::jsonb)
 as e(user_hash text,deleted_at timestamptz,deleted_households uuid[],successors jsonb);
insert into public.account_erasure_ledger select * from restore_erasure_events
 on conflict(user_hash) do update set
 deleted_at=least(account_erasure_ledger.deleted_at,excluded.deleted_at),
 deleted_households=(select coalesce(array_agg(distinct item),'{}'::uuid[]) from unnest(account_erasure_ledger.deleted_households||excluded.deleted_households) item),
 successors=account_erasure_ledger.successors||excluded.successors;
create temporary table restore_erasure_plan on commit drop as
 select * from public.account_erasure_ledger;
do $$
declare event record; actor uuid;
begin
 for event in select * from restore_erasure_plan order by deleted_at,user_hash loop
  delete from public.households where id=any(event.deleted_households);
  select id into actor from auth.users
   where encode(sha256(convert_to(id::text,'UTF8')),'hex')=event.user_hash;
  if actor is not null then
   insert into public.account_deletion_choices(user_id,successors,requested_at)
   values(actor,event.successors,now()) on conflict(user_id)
   do update set successors=excluded.successors,requested_at=excluded.requested_at;
   delete from auth.users where id=actor;
  end if;
 end loop;
end $$;
-- Preserve original chronology even though the cleanup trigger ran again.
update public.account_erasure_ledger l set deleted_at=least(l.deleted_at,e.deleted_at)
 from restore_erasure_plan e where e.user_hash=l.user_hash;
commit;
`;
await writeFile(target,sql,{flag:'wx'});
console.log(JSON.stringify({output:path,events:checked.length,databaseContacted:false,executed:false}));
