begin;
-- Once encryption is enabled, login alone must no longer reveal old plaintext
-- through the REST API. Operators retain the originals until cleanup is approved.
drop policy agreements_read_member on public.electricity_agreements;
create policy agreements_read_member on public.electricity_agreements for select to authenticated using (
  household_id in (select household_id from public.household_members where user_id=(select auth.uid()))
  and not exists(select 1 from public.energy_vaults v where v.household_id=electricity_agreements.household_id)
);
drop policy meters_read_member on public.electricity_meters;
create policy meters_read_member on public.electricity_meters for select to authenticated using (
  household_id in (select household_id from public.household_members where user_id=(select auth.uid()))
  and not exists(select 1 from public.energy_vaults v where v.household_id=electricity_meters.household_id)
);
drop policy readings_read_member on public.electricity_readings;
create policy readings_read_member on public.electricity_readings for select to authenticated using (
  household_id in (select household_id from public.household_members where user_id=(select auth.uid()))
  and not exists(select 1 from public.energy_vaults v where v.household_id=electricity_readings.household_id)
);
commit;
