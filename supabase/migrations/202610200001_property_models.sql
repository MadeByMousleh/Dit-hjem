begin;
create table public.property_models (
 household_id uuid not null references public.households(id) on delete cascade,
 address_id uuid not null,
 revision bigint not null check (revision > 0),
 payload text not null check (octet_length(payload) between 1 and 3900000),
 digest text not null check (digest ~ '^[0-9a-f]{64}$'),
 raw_bytes integer not null check (raw_bytes between 1 and 33554432),
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),
 primary key (household_id,address_id)
);
alter table public.property_models enable row level security;
revoke all on public.property_models from public,anon,authenticated;
grant select on public.property_models to authenticated;
grant all on public.property_models to service_role;
create policy property_models_member_read on public.property_models for select to authenticated
 using (exists(select 1 from public.household_members m where m.household_id=property_models.household_id and m.user_id=auth.uid()));
create function public.save_property_model(p_household uuid,p_address uuid,p_actor uuid,p_expected bigint,p_payload text,p_digest text,p_raw_bytes integer)
 returns bigint language plpgsql security definer set search_path=pg_catalog,public as $$
declare next_revision bigint;
begin
 if p_actor is null or not exists(select 1 from public.household_members where household_id=p_household and user_id=p_actor) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_expected is null or p_expected<0 then raise exception 'Invalid revision' using errcode='22023'; end if;
 -- Serialize creation and replacement; a failed/stale save never replaces the previous model.
 perform pg_advisory_xact_lock(hashtextextended(p_household::text,0));
 select revision into next_revision from public.property_models where household_id=p_household and address_id=p_address;
 if coalesce(next_revision,0)<>p_expected then raise exception 'Model changed' using errcode='40001'; end if;
 if next_revision is null and (select count(*) from public.property_models where household_id=p_household)>=8 then raise exception 'Model quota reached' using errcode='54000'; end if;
 next_revision:=p_expected+1;
 insert into public.property_models(household_id,address_id,revision,payload,digest,raw_bytes,updated_by)
 values(p_household,p_address,next_revision,p_payload,p_digest,p_raw_bytes,p_actor)
 on conflict(household_id,address_id) do update set revision=excluded.revision,payload=excluded.payload,digest=excluded.digest,raw_bytes=excluded.raw_bytes,updated_by=excluded.updated_by,updated_at=now();
 return next_revision;
end; $$;
revoke all on function public.save_property_model(uuid,uuid,uuid,bigint,text,text,integer) from public,anon,authenticated;
grant execute on function public.save_property_model(uuid,uuid,uuid,bigint,text,text,integer) to service_role;
comment on table public.property_models is 'Prepared household property model, gzip/base64. Not energy-vault data. Weather is never stored here.';
commit;
