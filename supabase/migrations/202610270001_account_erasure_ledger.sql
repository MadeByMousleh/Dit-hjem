begin;
-- Minimal, server-only evidence needed to prevent old backups from restoring
-- erased accounts. Hashes/household IDs remain personal metadata, not anonymous.
create table public.account_erasure_ledger (
 user_hash text primary key check(user_hash~'^[a-f0-9]{64}$'),
 deleted_at timestamptz not null default now(),
 deleted_households uuid[] not null default '{}',
 successors jsonb not null check(jsonb_typeof(successors)='object')
);
alter table public.account_erasure_ledger enable row level security;
revoke all on public.account_erasure_ledger from public,anon,authenticated,service_role;
grant select on public.account_erasure_ledger to service_role;

create or replace function public.cleanup_deleted_account() returns trigger
language plpgsql security definer set search_path='' as $$
declare choices jsonb; home record; replacement uuid; others integer; removed uuid[]:='{}';
begin
 select successors into choices from public.account_deletion_choices
 where user_id=old.id and requested_at>now()-interval '10 minutes' for update;
 if choices is null then raise exception 'Prepare account deletion first' using errcode='42501'; end if;
 for home in select h.id,m.family_role from public.households h
 join public.household_members m on m.household_id=h.id
 where m.user_id=old.id order by h.id for update of h loop
  select count(*) into others from public.household_members where household_id=home.id and user_id<>old.id;
  if others=0 then
   removed:=array_append(removed,home.id);
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
 delete from public.household_invitations where created_by=old.id or email=lower(old.email);
 insert into public.account_erasure_ledger(user_hash,deleted_households,successors)
 values(encode(sha256(convert_to(old.id::text,'UTF8')),'hex'),removed,choices)
 on conflict(user_hash) do update set deleted_at=now(),
  deleted_households=(select coalesce(array_agg(distinct item),'{}'::uuid[]) from unnest(account_erasure_ledger.deleted_households||excluded.deleted_households) item),
  successors=account_erasure_ledger.successors||excluded.successors;
 return old;
end $$;
revoke all on function public.cleanup_deleted_account() from public,anon,authenticated;
commit;
