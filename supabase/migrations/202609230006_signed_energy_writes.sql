begin;
lock table public.energy_vaults in share row exclusive mode;

create table public.energy_vault_writers (
  household_id uuid primary key references public.households(id) on delete cascade,
  public_key text not null check (public_key ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
alter table public.energy_vault_writers enable row level security;
revoke all on public.energy_vault_writers from public, anon, authenticated, service_role;
grant select on public.energy_vault_writers to authenticated, service_role;
create policy vault_writer_member_read on public.energy_vault_writers for select to authenticated using (
  household_id in (select household_id from public.household_members where user_id=(select auth.uid()))
);

-- Remove the old login-only path, including implicit PUBLIC execute privileges.
-- Retain a tombstone rather than an accidentally reusable unsigned implementation.
create or replace function public.save_energy_vault(p_household uuid,p_expected integer,p_envelope jsonb,p_legacy_digest text default null)
returns setof public.energy_vaults language plpgsql security definer set search_path='' as $$
begin
  raise exception 'Signed writes are required' using errcode='42501';
end $$;
revoke all on function public.save_energy_vault(uuid,integer,jsonb,text) from public,anon,authenticated,service_role;
revoke insert,update,delete,truncate,references,trigger on public.energy_vaults from service_role;

-- TRUST BOUNDARY: only the server gateway calls this after JWT + Ed25519
-- verification. SQL does not verify signatures. A service secret remains a
-- privileged credential, not part of the login-only attacker model.
create function public.commit_signed_energy_vault(
  p_user uuid, p_household uuid, p_expected integer, p_envelope jsonb,
  p_public_key text, p_legacy_digest text default null
) returns setof public.energy_vaults
language plpgsql security definer set search_path='' as $$
declare current_revision integer; pinned_key text; payload jsonb;
begin
  if p_user is null or p_household is null or p_expected is null or p_expected < 0 or p_expected >= 2147483647
    or p_public_key is null or p_public_key !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid write context' using errcode='22023';
  end if;
  perform 1 from public.households where id=p_household for update;
  -- Hold the membership row through commit so revocation cannot race this check.
  perform 1 from public.household_members where household_id=p_household and user_id=p_user for share;
  if not found then raise exception 'No household access' using errcode='42501'; end if;
  select revision into current_revision from public.energy_vaults where household_id=p_household;
  select public_key into pinned_key from public.energy_vault_writers where household_id=p_household;
  if current_revision is not null and pinned_key is null then
    -- No first-login-wins upgrade of existing encrypted history. Read access is
    -- unchanged; a separately reviewed trusted migration ceremony is required.
    raise exception 'legacy_write_locked';
  end if;
  if pinned_key is not null and pinned_key <> p_public_key then raise exception 'writer_key_mismatch'; end if;
  if coalesce(current_revision,0) is distinct from p_expected then raise exception 'vault_revision_conflict'; end if;
  if current_revision is null then
    -- Same canonical snapshot as export_energy_for_encryption. Server sees only
    -- legacy data it already held; fresh client measurements remain encrypted.
    select jsonb_build_object('version',1,
      'agreements',coalesce((select jsonb_agg(to_jsonb(a) order by a.date_from) from public.electricity_agreements a where a.household_id=p_household),'[]'::jsonb),
      'meters',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'metering_point_id',m.metering_point_id) order by m.id) from public.electricity_meters m where m.household_id=p_household),'[]'::jsonb),
      'readings',coalesce((select jsonb_agg(jsonb_build_object('meter_id',r.meter_id,'starts_at',r.starts_at,'ends_at',r.ends_at,'kwh',r.kwh,'resolution',r.resolution) order by r.meter_id,r.starts_at,r.resolution) from public.electricity_readings r where r.household_id=p_household),'[]'::jsonb)
    ) into payload;
    if octet_length(payload::text)>30000000 then raise exception 'Legacy history too large'; end if;
    if md5(payload::text) is distinct from p_legacy_digest then raise exception 'legacy_snapshot_changed'; end if;
    insert into public.energy_vault_writers(household_id,public_key) values(p_household,p_public_key);
  elsif p_legacy_digest is not null then
    raise exception 'Unexpected legacy digest' using errcode='22023';
  end if;
  insert into public.energy_vaults(household_id,revision,envelope) values(p_household,p_expected+1,p_envelope)
  on conflict(household_id) do update set revision=excluded.revision,envelope=excluded.envelope,updated_at=now();
  return query select * from public.energy_vaults where household_id=p_household;
end $$;
revoke all on function public.commit_signed_energy_vault(uuid,uuid,integer,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.commit_signed_energy_vault(uuid,uuid,integer,jsonb,text,text) to service_role;

comment on table public.energy_vault_writers is 'Pinned Ed25519 public key only. No client registration/rotation path for existing vaults; those without a key remain write-locked.';
commit;
