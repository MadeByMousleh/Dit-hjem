begin;
create table public.energy_forecast_capture_runs (
 id uuid primary key default gen_random_uuid(),
 source text not null default 'elpriser-v1' check(source='elpriser-v1'),
 capture_day date not null,
 captured_at timestamptz not null,
 generated_at timestamptz not null,
 point_count integer not null check(point_count between 1 and 400),
 metadata jsonb not null check(jsonb_typeof(metadata)='object' and octet_length(metadata::text)<100000),
 unique(source,capture_day)
);
create table public.energy_forecast_predictions (
 capture_id uuid not null references public.energy_forecast_capture_runs(id),
 price_area text not null check(price_area in ('DK1','DK2')),
 starts_at timestamptz not null,
 issued_at timestamptz not null,
 model_id text not null check(length(model_id) between 1 and 150),
 source_run_id text not null check(length(source_run_id) between 1 and 100),
 predicted_dkk_mwh numeric not null check(predicted_dkk_mwh::text not in ('NaN','Infinity','-Infinity')),
 p10_dkk_mwh numeric not null check(p10_dkk_mwh::text not in ('NaN','Infinity','-Infinity')),
 p90_dkk_mwh numeric not null check(p90_dkk_mwh::text not in ('NaN','Infinity','-Infinity')),
 provisional boolean not null,
 primary key(capture_id,price_area,starts_at),
 check(p10_dkk_mwh<=predicted_dkk_mwh and predicted_dkk_mwh<=p90_dkk_mwh),
 check(starts_at=date_trunc('hour',starts_at at time zone 'UTC') at time zone 'UTC')
);
create index energy_forecast_predictions_target on public.energy_forecast_predictions(price_area,starts_at);
create table public.energy_forecast_job_runs (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('capture','actuals')),
 started_at timestamptz not null default clock_timestamp(),
 completed_at timestamptz,
 status text not null check(status in ('running','complete','partial','failed')),
 error_code text check(error_code in ('FORECAST_CAPTURE_FAILED','ACTUAL_ARCHIVE_FAILED')),
 result jsonb check(result is null or (jsonb_typeof(result)='object' and octet_length(result::text)<10000))
);
alter table public.energy_forecast_capture_runs enable row level security;
alter table public.energy_forecast_predictions enable row level security;
alter table public.energy_forecast_job_runs enable row level security;
revoke all on public.energy_forecast_capture_runs,public.energy_forecast_predictions,public.energy_forecast_job_runs from public,anon,authenticated,service_role;
grant select on public.energy_forecast_capture_runs,public.energy_forecast_predictions to service_role;
grant select,insert,update on public.energy_forecast_job_runs to service_role;

