begin;

create table public.heating_connections (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider = 'sonderborg-varme'),
  credentials_envelope jsonb not null check (
    jsonb_typeof(credentials_envelope) = 'object'
    and credentials_envelope ?& array['version', 'iv', 'tag', 'ciphertext']
    and credentials_envelope->>'version' = '1'
    and jsonb_typeof(credentials_envelope->'iv') = 'string'
    and jsonb_typeof(credentials_envelope->'tag') = 'string'
    and jsonb_typeof(credentials_envelope->'ciphertext') = 'string'
  ),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

alter table public.heating_connections enable row level security;
revoke all on public.heating_connections from public, anon, authenticated;
grant select, insert, update, delete on public.heating_connections to service_role;

comment on table public.heating_connections is
  'Server-only encrypted eForsyning credentials. Never expose through PostgREST or client policies.';

commit;
