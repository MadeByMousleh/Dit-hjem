begin;

create table public.energy_vault_managed_keys (
  household_id uuid primary key references public.households(id) on delete cascade,
  envelope jsonb not null check (
    jsonb_typeof(envelope) = 'object'
    and envelope ?& array['version', 'iv', 'tag', 'ciphertext']
    and envelope->>'version' = '1'
    and jsonb_typeof(envelope->'iv') = 'string'
    and jsonb_typeof(envelope->'tag') = 'string'
    and jsonb_typeof(envelope->'ciphertext') = 'string'
  ),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.energy_vault_managed_keys enable row level security;
revoke all on public.energy_vault_managed_keys from public, anon, authenticated;
grant select, insert, update, delete on public.energy_vault_managed_keys to service_role;

comment on table public.energy_vault_managed_keys is
  'Server-only wrapped household encryption keys. Never expose through PostgREST or client policies.';

commit;
