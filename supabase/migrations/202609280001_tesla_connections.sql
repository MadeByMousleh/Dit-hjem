begin;

-- Tesla credentials are encrypted before they reach this table. They are never
-- readable by a mobile or web client; the authenticated backend is the only
-- component that accesses them.
create table public.tesla_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tokens_ciphertext text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tesla_connections enable row level security;
revoke all on public.tesla_connections from public, anon, authenticated;
grant all on public.tesla_connections to service_role;

commit;