create function public.archive_energy_forecast_capture(p_generated_at timestamptz,p_points jsonb,p_metadata jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 observed timestamptz:=clock_timestamp(); local_day date;
 capture public.energy_forecast_capture_runs%rowtype;
 point jsonb; target timestamptz; issue timestamptz; count_points integer;
begin
 local_day:=(observed at time zone 'Europe/Copenhagen')::date;
 if p_generated_at is null or p_generated_at>observed+interval '5 minutes' or p_generated_at<observed-interval '6 hours'
  or p_points is null or jsonb_typeof(p_points)<>'array' or jsonb_array_length(p_points) not between 1 and 400
  or p_metadata is null or jsonb_typeof(p_metadata)<>'object' or octet_length(p_metadata::text)>=100000 then raise exception 'Invalid forecast capture'; end if;
 perform pg_advisory_xact_lock(hashtextextended('forecast-audit:elpriser-v1:'||local_day::text,0));
 select * into capture from public.energy_forecast_capture_runs where source='elpriser-v1' and capture_day=local_day;
 if found then return jsonb_build_object('capture_id',capture.id,'point_count',capture.point_count,'inserted',false);end if;
 if exists(select 1 from jsonb_array_elements(p_points) p group by p->>'price_area',p->>'starts_at' having count(*)>1)
  or not exists(select 1 from jsonb_array_elements(p_points) p where p->>'price_area'='DK1')
  or not exists(select 1 from jsonb_array_elements(p_points) p where p->>'price_area'='DK2') then raise exception 'Duplicate or missing forecast area';end if;
 count_points:=jsonb_array_length(p_points);
 insert into public.energy_forecast_capture_runs(capture_day,captured_at,generated_at,point_count,metadata)
 values(local_day,observed,p_generated_at,count_points,p_metadata) returning * into capture;
 for point in select value from jsonb_array_elements(p_points) loop
  target:=(point->>'starts_at')::timestamptz;issue:=(point->>'issued_at')::timestamptz;
  if target is null or issue is null or (target at time zone 'Europe/Copenhagen')::date-local_day not between 1 and 7
   or issue>observed+interval '5 minutes' or issue<observed-interval '48 hours' or issue>=target then raise exception 'Invalid forecast target or issue';end if;
  insert into public.energy_forecast_predictions(capture_id,price_area,starts_at,issued_at,model_id,source_run_id,predicted_dkk_mwh,p10_dkk_mwh,p90_dkk_mwh,provisional)
  values(capture.id,point->>'price_area',target,issue,point->>'model_id',point->>'source_run_id',(point->>'predicted_dkk_mwh')::numeric,(point->>'p10_dkk_mwh')::numeric,(point->>'p90_dkk_mwh')::numeric,(point->>'provisional')::boolean);
 end loop;
 if exists(
  select 1 from public.energy_forecast_predictions where capture_id=capture.id
  group by price_area,(starts_at at time zone 'Europe/Copenhagen')::date
  having count(*)<>extract(epoch from((((starts_at at time zone 'Europe/Copenhagen')::date+1)::timestamp at time zone 'Europe/Copenhagen')-(((starts_at at time zone 'Europe/Copenhagen')::date)::timestamp at time zone 'Europe/Copenhagen')))/3600
 ) then raise exception 'Incomplete forecast day';end if;
 return jsonb_build_object('capture_id',capture.id,'point_count',count_points,'inserted',true);
end $$;
revoke all on function public.archive_energy_forecast_capture(timestamptz,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.archive_energy_forecast_capture(timestamptz,jsonb,jsonb) to service_role;

-- Four actual market quarters constitute one comparable forecast hour. Missing quarters never become zero.
create view public.energy_forecast_actual_hours with(security_invoker=true) as
with records as (
 select *,date_trunc('hour',starts_at at time zone 'UTC') at time zone 'UTC' as hour_start
 from public.spot_price_archive where interval_minutes=15 and mod(extract(epoch from starts_at),900)=0
)
select price_area,hour_start as starts_at,avg(price_dkk_mwh) as actual_dkk_mwh,
 max(first_seen_at) as actual_first_complete_at,max(last_seen_at) as actual_last_seen_at,
 jsonb_agg(jsonb_build_object('starts_at',starts_at,'revision',revision) order by starts_at) as actual_revisions
from records group by price_area,hour_start
having count(*)=4 and min(starts_at)=hour_start and max(ends_at)=hour_start+interval '1 hour';

create view public.energy_forecast_comparison with(security_invoker=true) as
with compared as (
 select p.*,r.source,r.capture_day,r.captured_at,r.generated_at,
 (p.starts_at at time zone 'Europe/Copenhagen')::date as target_day,
 (p.starts_at at time zone 'Europe/Copenhagen')::date-r.capture_day as horizon_days,
 extract(epoch from(p.starts_at-r.captured_at))/3600 as lead_hours,
 p.issued_at<=r.captured_at and ((p.starts_at at time zone 'Europe/Copenhagen')::date-r.capture_day>=2
   or (r.captured_at at time zone 'Europe/Copenhagen')::time<time '12:00') as eligible_for_scoring,
 a.actual_dkk_mwh,a.actual_first_complete_at,a.actual_last_seen_at,a.actual_revisions
 from public.energy_forecast_predictions p join public.energy_forecast_capture_runs r on r.id=p.capture_id
 left join public.energy_forecast_actual_hours a on a.price_area=p.price_area and a.starts_at=p.starts_at
)
select compared.*,predicted_dkk_mwh/10 as forecast_ore_kwh,actual_dkk_mwh/10 as actual_ore_kwh,
 (predicted_dkk_mwh-actual_dkk_mwh)/10 as error_ore_kwh,
 abs(predicted_dkk_mwh-actual_dkk_mwh)/10 as absolute_error_ore_kwh,
 case when actual_dkk_mwh is null then 'pending' when not eligible_for_scoring then 'late-capture-excluded' else 'scored' end as comparison_status
from compared;

create view public.energy_forecast_daily_accuracy with(security_invoker=true) as
select capture_day,target_day,source,model_id,price_area,horizon_days,
 count(*) as forecast_hours,
 count(*) filter(where eligible_for_scoring and actual_dkk_mwh is not null) as scored_hours,
 count(*) filter(where eligible_for_scoring and actual_dkk_mwh is null) as pending_hours,
 count(*) filter(where not eligible_for_scoring) as excluded_hours,
 avg(absolute_error_ore_kwh) filter(where eligible_for_scoring) as mae_ore_kwh,
 sqrt(avg(error_ore_kwh*error_ore_kwh) filter(where eligible_for_scoring)) as rmse_ore_kwh,
 avg(error_ore_kwh) filter(where eligible_for_scoring) as bias_ore_kwh,
 avg((actual_dkk_mwh between p10_dkk_mwh and p90_dkk_mwh)::integer) filter(where eligible_for_scoring and actual_dkk_mwh is not null) as band_coverage
from public.energy_forecast_comparison group by capture_day,target_day,source,model_id,price_area,horizon_days;

create view public.energy_forecast_accuracy with(security_invoker=true) as
select source,model_id,price_area,horizon_days,count(*) as forecast_hours,
 count(*) filter(where eligible_for_scoring and actual_dkk_mwh is not null) as scored_hours,
 count(distinct target_day) filter(where eligible_for_scoring and actual_dkk_mwh is not null) as scored_days,
 avg(absolute_error_ore_kwh) filter(where eligible_for_scoring) as mae_ore_kwh,
 sqrt(avg(error_ore_kwh*error_ore_kwh) filter(where eligible_for_scoring)) as rmse_ore_kwh,
 avg(error_ore_kwh) filter(where eligible_for_scoring) as bias_ore_kwh
from public.energy_forecast_comparison group by source,model_id,price_area,horizon_days;

create view public.energy_forecast_training_rows with(security_invoker=true) as
select c.*,r.metadata as available_forecast_features
from public.energy_forecast_comparison c join public.energy_forecast_capture_runs r on r.id=c.capture_id
where c.eligible_for_scoring and c.actual_dkk_mwh is not null;

create view public.energy_forecast_audit_health with(security_invoker=true) as
select (select max(captured_at) from public.energy_forecast_capture_runs) as last_capture_at,
 (select max(started_at) from public.energy_forecast_job_runs where kind='capture') as last_capture_attempt_at,
 (select max(completed_at) from public.energy_forecast_job_runs where kind='actuals' and status='complete') as last_complete_actual_sync_at,
 (select count(*) from public.energy_forecast_job_runs where status='failed' and started_at>now()-interval '2 days') as failures_last_two_days,
 (select count(*) from public.energy_forecast_job_runs where status='running' and started_at<now()-interval '30 minutes') as stalled_jobs;

revoke all on public.energy_forecast_actual_hours,public.energy_forecast_comparison,public.energy_forecast_daily_accuracy,public.energy_forecast_accuracy,public.energy_forecast_training_rows,public.energy_forecast_audit_health from public,anon,authenticated;
grant select on public.energy_forecast_actual_hours,public.energy_forecast_comparison,public.energy_forecast_daily_accuracy,public.energy_forecast_accuracy,public.energy_forecast_training_rows,public.energy_forecast_audit_health to service_role;
comment on table public.energy_forecast_predictions is 'Immutable daily DK1/DK2 spot predictions in raw DKK/MWh, excluding VAT, tariffs, taxes and supplier markup. Captured time is server assigned.';
comment on view public.energy_forecast_training_rows is 'Prospective examples only. Keep target dates grouped in time-based train/test splits; actual labels are not input features.';
commit;
