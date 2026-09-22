begin;
create table public.energy_vaults (
  household_id uuid primary key references public.households(id) on delete cascade,
  revision integer not null check(revision > 0),
  envelope jsonb not null check (coalesce((
    envelope->>'format' = 'stromblik-xchacha20poly1305-v1'
    and envelope->>'nonce' ~ '^[a-f0-9]{48}$'
    and length(envelope->>'ciphertext') between 32 and 67108864
    and envelope->>'ciphertext' ~ '^([a-f0-9]{2})+$'
    and jsonb_typeof(envelope->'format')='string'
    and jsonb_typeof(envelope->'nonce')='string'
    and jsonb_typeof(envelope->'ciphertext')='string'
    and envelope ?& array['format','nonce','ciphertext']
  ),false)),
  updated_at timestamptz not null default now()
);
alter table public.energy_vaults enable row level security;
revoke all on public.energy_vaults from public,anon,authenticated;
grant select on public.energy_vaults to authenticated;
grant all on public.energy_vaults to service_role;
create policy vault_member_read on public.energy_vaults for select to authenticated using(
  household_id in (select household_id from public.household_members where user_id=(select auth.uid()))
);
create function public.export_energy_for_encryption(p_household uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare payload jsonb;
begin
  if not exists(select 1 from public.household_members where household_id=p_household and user_id=auth.uid()) then raise exception 'Ingen adgang til husstanden.'; end if;
  perform 1 from public.households where id=p_household for update;
  if exists(select 1 from public.energy_vaults where household_id=p_household) then raise exception 'Historikken er allerede overført.'; end if;
  select jsonb_build_object('version',1,
    'agreements',coalesce((select jsonb_agg(to_jsonb(a) order by a.date_from) from public.electricity_agreements a where a.household_id=p_household),'[]'::jsonb),
    'meters',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'metering_point_id',m.metering_point_id) order by m.id) from public.electricity_meters m where m.household_id=p_household),'[]'::jsonb),
    'readings',coalesce((select jsonb_agg(jsonb_build_object('meter_id',r.meter_id,'starts_at',r.starts_at,'ends_at',r.ends_at,'kwh',r.kwh,'resolution',r.resolution) order by r.meter_id,r.starts_at,r.resolution) from public.electricity_readings r where r.household_id=p_household),'[]'::jsonb)
  ) into payload;
  if octet_length(payload::text)>30000000 then raise exception 'Historikken kræver en opdelt overførsel. Intet er ændret.'; end if;
  -- Digest is a concurrency marker, not a cryptographic protection of the data.
  return jsonb_build_object('payload',payload,'digest',md5(payload::text));
end $$;
revoke all on function public.export_energy_for_encryption(uuid) from public,anon;
grant execute on function public.export_energy_for_encryption(uuid) to authenticated;

create function public.save_energy_vault(p_household uuid,p_expected integer,p_envelope jsonb,p_legacy_digest text default null)
returns setof public.energy_vaults language plpgsql security definer set search_path='' as $$
declare current_revision integer;
begin
  if not exists(select 1 from public.household_members where household_id=p_household and user_id=auth.uid()) then
    raise exception 'Ingen adgang til husstanden.';
  end if;
  perform 1 from public.households where id=p_household for update;
  select revision into current_revision from public.energy_vaults where household_id=p_household;
  if coalesce(current_revision,0) is distinct from p_expected then
    raise exception 'En anden enhed har gemt ændringer. Synkroniser og prøv igen.';
  end if;
  if current_revision is null and (public.export_energy_for_encryption(p_household)->>'digest') is distinct from p_legacy_digest then
    raise exception 'Historikken er ændret under overførslen. Prøv igen; intet er slettet.';
  end if;
  insert into public.energy_vaults(household_id,revision,envelope) values(p_household,p_expected+1,p_envelope)
  on conflict(household_id) do update set revision=excluded.revision,envelope=excluded.envelope,updated_at=now();
  return query select * from public.energy_vaults where household_id=p_household;
end $$;
revoke all on function public.save_energy_vault(uuid,integer,jsonb,text) from public,anon;
grant execute on function public.save_energy_vault(uuid,integer,jsonb,text) to authenticated;

-- Once enrolled, even old clients/import jobs must not write fresh plaintext.
-- Existing rows remain for verified migration and separately approved cleanup.
create function public.reject_unencrypted_energy_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  target := case when tg_op='DELETE' then old.household_id else new.household_id end;
  perform 1 from public.households where id=target for update;
  if exists(select 1 from public.energy_vaults where household_id=target) then
    raise exception 'Denne husstand bruger krypteret lagring i appen.';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function public.reject_unencrypted_energy_write() from public,anon,authenticated;
create trigger agreements_require_encryption before insert or update or delete on public.electricity_agreements for each row execute function public.reject_unencrypted_energy_write();
create trigger readings_require_encryption before insert or update or delete on public.electricity_readings for each row execute function public.reject_unencrypted_energy_write();
create trigger meters_require_encryption before insert or update or delete on public.electricity_meters for each row execute function public.reject_unencrypted_energy_write();
commit;
