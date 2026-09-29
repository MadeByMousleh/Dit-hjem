begin;

create table public.tesla_command_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_vin_suffix text not null check (char_length(vehicle_vin_suffix) between 1 and 6),
  action text not null check (action in ('start', 'stop')),
  outcome text not null check (outcome in ('accepted', 'rejected')),
  tesla_status integer,
  message text not null check (char_length(message) <= 500),
  created_at timestamptz not null default now()
);

create index tesla_command_logs_user_created_at_idx on public.tesla_command_logs (user_id, created_at desc);

alter table public.tesla_command_logs enable row level security;
revoke all on public.tesla_command_logs from public, anon, authenticated;
grant all on public.tesla_command_logs to service_role;

commit;
