begin;

-- OAuth tokens are encrypted by the application server before storage. Mobile
-- and web clients have no privileges on this table.
create table public.smartthings_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tokens_ciphertext text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.smartthings_connections enable row level security;
revoke all on public.smartthings_connections from public, anon, authenticated;
grant all on public.smartthings_connections to service_role;

commit;
