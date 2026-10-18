begin;

create table public.electricity_period_records (
  household_id uuid not null references public.households(id) on delete cascade,
  record_key text not null check (record_key = 'state/import' or record_key ~ '^(hour/[0-9]{4}-[0-9]{2}-[0-9]{2}|day/[0-9]{4}-[0-9]{2}|(month|year)/[0-9]{4})$'),
  revision integer not null check (revision > 0),
  envelope jsonb not null check (coalesce(
    jsonb_typeof(envelope) = 'object' and envelope ?& array['format','nonce','ciphertext']
    and envelope->>'format' = 'stromblik-xchacha20poly1305-v1'
    and envelope->>'nonce' ~ '^[a-f0-9]{48}$'
    and envelope->>'ciphertext' ~ '^[a-f0-9]+$'
    and length(envelope->>'ciphertext') between 32 and 262144
    and length(envelope->>'ciphertext') % 2 = 0
  , false)),
  updated_at timestamptz not null default now(),
  primary key (household_id, record_key)
);
create table public.electricity_period_versions (
  household_id uuid not null references public.households(id) on delete cascade,
  record_key text not null,
  revision integer not null,
  envelope jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (household_id, record_key, revision)
);
create table public.electricity_record_usage (
  household_id uuid primary key references public.households(id) on delete cascade,
  stored_bytes bigint not null default 0 check (stored_bytes >= 0),
  version_count integer not null default 0 check (version_count >= 0),
  record_count integer not null default 0 check (record_count >= 0)
);
alter table public.electricity_record_usage enable row level security;
revoke all on public.electricity_record_usage from public,anon,authenticated,service_role;
grant select on public.electricity_record_usage to service_role;
alter table public.electricity_period_records enable row level security;
alter table public.electricity_period_versions enable row level security;
revoke all on public.electricity_period_records, public.electricity_period_versions from public, anon, authenticated, service_role;
grant select on public.electricity_period_records, public.electricity_period_versions to authenticated, service_role;
create policy electricity_records_member_read on public.electricity_period_records for select to authenticated using (
  household_id in (select household_id from public.household_members where user_id=(select auth.uid()))
);
create policy electricity_versions_member_read on public.electricity_period_versions for select to authenticated using (
  household_id in (select household_id from public.household_members where user_id=(select auth.uid()))
);

-- Only the signature-verifying server gateway can execute this. No new key
-- enrollment/reset path: records require the existing pinned vault writer.
create function public.commit_electricity_period_records(p_user uuid, p_household uuid, p_public_key text, p_records jsonb)
returns setof public.electricity_period_records
language plpgsql security definer set search_path='' as $$
declare item jsonb; expected integer; current_revision integer; pinned text; record_id text;
  bytes_delta bigint := 0; records_delta integer := 0; old_bytes integer; new_bytes integer;
begin
  if p_user is null or p_household is null or p_public_key is null or p_public_key !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) not between 1 and 40
    or octet_length(p_records::text) > 4194304 then raise exception 'Invalid record write' using errcode='22023'; end if;
  perform 1 from public.households where id=p_household for update;
  perform 1 from public.household_members where household_id=p_household and user_id=p_user for share;
  if not found then raise exception 'No household access' using errcode='42501'; end if;
  select public_key into pinned from public.energy_vault_writers where household_id=p_household;
  if pinned is null then raise exception 'legacy_write_locked'; end if;
  if pinned is distinct from p_public_key then raise exception 'writer_key_mismatch'; end if;
  insert into public.electricity_record_usage(household_id) values(p_household) on conflict do nothing;
  if (select count(distinct value->>'recordKey') from jsonb_array_elements(p_records)) <> jsonb_array_length(p_records) then
    raise exception 'Duplicate record key' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(p_records) loop
    record_id := item->>'recordKey';
    expected := (item->>'expectedRevision')::integer;
    if record_id is null or expected is null or expected < 0 or expected >= 2147483647 then raise exception 'Invalid record context' using errcode='22023'; end if;
    select revision,octet_length(envelope::text) into current_revision,old_bytes from public.electricity_period_records where household_id=p_household and record_key=record_id;
    if coalesce(current_revision,0) is distinct from expected then raise exception 'electricity_revision_conflict'; end if;
    new_bytes := octet_length((item->'envelope')::text);
    bytes_delta := bytes_delta + 2 * new_bytes - coalesce(old_bytes,0);
    if current_revision is null then records_delta := records_delta + 1; end if;
    insert into public.electricity_period_records(household_id,record_key,revision,envelope)
      values(p_household,record_id,expected+1,item->'envelope')
      on conflict(household_id,record_key) do update set revision=excluded.revision,envelope=excluded.envelope,updated_at=now();
    insert into public.electricity_period_versions(household_id,record_key,revision,envelope)
      values(p_household,record_id,expected+1,item->'envelope');
  end loop;
  update public.electricity_record_usage set stored_bytes=stored_bytes+bytes_delta,
    version_count=version_count+jsonb_array_length(p_records),record_count=record_count+records_delta
    where household_id=p_household;
  if exists(select 1 from public.electricity_record_usage where household_id=p_household and
    (stored_bytes > 268435456 or version_count > 100000 or record_count > 50000)) then raise exception 'electricity_storage_limit'; end if;
  return query select r.* from public.electricity_period_records r
    where r.household_id=p_household and r.record_key in (select value->>'recordKey' from jsonb_array_elements(p_records));
end $$;
revoke all on function public.commit_electricity_period_records(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.commit_electricity_period_records(uuid,uuid,text,jsonb) to service_role;
comment on table public.electricity_period_records is 'Encrypted electricity periods; dates/kinds/revisions are visible metadata, consumption and meter identities remain encrypted. No client writes; existing pinned-writer gateway only.';
notify pgrst, 'reload schema';
commit;
