begin;

-- Preserve provider IDs exactly. UUID-only storage rejects real active grants.
-- This conversion retains every existing value, row, unique constraint and ACL.
alter table public.eloverblik_third_party_connections
  alter column authorization_id type text using authorization_id::text;
alter table public.eloverblik_third_party_connections
  add constraint eloverblik_authorization_id_format
  check (length(authorization_id) between 1 and 200 and authorization_id !~ '[[:space:][:cntrl:]]');

-- Replace the UUID signature instead of adding an ambiguous PostgREST overload.
drop function public.consume_eloverblik_authorization(uuid, uuid, text, uuid);
create function public.consume_eloverblik_authorization(
  p_user uuid, p_household uuid, p_customer_key_hash text, p_authorization text
) returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists (select 1 from public.household_members where household_id=p_household and user_id=p_user) then
    raise exception 'household_access_denied';
  end if;
  delete from public.eloverblik_authorization_attempts
    where customer_key_hash=p_customer_key_hash and user_id=p_user and household_id=p_household and expires_at > now();
  if not found then raise exception 'authorization_attempt_missing'; end if;
  insert into public.eloverblik_third_party_connections(household_id,user_id,authorization_id,connected_at,updated_at)
    values(p_household,p_user,p_authorization,now(),now())
    on conflict (household_id) do update set user_id=excluded.user_id, authorization_id=excluded.authorization_id, updated_at=now();
end;
$$;
revoke all on function public.consume_eloverblik_authorization(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.consume_eloverblik_authorization(uuid,uuid,text,text) to service_role;

notify pgrst, 'reload schema';
commit;
