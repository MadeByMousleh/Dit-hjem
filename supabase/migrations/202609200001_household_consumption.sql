-- Provisioning and imports are backend-only. Users can read only households
-- to which the backend has explicitly granted membership.
begin;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (household_id, user_id)
);
create index household_members_user_id_idx on public.household_members(user_id);

create table public.electricity_meters (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  metering_point_id text not null check (metering_point_id ~ '^[0-9]{18}$'),
  unique (household_id, metering_point_id),
  unique (id, household_id)
);

create table public.electricity_readings (
  household_id uuid not null,
  meter_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  resolution text not null check (resolution in ('quarter', 'hour', 'day', 'month', 'year')),
  kwh numeric(18,6) check (kwh >= 0),
  quality text,
  fetched_at timestamptz not null default now(),
  primary key (meter_id, starts_at, resolution),
  foreign key (meter_id, household_id) references public.electricity_meters(id, household_id) on delete cascade,
  check (ends_at > starts_at)
);
create index electricity_readings_household_period_idx
  on public.electricity_readings(household_id, resolution, starts_at);

-- Records fetched ranges even when Eloverblik returned no measurements.
-- Recent/incomplete ranges can be refreshed without re-importing all history.
create table public.electricity_sync_ranges (
  household_id uuid not null,
  meter_id uuid not null,
  date_from date not null,
  date_to date not null,
  resolution text not null check (resolution in ('quarter', 'hour', 'day', 'month', 'year')),
  fetched_at timestamptz not null default now(),
  complete boolean not null default false,
  primary key (meter_id, date_from, date_to, resolution),
  foreign key (meter_id, household_id) references public.electricity_meters(id, household_id) on delete cascade,
  check (date_to > date_from)
);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.electricity_meters enable row level security;
alter table public.electricity_readings enable row level security;
alter table public.electricity_sync_ranges enable row level security;

revoke all on public.households, public.household_members,
  public.electricity_meters, public.electricity_readings,
  public.electricity_sync_ranges from anon, authenticated;
grant select on public.households, public.household_members,
  public.electricity_meters, public.electricity_readings to authenticated;
grant all on public.households, public.household_members,
  public.electricity_meters, public.electricity_readings,
  public.electricity_sync_ranges to service_role;

create policy membership_read_self on public.household_members
  for select to authenticated using (user_id = (select auth.uid()));
create policy household_read_member on public.households
  for select to authenticated using (
    id in (select household_id from public.household_members where user_id = (select auth.uid()))
  );
create policy meters_read_member on public.electricity_meters
  for select to authenticated using (
    household_id in (select household_id from public.household_members where user_id = (select auth.uid()))
  );
create policy readings_read_member on public.electricity_readings
  for select to authenticated using (
    household_id in (select household_id from public.household_members where user_id = (select auth.uid()))
  );

commit;
