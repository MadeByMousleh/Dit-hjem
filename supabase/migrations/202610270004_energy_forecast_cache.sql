-- Add a separately identified public forecast packet; official spot keys remain unchanged.
alter table public.public_energy_source_cache drop constraint public_energy_source_cache_cache_key_check;
alter table public.public_energy_source_cache add constraint public_energy_source_cache_cache_key_check
 check (cache_key ~ '^(energinet-v1:(tariffs|spot:[0-9]{4}-[0-9]{2})|elpriser-v1:forecast)$');
create or replace function public.claim_public_energy_refresh(p_key text,p_lease uuid,p_after timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 if p_key !~ '^(energinet-v1:(tariffs|spot:[0-9]{4}-[0-9]{2})|elpriser-v1:forecast)$' or p_lease is null or p_after is null or p_after>now() then
  raise exception 'Invalid public energy cache request';
 end if;
 insert into public.public_energy_source_cache(cache_key) values(p_key) on conflict do nothing;
 update public.public_energy_source_cache set lease_id=p_lease,lease_until=now()+interval '60 seconds'
 where cache_key=p_key and (fetched_at is null or fetched_at<p_after) and (lease_until is null or lease_until<now());
 return found;
end $$;
revoke all on function public.claim_public_energy_refresh(text,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_public_energy_refresh(text,uuid,timestamptz) to service_role;
