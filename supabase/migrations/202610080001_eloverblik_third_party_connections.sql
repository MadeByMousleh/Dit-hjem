begin;

-- The third-party refresh token stays only in server configuration.  These
-- rows bind a granted authorization to one signed-in user and household.
create table public.eloverblik_authorization_attempts (
  customer_key_hash text primary key check (customer_key_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index eloverblik_attempts_user_household_idx on public.eloverblik_authorization_attempts(user_id, household_id);

create table public.eloverblik_third_party_connections (
  household_id uuid primary key references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  authorization_id uuid not null unique,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.eloverblik_authorization_attempts enable row level security;
alter table public.eloverblik_third_party_connections enable row level security;
revoke all on public.eloverblik_authorization_attempts, public.eloverblik_third_party_connections from public, anon, authenticated;
grant all on public.eloverblik_authorization_attempts, public.eloverblik_third_party_connections to service_role;

create function public.consume_eloverblik_authorization(
  p_user uuid, p_household uuid, p_customer_key_hash text, p_authorization uuid
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
revoke all on function public.consume_eloverblik_authorization(uuid,uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.consume_eloverblik_authorization(uuid,uuid,text,uuid) to service_role;

commit;
