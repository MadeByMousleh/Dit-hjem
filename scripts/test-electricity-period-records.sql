-- Synthetic database fixtures only; signature verification has separate JS tests.
begin;
set local plpgsql.check_asserts = on;
do $$
declare u uuid := gen_random_uuid(); h uuid := gen_random_uuid();
begin
  insert into auth.users(id,email,email_confirmed_at) values(u,u::text || '@example.invalid',now());
  insert into public.households(id,name) values(h,'Electricity periods rollback fixture');
  insert into public.household_members(household_id,user_id) values(h,u);
  insert into public.energy_vault_writers(household_id,public_key) values(h,repeat('12',32));
  perform set_config('electricity_test.user',u::text,true);
  perform set_config('electricity_test.home',h::text,true);
end $$;
do $$
declare u uuid := current_setting('electricity_test.user')::uuid; h uuid := current_setting('electricity_test.home')::uuid;
  e jsonb := jsonb_build_object('format','stromblik-xchacha20poly1305-v1','nonce',repeat('ab',24),'ciphertext',repeat('cd',32));
  items jsonb; rejected boolean; before_bytes bigint;
begin
  assert not has_function_privilege('authenticated','public.commit_electricity_period_records(uuid,uuid,text,jsonb)','execute');
  assert not has_function_privilege('anon','public.commit_electricity_period_records(uuid,uuid,text,jsonb)','execute');
  assert has_function_privilege('service_role','public.commit_electricity_period_records(uuid,uuid,text,jsonb)','execute');
  assert not has_table_privilege('authenticated','public.electricity_period_records','insert');
  assert not has_table_privilege('service_role','public.electricity_period_records','update');
  assert not has_table_privilege('authenticated','public.electricity_record_usage','select');
  items := jsonb_build_array(
    jsonb_build_object('recordKey','hour/2026-10-01','expectedRevision',0,'envelope',e),
    jsonb_build_object('recordKey','day/2026-10','expectedRevision',0,'envelope',e));
  perform public.commit_electricity_period_records(u,h,repeat('12',32),items);
  assert (select count(*)=2 from public.electricity_period_records where household_id=h);
  assert (select count(*)=2 from public.electricity_period_versions where household_id=h);
  assert (select version_count=2 and record_count=2 and stored_bytes>0 from public.electricity_record_usage where household_id=h);
  rejected := false;
  begin perform public.commit_electricity_period_records(u,h,repeat('12',32),items); exception when others then rejected := SQLERRM='electricity_revision_conflict'; end;
  assert rejected, 'Replay was accepted';
  -- The first insert must roll back when the second record has a stale revision.
  items := jsonb_build_array(
    jsonb_build_object('recordKey','month/2026','expectedRevision',0,'envelope',e),
    jsonb_build_object('recordKey','hour/2026-10-01','expectedRevision',0,'envelope',e));
  rejected := false;
  begin perform public.commit_electricity_period_records(u,h,repeat('12',32),items); exception when others then rejected := SQLERRM='electricity_revision_conflict'; end;
  assert rejected;
  assert not exists(select 1 from public.electricity_period_records where household_id=h and record_key='month/2026'), 'Partial batch survived conflict';
  assert (select count(*)=2 from public.electricity_period_versions where household_id=h);
  items := jsonb_build_array(jsonb_build_object('recordKey','hour/2026-10-01','expectedRevision',1,'envelope',e));
  rejected := false;
  begin perform public.commit_electricity_period_records(u,h,repeat('34',32),items); exception when others then rejected := SQLERRM='writer_key_mismatch'; end;
  assert rejected, 'Pinned key was replaced';
  rejected := false;
  begin perform public.commit_electricity_period_records(gen_random_uuid(),h,repeat('12',32),items); exception when insufficient_privilege then rejected := true; end;
  assert rejected, 'Nonmember write succeeded';
  rejected := false;
  begin perform public.commit_electricity_period_records(u,h,repeat('12',32),jsonb_build_array(jsonb_build_object('recordKey','state/import','expectedRevision',0,'envelope','{"format":null,"nonce":null,"ciphertext":null}'::jsonb))); exception when check_violation then rejected := true; end;
  assert rejected, 'Null envelope accepted';
  rejected := false;
  begin perform public.commit_electricity_period_records(u,h,repeat('12',32),jsonb_build_array(jsonb_build_object('recordKey','state/import','expectedRevision',0,'envelope',e || jsonb_build_object('ciphertext',repeat('ab',131073))))); exception when check_violation then rejected := true; end;
  assert rejected, 'Oversized record accepted';
  select stored_bytes into before_bytes from public.electricity_record_usage where household_id=h;
  update public.electricity_record_usage set stored_bytes=268435456 where household_id=h;
  rejected := false;
  begin perform public.commit_electricity_period_records(u,h,repeat('12',32),items); exception when others then rejected := SQLERRM='electricity_storage_limit'; end;
  assert rejected, 'Storage quota was bypassed';
  assert (select revision=1 from public.electricity_period_records where household_id=h and record_key='hour/2026-10-01'), 'Quota failure changed current row';
  assert (select count(*)=2 from public.electricity_period_versions where household_id=h), 'Quota failure archived a partial write';
  update public.electricity_record_usage set stored_bytes=before_bytes where household_id=h;
  perform public.commit_electricity_period_records(u,h,repeat('12',32),items);
  assert (select revision=2 from public.electricity_period_records where household_id=h and record_key='hour/2026-10-01');
  assert (select count(*)=3 from public.electricity_period_versions where household_id=h);
end $$;
set local role authenticated;
do $$
declare h uuid := current_setting('electricity_test.home')::uuid; rejected boolean;
begin
  perform set_config('request.jwt.claim.sub',current_setting('electricity_test.user'),true);
  assert (select count(*)=2 from public.electricity_period_records where household_id=h), 'Member cannot read own records';
  assert (select count(*)=3 from public.electricity_period_versions where household_id=h);
  rejected := false;
  begin delete from public.electricity_period_records where household_id=h; exception when insufficient_privilege then rejected := true; end;
  assert rejected, 'Client can delete current periods';
  rejected := false;
  begin update public.electricity_period_versions set envelope='{}' where household_id=h; exception when insufficient_privilege then rejected := true; end;
  assert rejected, 'Client can change immutable versions';
  rejected := false;
  begin perform public.commit_electricity_period_records(auth.uid(),h,repeat('12',32),'[]'); exception when insufficient_privilege then rejected := true; end;
  assert rejected, 'Client bypassed signature gateway';
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  assert (select count(*)=0 from public.electricity_period_records where household_id=h), 'Cross-household current rows leaked';
  assert (select count(*)=0 from public.electricity_period_versions where household_id=h), 'Cross-household versions leaked';
end $$;
reset role;
rollback;
select count(*) as fixture_households_remaining from public.households where name='Electricity periods rollback fixture';
