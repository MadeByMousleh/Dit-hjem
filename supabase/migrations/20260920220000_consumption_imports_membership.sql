begin;

-- Invitations are operator-managed; only a confirmed email can claim one.
create table public.household_invitations (
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null check (email = lower(email)),
  primary key (household_id, email)
);
alter table public.household_invitations enable row level security;
revoke all on public.household_invitations from anon, authenticated;
grant all on public.household_invitations to service_role;

create function public.claim_household_invitations() returns void
language sql security definer set search_path = '' as $$
  insert into public.household_members (household_id, user_id)
  select i.household_id, u.id
  from public.household_invitations i join auth.users u on lower(u.email) = i.email
  where u.id = auth.uid() and u.email_confirmed_at is not null
  on conflict do nothing;
$$;
revoke all on function public.claim_household_invitations() from public, anon;
grant execute on function public.claim_household_invitations() to authenticated;

-- Replace a fetched meter/range atomically, including removed/corrected points.
create function public.import_electricity_range(
  p_household uuid, p_meter uuid, p_from date, p_to date,
  p_resolution text, p_fetched timestamptz, p_complete boolean, p_readings jsonb
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.electricity_meters where id=p_meter and household_id=p_household for update;
  if not found then raise exception 'Unknown household meter'; end if;
  if p_to <= p_from then raise exception 'Invalid range'; end if;
  -- A slower concurrent fetch must not overwrite a newer response.
  if exists (select 1 from public.electricity_sync_ranges where meter_id=p_meter
    and resolution=p_resolution and date_from < p_to and date_to > p_from and fetched_at > p_fetched)
    then return; end if;
  delete from public.electricity_readings where meter_id=p_meter and resolution=p_resolution
    and starts_at >= (p_from::timestamp at time zone 'Europe/Copenhagen')
    and starts_at < (p_to::timestamp at time zone 'Europe/Copenhagen');
  insert into public.electricity_readings(household_id,meter_id,starts_at,ends_at,resolution,kwh,quality,fetched_at)
    select p_household,p_meter,r.starts_at,r.ends_at,p_resolution,r.kwh,r.quality,p_fetched
    from jsonb_to_recordset(p_readings) as r(starts_at timestamptz,ends_at timestamptz,kwh numeric,quality text)
    where r.starts_at >= (p_from::timestamp at time zone 'Europe/Copenhagen')
      and r.starts_at < (p_to::timestamp at time zone 'Europe/Copenhagen');
  insert into public.electricity_sync_ranges(household_id,meter_id,date_from,date_to,resolution,fetched_at,complete)
    values(p_household,p_meter,p_from,p_to,p_resolution,p_fetched,p_complete)
    on conflict(meter_id,date_from,date_to,resolution) do update set fetched_at=excluded.fetched_at,complete=excluded.complete;
end;
$$;
revoke all on function public.import_electricity_range(uuid,uuid,date,date,text,timestamptz,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.import_electricity_range(uuid,uuid,date,date,text,timestamptz,boolean,jsonb) to service_role;
commit;
