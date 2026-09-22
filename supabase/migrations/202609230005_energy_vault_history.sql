begin;

-- Serialize the backfill with saves: no current snapshot can fall between the
-- copy and trigger installation. This migration never deletes existing data.
lock table public.energy_vaults in share row exclusive mode;

create table public.energy_vault_versions (
  household_id uuid not null references public.households(id) on delete cascade,
  revision integer not null check (revision > 0),
  envelope jsonb not null,
  saved_at timestamptz not null,
  stored_bytes bigint generated always as (octet_length(envelope::text)) stored,
  primary key (household_id, revision)
);
alter table public.energy_vault_versions enable row level security;
revoke all on public.energy_vault_versions from public, anon, authenticated, service_role;
grant select on public.energy_vault_versions to authenticated, service_role;
create policy vault_versions_member_read on public.energy_vault_versions
for select to authenticated using (
  household_id in (select household_id from public.household_members where user_id=(select auth.uid()))
);

insert into public.energy_vault_versions (household_id, revision, envelope, saved_at)
select household_id, revision, envelope, updated_at from public.energy_vaults;

create function public.archive_energy_vault_version() returns trigger
language plpgsql security definer set search_path='' as $$
declare retained_bytes bigint; retained_count bigint;
begin
  select coalesce(sum(stored_bytes),0), count(*) into retained_bytes, retained_count
  from public.energy_vault_versions where household_id=new.household_id;
  -- Fail closed instead of growing without bound or deleting recovery points.
  if retained_count >= 1000 or retained_bytes + octet_length(new.envelope::text) > 268435456 then
    raise exception 'Versionsarkivet er fuldt. Intet er overskrevet. Kontakt support for sikker håndtering af arkivet.';
  end if;
  -- Runs in the same transaction as save_energy_vault. If archiving fails,
  -- the head update also rolls back. No caller can replace an older version.
  insert into public.energy_vault_versions (household_id, revision, envelope, saved_at)
  values (new.household_id, new.revision, new.envelope, new.updated_at);
  return new;
end $$;
revoke all on function public.archive_energy_vault_version() from public, anon, authenticated, service_role;
create trigger archive_energy_vault_version
after insert or update on public.energy_vaults
for each row execute function public.archive_energy_vault_version();

comment on table public.energy_vault_versions is
  'Client-immutable ciphertext history, maximum 1000 snapshots / 256 MiB JSON per household. No automatic pruning. Full archives reject saves including recovery saves. Retention/account deletion requires a separate privileged procedure. Does not prevent login-only writes to the current vault.';

commit;
