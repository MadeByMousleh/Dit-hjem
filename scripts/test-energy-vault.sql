-- Isolated fixtures, always rolled back. Ciphertext is deliberately synthetic;
-- this checks database authorization/concurrency, not client cryptography.
begin;

-- Test-only gateway emulation. Signatures are tested in the JS gateway suites.
-- This function exists only inside this rolled-back transaction and must NEVER
-- be deployed as an application function.
create function pg_temp.gateway_save(h uuid, expected integer, envelope jsonb, digest text default null)
returns setof public.energy_vaults language sql security definer set search_path='' as $$
  select * from public.commit_signed_energy_vault(auth.uid(),h,expected,envelope,repeat('12',32),digest);
$$;
revoke all on function pg_temp.gateway_save(uuid,integer,jsonb,text) from public,anon;
grant execute on function pg_temp.gateway_save(uuid,integer,jsonb,text) to authenticated;
do $$
declare u uuid := gen_random_uuid(); h uuid := gen_random_uuid();
begin
  insert into auth.users(id,email,email_confirmed_at) values(u,u::text || '@example.invalid',now());
  insert into public.households(id,name) values(h,'Vault rollback test');
  insert into public.household_members(household_id,user_id) values(h,u);
  perform set_config('vault_test.user',u::text,true);
  perform set_config('vault_test.home',h::text,true);
end $$;
set local role authenticated;
do $$
declare h uuid := current_setting('vault_test.home')::uuid; digest text; rejected boolean;
  envelope jsonb := jsonb_build_object('format','stromblik-xchacha20poly1305-v1','nonce',repeat('ab',24),'ciphertext',repeat('cd',32));
begin
  perform set_config('request.jwt.claim.sub',current_setting('vault_test.user'),true);
  select public.export_energy_for_encryption(h)->>'digest' into digest;
  perform public.save_electricity_agreement(h,null,'test','Test','spot',null,5,29,'2025-01-01');
  rejected := false;
  begin perform pg_temp.gateway_save(h,0,envelope,digest); exception when others then rejected := true; end;
  assert rejected, 'Outdated migration snapshot was accepted';
  assert (select count(*)=0 from public.energy_vaults where household_id=h), 'Failed migration left a partial vault';
  select public.export_energy_for_encryption(h)->>'digest' into digest;
  rejected := false;
  begin perform pg_temp.gateway_save(h,0,'{"format":null,"nonce":null,"ciphertext":null}'::jsonb,digest); exception when check_violation then rejected := true; end;
  assert rejected, 'Null envelope accepted';
  assert (select count(*)=0 from public.energy_vault_writers where household_id=h), 'Failed enrollment pinned a key';
  rejected := false;
  begin perform public.save_energy_vault(h,0,envelope,digest); exception when insufficient_privilege then rejected := true; end;
  assert rejected, 'Old login-only enrollment is still callable';
  rejected := false;
  begin perform public.commit_signed_energy_vault(auth.uid(),h,0,envelope,repeat('12',32),digest); exception when insufficient_privilege then rejected := true; end;
  assert rejected, 'Authenticated caller bypassed gateway';
  perform pg_temp.gateway_save(h,0,envelope,digest);
  assert (select revision=1 from public.energy_vaults where household_id=h), 'Initial revision missing';
  assert (select count(*)=0 from public.electricity_agreements where household_id=h), 'Login alone still reveals old plaintext';
  perform pg_temp.gateway_save(h,1,envelope);
  rejected := false;
  begin perform pg_temp.gateway_save(h,1,envelope); exception when others then rejected := true; end;
  assert rejected, 'Stale device overwrote newer data';
  assert (select revision=2 from public.energy_vaults where household_id=h), 'Stale save changed revision';
  assert (select count(*)=2 from public.energy_vault_versions where household_id=h), 'Versions were lost or stale write archived';
  assert (select v.envelope->>'ciphertext'=repeat('cd',32) from public.energy_vault_versions v where household_id=h and revision=1), 'Original version changed';
  rejected := false;
  begin delete from public.energy_vault_versions where household_id=h; exception when insufficient_privilege then rejected := true; end;
  assert rejected, 'Client can delete history';
  rejected := false;
  begin update public.energy_vault_versions set envelope='{}' where household_id=h; exception when insufficient_privilege then rejected := true; end;
  assert rejected, 'Client can corrupt history';
  rejected := false;
  begin insert into public.energy_vault_versions(household_id,revision,envelope,saved_at) values(h,99,envelope,now()); exception when insufficient_privilege then rejected := true; end;
  assert rejected, 'Client can insert history outside the save transaction';
  rejected := false;
  begin update public.energy_vaults set revision=3 where household_id=h; exception when insufficient_privilege then rejected := true; end;
  assert rejected, 'Client bypassed compare-and-swap';
  rejected := false;
  begin update public.energy_vault_writers set public_key=repeat('34',32) where household_id=h; exception when insufficient_privilege then rejected := true; end;
  assert rejected, 'Client can replace the pinned key';
  rejected := false;
  begin delete from public.energy_vault_writers where household_id=h; exception when insufficient_privilege then rejected := true; end;
  assert rejected, 'Client can delete the pinned key';
  rejected := false;
  begin perform public.export_energy_for_encryption(h); exception when others then rejected := true; end;
  assert rejected, 'Enrolled home could export plaintext again';
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  assert (select count(*)=0 from public.energy_vaults where household_id=h), 'Other user sees encrypted data';
  assert (select count(*)=0 from public.energy_vault_versions where household_id=h), 'Other user sees encrypted history';
  assert (select count(*)=0 from public.energy_vault_writers where household_id=h), 'Other user sees signing identity';
  rejected := false;
  begin perform pg_temp.gateway_save(h,2,envelope); exception when others then rejected := true; end;
  assert rejected, 'Other user can overwrite vault';
