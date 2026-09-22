-- Isolated fixtures; every change is rolled back, including on error/disconnect.
begin;
do $$
declare
  test_user uuid := gen_random_uuid();
  test_home uuid := gen_random_uuid();
  old_id uuid;
  new_id uuid;
  rejected boolean;
begin
  insert into auth.users(id) values(test_user);
  insert into public.households(id,name) values(test_home,'Agreement rollback test');
  insert into public.household_members(household_id,user_id) values(test_home,test_user);
  perform set_config('request.jwt.claim.sub',test_user::text,true);
  perform set_config('agreement_test.home',test_home::text,true);
  perform set_config('agreement_test.user',test_user::text,true);
  perform public.save_electricity_agreement(test_home,null,'andel-energi','Andel Energi','spot',null,5.25,29,'2025-01-01');
  select id into old_id from public.electricity_agreements where household_id=test_home;
  perform public.save_electricity_agreement(test_home,old_id,'andel-energi','Andel Energi','spot',null,5.25,29,'2025-01-01');
  assert (select count(*)=1 from public.electricity_agreements where household_id=test_home), 'Repeated save duplicated history';
  rejected := false;
  begin
    perform public.save_electricity_agreement(test_home,old_id,'nrgi','NRGi','fixed',80,2,19,'2025-01-01');
  exception when others then rejected := true; end;
  assert rejected, 'Same-date replacement was allowed';
  -- A failed insert must roll back closing the old agreement.
  rejected := false;
  begin
    perform public.save_electricity_agreement(test_home,old_id,'nrgi','NRGi','fixed',80,-2,19,'2025-03-01');
  exception when check_violation then rejected := true; end;
  assert rejected, 'Negative rate was allowed';
  assert (select date_to is null from public.electricity_agreements where id=old_id), 'Failed replacement closed current agreement';
  perform public.save_electricity_agreement(test_home,old_id,'nrgi','NRGi','fixed',80,2,19,'2025-03-01');
  select id into new_id from public.electricity_agreements where household_id=test_home and date_to is null;
  assert (select count(*)=2 from public.electricity_agreements where household_id=test_home), 'Missing history';
  assert (select date_to='2025-03-01' and markup_ore=5.25 and subscription_dkk=29 from public.electricity_agreements where id=old_id), 'Old agreement changed';
  assert (select fixed_ore=80 and date_from='2025-03-01' from public.electricity_agreements where id=new_id), 'New agreement missing price/date';
  rejected := false;
  begin
    perform public.save_electricity_agreement(test_home,old_id,'nrgi','NRGi','fixed',85,2,19,'2025-04-01');
  exception when others then rejected := true; end;
  assert rejected, 'Stale edit overwrote a newer agreement';
end $$;
set local role authenticated;
do $$
declare rejected boolean := false;
begin
  assert (select count(*)=2 from public.electricity_agreements where household_id=current_setting('agreement_test.home')::uuid), 'Member cannot read agreements';
  begin
    update public.electricity_agreements set markup_ore=0 where household_id=current_setting('agreement_test.home')::uuid;
  exception when insufficient_privilege then rejected := true; end;
  assert rejected, 'Direct history updates allowed';
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  assert (select count(*)=0 from public.electricity_agreements where household_id=current_setting('agreement_test.home')::uuid), 'Cross-household history visible';
  rejected := false;
  begin
    perform public.save_electricity_agreement(current_setting('agreement_test.home')::uuid,null,'nrgi','NRGi','fixed',80,2,19,'2025-04-01');
  exception when others then rejected := true; end;
  assert rejected, 'Non-member save allowed';
end $$;
rollback;
