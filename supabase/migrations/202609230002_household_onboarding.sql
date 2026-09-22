begin;
-- Only verified accounts can provision a home. Locking the account makes retries
-- and simultaneous app launches idempotent. No email/name is copied to energy data.
create function public.ensure_my_household() returns uuid
language plpgsql security definer set search_path = '' as $$
declare home_id uuid;
begin
  perform 1 from auth.users where id=auth.uid() and email_confirmed_at is not null for update;
  if not found then raise exception 'Bekræft din e-mail først.'; end if;
  perform public.claim_household_invitations();
  select household_id into home_id from public.household_members where user_id=auth.uid() order by household_id limit 1;
  if home_id is null then
    insert into public.households(name) values('Mit hjem') returning id into home_id;
    insert into public.household_members(household_id,user_id) values(home_id,auth.uid());
  end if;
  return home_id;
end $$;
revoke all on function public.ensure_my_household() from public, anon;
grant execute on function public.ensure_my_household() to authenticated;
commit;
