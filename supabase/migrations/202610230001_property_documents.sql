begin;
create table public.property_documents (
 household_id uuid not null references public.households(id) on delete cascade,
 address_id uuid not null,
 id uuid not null,
 revision bigint not null check(revision>0),
 name text not null check(length(name) between 1 and 120),
 mime text not null check(mime in ('application/pdf','image/jpeg','image/png')),
 payload text check(octet_length(payload) between 1 and 2796204),
 updated_at timestamptz not null default now(),
 primary key(household_id,address_id,id)
);
alter table public.property_documents enable row level security;
revoke all on public.property_documents from public,anon,authenticated;
grant select on public.property_documents to authenticated;
grant all on public.property_documents to service_role;
create policy property_documents_member_read on public.property_documents for select to authenticated
 using(exists(select 1 from public.household_members m where m.household_id=property_documents.household_id and m.user_id=auth.uid()));
create function public.save_property_document(p_household uuid,p_address uuid,p_id uuid,p_actor uuid,p_expected bigint,p_name text,p_mime text,p_payload text)
 returns bigint language plpgsql security definer set search_path=pg_catalog,public as $$
declare current_revision bigint; total_bytes bigint;
begin
 if p_actor is null or not exists(select 1 from public.household_members where household_id=p_household and user_id=p_actor) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_expected is null or p_expected<0 then raise exception 'Invalid revision' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_household::text,0));
 select revision into current_revision from public.property_documents where household_id=p_household and address_id=p_address and id=p_id;
 if coalesce(current_revision,0)<>p_expected then raise exception 'Document changed' using errcode='40001'; end if;
 if p_payload is null and current_revision is null then raise exception 'Document missing' using errcode='22023'; end if;
 if p_payload is not null then
  if current_revision is null and (select count(*) from public.property_documents where household_id=p_household)>=200 then raise exception 'Document quota' using errcode='54000'; end if;
  if (select count(*) from public.property_documents where household_id=p_household and payload is not null and (address_id,id)<>(p_address,p_id))>=20 then raise exception 'Document quota' using errcode='54000'; end if;
  select coalesce(sum(octet_length(payload)),0)+octet_length(p_payload) into total_bytes from public.property_documents where household_id=p_household and (address_id,id)<>(p_address,p_id);
  if total_bytes>33554432 then raise exception 'Document quota' using errcode='54000'; end if;
 end if;
 insert into public.property_documents(household_id,address_id,id,revision,name,mime,payload)
 values(p_household,p_address,p_id,p_expected+1,p_name,p_mime,p_payload)
 on conflict(household_id,address_id,id) do update set revision=excluded.revision,name=excluded.name,mime=excluded.mime,payload=excluded.payload,updated_at=now();
 return p_expected+1;
end; $$;
revoke all on function public.save_property_document(uuid,uuid,uuid,uuid,bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.save_property_document(uuid,uuid,uuid,uuid,bigint,text,text,text) to service_role;
comment on table public.property_documents is 'Private household floor plans, base64 PDF/JPEG/PNG. Not energy-vault encryption. Null payload is a deletion tombstone.';
commit;
