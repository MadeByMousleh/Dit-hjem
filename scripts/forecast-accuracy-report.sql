-- Run in the cloud Supabase SQL Editor as project administrator.
-- All values below are RAW SPOT øre/kWh. No VAT, tariffs, taxes or supplier markup.
select price_area,capture_day,captured_at,issued_at,target_day,
 starts_at at time zone 'Europe/Copenhagen' as target_danish_time,
 starts_at as target_utc,horizon_days,lead_hours,
 forecast_ore_kwh,actual_ore_kwh,error_ore_kwh,absolute_error_ore_kwh,
 comparison_status,eligible_for_scoring,model_id,source_run_id,actual_revisions
from public.energy_forecast_comparison
where capture_day >= (now() at time zone 'Europe/Copenhagen')::date-30
order by capture_day desc,price_area,starts_at;

select capture_day,target_day,price_area,horizon_days,model_id,
 forecast_hours,scored_hours,pending_hours,excluded_hours,
 mae_ore_kwh,rmse_ore_kwh,bias_ore_kwh,band_coverage
from public.energy_forecast_daily_accuracy
order by capture_day desc,price_area,horizon_days;

select * from public.energy_forecast_accuracy order by price_area,horizon_days,model_id;
select * from public.energy_forecast_audit_health;