end $$;
reset role;
do $$
declare h uuid := current_setting('vault_test.home')::uuid; u uuid := current_setting('vault_test.user')::uuid;
  e jsonb; rejected boolean := false; legacy_home uuid := gen_random_uuid();
begin
  assert has_function_privilege('service_role','public.commit_signed_energy_vault(uuid,uuid,integer,jsonb,text,text)','execute'), 'Gateway role missing permission';
  assert not has_function_privilege('authenticated','public.commit_signed_energy_vault(uuid,uuid,integer,jsonb,text,text)','execute'), 'Login role can invoke commit';
  assert not has_function_privilege('service_role','public.save_energy_vault(uuid,integer,jsonb,text)','execute'), 'Old path remains executable';
  select envelope into e from public.energy_vaults where household_id=h;
  begin perform public.commit_signed_energy_vault(u,h,2,e,repeat('34',32)); exception when raise_exception then rejected := sqlerrm='writer_key_mismatch'; end;
  assert rejected, 'Different public key replaced the original';
  assert (select revision=2 from public.energy_vaults where household_id=h), 'Rejected replacement changed head';
  insert into public.households(id,name) values(legacy_home,'Legacy fixture');
  insert into public.household_members(household_id,user_id) values(legacy_home,u);
  insert into public.energy_vaults(household_id,revision,envelope) values(legacy_home,1,e);
  rejected := false;
  begin perform public.commit_signed_energy_vault(u,legacy_home,1,e,repeat('12',32)); exception when raise_exception then rejected := sqlerrm='legacy_write_locked'; end;
  assert rejected, 'Legacy vault accepted first-login-wins key binding';
  assert (select count(*)=0 from public.energy_vault_writers where household_id=legacy_home), 'Legacy key was silently registered';
  assert (select revision=1 from public.energy_vaults where household_id=legacy_home), 'Legacy ciphertext changed';
end $$;
reset role;
do $$
declare rejected boolean := false;
begin
  assert (select count(*)=1 from public.electricity_agreements where household_id=current_setting('vault_test.home')::uuid), 'Migration deleted old data';
  begin insert into public.electricity_meters(household_id,metering_point_id) values(current_setting('vault_test.home')::uuid,'123456789012345678'); exception when others then rejected := true; end;
  assert rejected, 'Privileged import job can still write plaintext';
end $$;
-- Only this rolled-back fixture is filled to capacity. An archive failure must
-- roll back the current snapshot update as well.
insert into public.energy_vault_versions(household_id,revision,envelope,saved_at)
select current_setting('vault_test.home')::uuid,n,'{}'::jsonb,now() from generate_series(3,1000) n;
set local role authenticated;
do $$
declare h uuid := current_setting('vault_test.home')::uuid; rejected boolean := false; e jsonb;
begin
  perform set_config('request.jwt.claim.sub',current_setting('vault_test.user'),true);
  select envelope into e from public.energy_vaults where household_id=h;
  begin perform pg_temp.gateway_save(h,2,e); exception when raise_exception then rejected := true; end;
  assert rejected, 'Archive capacity limit was bypassed';
  assert (select revision=2 from public.energy_vaults where household_id=h), 'Failed archive changed current snapshot';
  assert (select count(*)=1000 from public.energy_vault_versions where household_id=h), 'Failed archive changed history';
end $$;
reset role;
set local role anon;
do $$
declare rejected boolean := false;
begin
  begin perform public.save_energy_vault(current_setting('vault_test.home')::uuid,2,'{}'); exception when insufficient_privilege then rejected := true; end;
  assert rejected, 'Anonymous vault write allowed';
  rejected := false;
  begin perform public.commit_signed_energy_vault(current_setting('vault_test.user')::uuid,current_setting('vault_test.home')::uuid,2,'{}',repeat('12',32)); exception when insufficient_privilege then rejected := true; end;
  assert rejected, 'Anonymous gateway bypass allowed';
  rejected := false;
  begin perform 1 from public.energy_vault_versions; exception when insufficient_privilege then rejected := true; end;
  assert rejected, 'Anonymous history read allowed';
end $$;
rollback;
