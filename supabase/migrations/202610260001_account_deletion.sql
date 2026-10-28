begin;

-- A departing key creator must not destroy a remaining household's archive.
-- Encryption AAD is household-bound, not creator-bound.
alter table public.energy_vault_managed_keys alter column created_by drop not null;
alter table public.energy_vault_managed_keys drop constraint energy_vault_managed_keys_created_by_fkey;
alter table public.energy_vault_managed_keys add constraint energy_vault_managed_keys_created_by_fkey
 foreign key(created_by) references auth.users(id) on delete set null;

create table public.account_deletion_choices (
 user_id uuid primary key references auth.users(id) on delete cascade,
 successors jsonb not null default '{}'::jsonb check(jsonb_typeof(successors)='object' and octet_length(successors::text)<8000),
 requested_at timestamptz not null default now()
);
alter table public.account_deletion_choices enable row level security;
revoke all on public.account_deletion_choices from public,anon,authenticated;
grant select,insert,update,delete on public.account_deletion_choices to service_role;

-- GoTrue's normal hard-delete executes this in the same transaction as Auth
-- removal. Failure rolls back ALL cleanup, including shared-household changes.
create function public.cleanup_deleted_account() returns trigger
language plpgsql security definer set search_path='' as $$
declare choices jsonb; home record; replacement uuid; others integer;
begin
 select successors into choices from public.account_deletion_choices
 where user_id=old.id and requested_at>now()-interval '10 minutes' for update;
 if choices is null then
  raise exception 'Prepare account deletion first' using errcode='42501';
 end if;
 for home in select h.id,m.family_role from public.households h
 join public.household_members m on m.household_id=h.id
 where m.user_id=old.id order by h.id for update of h loop
  select count(*) into others from public.household_members where household_id=home.id and user_id<>old.id;
  if others=0 then
   delete from public.households where id=home.id;
  elsif home.family_role='owner' and not exists(
   select 1 from public.household_members where household_id=home.id and user_id<>old.id and family_role='owner'
  ) then
   begin replacement:=(choices->>home.id::text)::uuid;
   exception when invalid_text_representation then raise exception 'Invalid successor' using errcode='22023'; end;
   if replacement is null or replacement=old.id or not exists(
    select 1 from public.household_members where household_id=home.id and user_id=replacement
   ) then raise exception 'Choose a remaining household owner' using errcode='22023'; end if;
   update public.household_members set family_role='owner' where household_id=home.id and user_id=replacement;
  end if;
 end loop;
 -- Do not turn authored invitations into legacy auto-accepted invitations.
 delete from public.household_invitations where created_by=old.id or email=lower(old.email);
 -- User-scoped provider connections, sessions and membership follow their FKs.
 -- Household-scoped archives remain only when other members still exist.
 return old;
end $$;
revoke all on function public.cleanup_deleted_account() from public,anon,authenticated;
create trigger huslyg_cleanup_deleted_account before delete on auth.users
 for each row execute function public.cleanup_deleted_account();
commit;
