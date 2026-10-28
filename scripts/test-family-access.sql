begin;
do $$
declare owner_id uuid:=gen_random_uuid(); member_id uuid:=gen_random_uuid(); outsider_id uuid:=gen_random_uuid(); unverified_id uuid:=gen_random_uuid(); h uuid:=gen_random_uuid(); result jsonb; rejected boolean;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 (owner_id,owner_id::text||'@example.invalid',now(),'{"full_name":"Owner Name"}'),
 (member_id,member_id::text||'@example.invalid',now(),'{"full_name":"Member Name"}'),
 (outsider_id,outsider_id::text||'@example.invalid',now(),'{}'),
 (unverified_id,unverified_id::text||'@example.invalid',null,'{}');
 insert into public.households(id,name) values(h,'Synthetic family');
 insert into public.household_members(household_id,user_id,family_role) values(h,owner_id,'owner');
 result:=public.family_manage(h,owner_id,'profile',p_profile:='{"addressId":"11111111-1111-4111-8111-111111111111","address":"Synthetic home"}');
 assert result->'home'->>'address'='Synthetic home';
 begin perform public.family_manage(h,owner_id,'profile',p_profile:='{"name":"Leaked owner name"}');raise exception 'Private fields allowed';exception when raise_exception then assert sqlerrm='Private profile fields forbidden';end;
 begin perform public.family_manage(h,outsider_id,'list');raise exception 'Outsider allowed';exception when insufficient_privilege then null;end;
 perform public.family_manage(h,owner_id,'invite',member_id::text||'@example.invalid');
 perform set_config('request.jwt.claim.sub',member_id::text,true);
 perform public.claim_household_invitations();
 assert not exists(select 1 from public.household_members where household_id=h and user_id=member_id),'Pending email granted access';
 perform public.family_manage(h,owner_id,'sent',member_id::text||'@example.invalid');
 perform public.claim_household_invitations();
 assert not exists(select 1 from public.household_members where household_id=h and user_id=member_id),'Invitation accepted without consent';
 perform public.accept_family_invitation(h);
 assert exists(select 1 from public.household_members where household_id=h and user_id=member_id and family_role='member');
 assert (select raw_user_meta_data->>'full_name'='Member Name' from auth.users where id=member_id),'Member identity overwritten';
 result:=public.family_manage(h,member_id,'list');assert result->'home'->>'address'='Synthetic home';assert result->>'canManage'='false';
 begin perform public.family_manage(h,member_id,'invite','other@example.invalid');raise exception 'Member escalated';exception when insufficient_privilege then null;end;
 perform public.family_manage(h,owner_id,'remove',p_target:=member_id);
 perform public.claim_household_invitations();
 assert not exists(select 1 from public.household_members where household_id=h and user_id=member_id),'Removed member reclaimed invitation';
 perform public.family_manage(h,owner_id,'invite',unverified_id::text||'@example.invalid');
 perform public.family_manage(h,owner_id,'sent',unverified_id::text||'@example.invalid');
 perform set_config('request.jwt.claim.sub',unverified_id::text,true);
 begin perform public.accept_family_invitation(h);raise exception 'Unverified accepted';exception when insufficient_privilege then null;end;
 assert not exists(select 1 from public.household_members where user_id=unverified_id),'Unverified email claimed';
 perform public.family_manage(h,owner_id,'invite',outsider_id::text||'@example.invalid');
 perform public.family_manage(h,owner_id,'sent',outsider_id::text||'@example.invalid');
 update public.household_invitations set expires_at=now()-interval '1 second' where household_id=h and email=outsider_id::text||'@example.invalid';
 perform set_config('request.jwt.claim.sub',outsider_id::text,true);
 begin perform public.accept_family_invitation(h);raise exception 'Expired accepted';exception when insufficient_privilege then null;end;
 assert not exists(select 1 from public.household_members where user_id=outsider_id),'Expired invite claimed';
 assert not has_function_privilege('authenticated','public.family_manage(uuid,uuid,text,text,uuid,jsonb)','execute'),'Client can impersonate actor';
 assert not has_function_privilege('anon','public.family_manage(uuid,uuid,text,text,uuid,jsonb)','execute');
 -- Synthetic ciphertext verifies that the same household records are readable
 -- through RLS by an accepted member, and never by another verified account.
 insert into public.household_members(household_id,user_id,family_role) values(h,member_id,'member');
 insert into public.energy_vaults(household_id,revision,envelope) values(h,1,jsonb_build_object('format','stromblik-xchacha20poly1305-v1','nonce',repeat('ab',24),'ciphertext',repeat('cd',32)));
 insert into public.electricity_period_records(household_id,record_key,revision,envelope) values(h,'day/2026-10',1,jsonb_build_object('format','stromblik-xchacha20poly1305-v1','nonce',repeat('ab',24),'ciphertext',repeat('cd',32)));
 perform set_config('family_test.home',h::text,true);perform set_config('family_test.member',member_id::text,true);perform set_config('family_test.outsider',outsider_id::text,true);
end $$;
set local role authenticated;
do $$
begin
 perform set_config('request.jwt.claim.sub',current_setting('family_test.member'),true);
 assert (select count(*)=1 from public.energy_vaults where household_id=current_setting('family_test.home')::uuid),'Family cannot read shared vault';
 assert (select count(*)=1 from public.electricity_period_records where household_id=current_setting('family_test.home')::uuid),'Family cannot read shared consumption';
 perform set_config('request.jwt.claim.sub',current_setting('family_test.outsider'),true);
 assert (select count(*)=0 from public.energy_vaults where household_id=current_setting('family_test.home')::uuid),'Outsider reads vault';
 assert (select count(*)=0 from public.electricity_period_records where household_id=current_setting('family_test.home')::uuid),'Outsider reads consumption';
end $$;
rollback;
