-- Public Energinet source records only. No users, addresses, tokens or readings.
create table public.public_energy_source_cache (
 cache_key text primary key check (cache_key ~ '^energinet-v1:(tariffs|spot:[0-9]{4}-[0-9]{2})$'),
 payload jsonb,
 fetched_at timestamptz,
 lease_id uuid,
 lease_until timestamptz
);
create table public.public_energy_source_versions (
 cache_key text not null,
 content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
 payload jsonb not null,
 observed_at timestamptz not null default now(),
 primary key(cache_key,content_hash)
);
alter table public.public_energy_source_cache enable row level security;
alter table public.public_energy_source_versions enable row level security;
revoke all on public.public_energy_source_cache,public.public_energy_source_versions from public,anon,authenticated;
grant select on public.public_energy_source_cache,public.public_energy_source_versions to service_role;

create function public.claim_public_energy_refresh(p_key text,p_lease uuid,p_after timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 if p_key !~ '^energinet-v1:(tariffs|spot:[0-9]{4}-[0-9]{2})$' or p_lease is null or p_after is null or p_after>now() then
  raise exception 'Invalid public energy cache request';
 end if;
 insert into public.public_energy_source_cache(cache_key) values(p_key) on conflict do nothing;
 update public.public_energy_source_cache set lease_id=p_lease,lease_until=now()+interval '60 seconds'
 where cache_key=p_key and (fetched_at is null or fetched_at<p_after) and (lease_until is null or lease_until<now());
 return found;
end $$;
create function public.finish_public_energy_refresh(p_key text,p_lease uuid,p_hash text,p_payload jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 if p_hash !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_payload)!='array' or octet_length(p_payload::text)>8000000 then
  raise exception 'Invalid public energy payload';
 end if;
 update public.public_energy_source_cache set payload=p_payload,fetched_at=now(),lease_id=null,lease_until=null
 where cache_key=p_key and lease_id=p_lease and lease_until>now();
 if not found then return false; end if;
 insert into public.public_energy_source_versions(cache_key,content_hash,payload) values(p_key,p_hash,p_payload) on conflict do nothing;
 return true;
end $$;
revoke all on function public.claim_public_energy_refresh(text,uuid,timestamptz),public.finish_public_energy_refresh(text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.claim_public_energy_refresh(text,uuid,timestamptz),public.finish_public_energy_refresh(text,uuid,text,jsonb) to service_role;
