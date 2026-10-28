begin;
set local plpgsql.check_asserts=on;
set local time zone 'Europe/Copenhagen';
do $$
declare
 today date:=(now() at time zone 'Europe/Copenhagen')::date;
 target timestamptz; target_end timestamptz; points jsonb; result jsonb; capture uuid; late_capture uuid;
 expected_hours integer; value numeric; rows jsonb;
begin
 target:=((today+2)::timestamp at time zone 'Europe/Copenhagen');target_end:=((today+3)::timestamp at time zone 'Europe/Copenhagen');
 expected_hours:=(extract(epoch from(target_end-target))/3600)::integer;
 assert not has_table_privilege('anon','public.energy_forecast_capture_runs','SELECT');
 assert not has_table_privilege('authenticated','public.energy_forecast_comparison','SELECT');
 assert not has_table_privilege('service_role','public.energy_forecast_predictions','UPDATE');
 assert not has_function_privilege('authenticated','public.archive_energy_forecast_capture(timestamptz,jsonb,jsonb)','EXECUTE');
 -- Any existing dev-only public capture is restored by ROLLBACK.
 delete from public.energy_forecast_predictions where capture_id in(select id from public.energy_forecast_capture_runs where capture_day in(today,today+1));
 delete from public.energy_forecast_capture_runs where capture_day in(today,today+1);
 select jsonb_agg(jsonb_build_object('price_area',area,'starts_at',t,'issued_at',now()-interval '1 hour','model_id','synthetic-audit','source_run_id','test','predicted_dkk_mwh',case when area='DK1' then 100 else -50 end,'p10_dkk_mwh',-200,'p90_dkk_mwh',200,'provisional',true))
 into points from unnest(array['DK1','DK2']) area cross join generate_series(target,target_end-interval '1 hour',interval '1 hour') t;
 result:=public.archive_energy_forecast_capture(now()-interval '5 minutes',points,'{"synthetic":true}');capture:=(result->>'capture_id')::uuid;
 assert (result->>'point_count')::integer=expected_hours*2;
 result:=public.archive_energy_forecast_capture(now()-interval '5 minutes',jsonb_set(points,'{0,predicted_dkk_mwh}','110'),'{}');
 assert not (result->>'inserted')::boolean;
 assert (select predicted_dkk_mwh=100 from public.energy_forecast_predictions where capture_id=capture and price_area='DK1' order by starts_at limit 1);
 insert into public.spot_price_archive(price_area,starts_at,ends_at,interval_minutes,price_dkk_mwh,source,raw_record)
 select 'DK1',target+n*interval '15 minutes',target+(n+1)*interval '15 minutes',15,case n when 0 then -100 when 1 then 0 else 100 end,'DayAheadPrices','{"synthetic":true}'::jsonb from generate_series(0,2) n;
 assert (select comparison_status='pending' and actual_dkk_mwh is null from public.energy_forecast_comparison where capture_id=capture and price_area='DK1' and starts_at=target);
 insert into public.spot_price_archive(price_area,starts_at,ends_at,interval_minutes,price_dkk_mwh,source,raw_record) values('DK1',target+interval '45 minutes',target+interval '1 hour',15,200,'DayAheadPrices','{"synthetic":true}');
 assert (select actual_dkk_mwh=50 and absolute_error_ore_kwh=5 and comparison_status='scored' from public.energy_forecast_comparison where capture_id=capture and price_area='DK1' and starts_at=target);
 insert into public.spot_price_archive(price_area,starts_at,ends_at,interval_minutes,price_dkk_mwh,source,raw_record)
 select 'DK2',target+n*interval '15 minutes',target+(n+1)*interval '15 minutes',15,case n when 0 then -100 when 1 then -50 when 2 then 50 else 100 end,'DayAheadPrices','{"synthetic":true}'::jsonb from generate_series(0,3) n;
 assert (select actual_dkk_mwh=0 and error_ore_kwh=-5 and absolute_error_ore_kwh=5 from public.energy_forecast_comparison where capture_id=capture and price_area='DK2' and starts_at=target);
 select jsonb_agg(jsonb_build_object('price_area',price_area,'starts_at',starts_at,'ends_at',ends_at,'interval_minutes',15,'price_dkk_mwh',case when starts_at=target then -60 else price_dkk_mwh end,'source',source,'raw_record',raw_record)) into rows
 from public.spot_price_archive where price_area='DK1' and starts_at>=target and starts_at<target+interval '1 hour';
 perform public.archive_spot_price_batch(rows,'recent',today+2,today+3,4);
 assert (select actual_dkk_mwh=60 and absolute_error_ore_kwh=4 from public.energy_forecast_comparison where capture_id=capture and price_area='DK1' and starts_at=target);
 assert (select count(*)=1 from public.spot_price_versions where price_area='DK1' and starts_at=target and price_dkk_mwh=-100);
 insert into public.energy_forecast_capture_runs(capture_day,captured_at,generated_at,point_count,metadata)
 values(today+1,(today+1+time '13:00') at time zone 'Europe/Copenhagen',(today+1+time '12:30') at time zone 'Europe/Copenhagen',1,'{}') returning id into late_capture;
 insert into public.energy_forecast_predictions values(late_capture,'DK1',target,(today+1+time '12:30') at time zone 'Europe/Copenhagen','synthetic-audit','late',1000,0,2000,true);
 assert (select comparison_status='late-capture-excluded' and not eligible_for_scoring from public.energy_forecast_comparison where capture_id=late_capture);
 assert not exists(select 1 from public.energy_forecast_training_rows where capture_id=late_capture);
 assert (select scored_hours=1 and mae_ore_kwh=4 and rmse_ore_kwh=4 and bias_ore_kwh=4 from public.energy_forecast_daily_accuracy where capture_day=today and price_area='DK1' and target_day=today+2);
 assert (select count(*)=2 from public.energy_forecast_training_rows where capture_id=capture);
 -- A DST fold consists of two distinct UTC hours, even when queried in Danish time.
 delete from public.spot_price_archive where price_area='DK1' and starts_at>='2026-10-25T00:00:00Z' and starts_at<'2026-10-25T02:00:00Z';
 insert into public.spot_price_archive(price_area,starts_at,ends_at,interval_minutes,price_dkk_mwh,source,raw_record)
 select 'DK1','2026-10-25T00:00:00Z'::timestamptz+n*interval '15 minutes','2026-10-25T00:00:00Z'::timestamptz+(n+1)*interval '15 minutes',15,case when n<4 then 10 else 20 end,'DayAheadPrices','{"synthetic":true}'::jsonb from generate_series(0,7) n;
 assert (select count(*)=2 and min(actual_dkk_mwh)=10 and max(actual_dkk_mwh)=20 from public.energy_forecast_actual_hours where price_area='DK1' and starts_at>='2026-10-25T00:00:00Z' and starts_at<'2026-10-25T02:00:00Z');
end $$;
rollback;
