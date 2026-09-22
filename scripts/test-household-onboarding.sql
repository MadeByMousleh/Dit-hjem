begin;
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); unverified uuid := gen_random_uuid();
begin
  insert into auth.users(id,email,email_confirmed_at) values(a,a::text || '@example.invalid',now()),(b,b::text || '@example.invalid',now()),(unverified,unverified::text || '@example.invalid',null);
  perform set_config('onboarding.a',a::text,true);
  perform set_config('onboarding.b',b::text,true);
  perform set_config('onboarding.unverified',unverified::text,true);
end $$;
set local role authenticated;
do $$
declare first_home uuid; second_home uuid; rejected boolean := false;
begin
  perform set_config('request.jwt.claim.sub',current_setting('onboarding.a'),true);
  first_home := public.ensure_my_household();
  assert first_home=public.ensure_my_household(), 'Repeated onboarding created a second home';
  assert (select count(*)=1 from public.households), 'Wrong number of accessible homes';
  assert (select count(*)=0 from public.electricity_meters), 'New user inherited a meter';
  assert (select count(*)=0 from public.electricity_readings), 'New user inherited readings';
  perform set_config('request.jwt.claim.sub',current_setting('onboarding.b'),true);
  second_home := public.ensure_my_household();
  assert first_home<>second_home, 'Users share a home without invitation';
  assert (select count(*)=0 from public.households where id=first_home), 'Another home is visible';
  assert (select count(*)=0 from public.household_members where household_id=first_home), 'Identity mapping is visible';
  begin
    insert into public.household_members(household_id,user_id) values(first_home,current_setting('onboarding.b')::uuid);
  exception when insufficient_privilege then rejected := true; end;
  assert rejected, 'User could grant themselves access';
  perform set_config('request.jwt.claim.sub',current_setting('onboarding.unverified'),true);
  rejected := false;
  begin perform public.ensure_my_household(); exception when others then rejected := true; end;
  assert rejected, 'Unverified account provisioned a home';
end $$;
set local role anon;
do $$
declare rejected boolean := false;
begin
  begin perform public.ensure_my_household(); exception when insufficient_privilege then rejected := true; end;
  assert rejected, 'Anonymous caller could provision a home';
end $$;
rollback;
