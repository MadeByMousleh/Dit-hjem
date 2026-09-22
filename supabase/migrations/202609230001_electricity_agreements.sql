begin;
create table public.electricity_agreements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  supplier_id text not null check (length(supplier_id) between 1 and 100),
  supplier_name text not null check (length(trim(supplier_name)) between 1 and 200),
  price_type text not null check (price_type in ('spot', 'fixed')),
  fixed_ore numeric check (fixed_ore between 0 and 1000000),
  markup_ore numeric not null check (markup_ore between 0 and 1000000),
  subscription_dkk numeric not null check (subscription_dkk between 0 and 1000000),
  date_from date not null,
  date_to date,
  created_at timestamptz not null default now(),
  check (date_to is null or date_to > date_from),
  check ((price_type = 'fixed' and fixed_ore is not null) or (price_type = 'spot' and fixed_ore is null)),
  unique(household_id, date_from)
);
-- date_to is exclusive: the replacement owns its start date.
create unique index electricity_agreements_current on public.electricity_agreements(household_id) where date_to is null;
alter table public.electricity_agreements enable row level security;
revoke all on public.electricity_agreements from anon, authenticated;
grant select on public.electricity_agreements to authenticated;
grant all on public.electricity_agreements to service_role;
create policy agreements_read_member on public.electricity_agreements for select to authenticated using (
  household_id in (select household_id from public.household_members where user_id = (select auth.uid()))
);
create function public.save_electricity_agreement(
  p_household uuid, p_expected uuid, p_supplier_id text, p_supplier_name text,
  p_price_type text, p_fixed_ore numeric, p_markup_ore numeric,
  p_subscription_dkk numeric, p_date_from date
) returns setof public.electricity_agreements
language plpgsql security definer set search_path = '' as $$
declare current_plan public.electricity_agreements;
begin
  if not exists(select 1 from public.household_members where household_id=p_household and user_id=auth.uid()) then
    raise exception 'Ingen adgang til husstanden.';
  end if;
  perform 1 from public.households where id=p_household for update;
  select * into current_plan from public.electricity_agreements where household_id=p_household and date_to is null;
  if current_plan.id is distinct from p_expected then
    raise exception 'Aftalen er ændret. Genindlæs siden før du gemmer.';
  end if;
  if p_date_from is null or p_date_from > (now() at time zone 'Europe/Copenhagen')::date then
    raise exception 'Vælg en startdato senest i dag.';
  end if;
  if current_plan.id is not null then
    if row(current_plan.supplier_id,current_plan.supplier_name,current_plan.price_type,current_plan.fixed_ore,current_plan.markup_ore,current_plan.subscription_dkk,current_plan.date_from)
      is not distinct from row(p_supplier_id,trim(p_supplier_name),p_price_type,p_fixed_ore,p_markup_ore,p_subscription_dkk,p_date_from) then
      return query select * from public.electricity_agreements where household_id=p_household order by date_from;
      return;
    end if;
    if p_date_from <= current_plan.date_from then
      raise exception 'En ny aftale skal starte efter den nuværende aftales startdato.';
    end if;
    update public.electricity_agreements set date_to=p_date_from where id=current_plan.id;
  end if;
  insert into public.electricity_agreements(household_id,supplier_id,supplier_name,price_type,fixed_ore,markup_ore,subscription_dkk,date_from)
  values(p_household,p_supplier_id,trim(p_supplier_name),p_price_type,p_fixed_ore,p_markup_ore,p_subscription_dkk,p_date_from);
  return query select * from public.electricity_agreements where household_id=p_household order by date_from;
end $$;
revoke all on function public.save_electricity_agreement(uuid,uuid,text,text,text,numeric,numeric,numeric,date) from public, anon;
grant execute on function public.save_electricity_agreement(uuid,uuid,text,text,text,numeric,numeric,numeric,date) to authenticated;
commit;
