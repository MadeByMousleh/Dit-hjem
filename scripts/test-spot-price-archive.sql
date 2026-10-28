begin;
set local plpgsql.check_asserts=on;
set local role service_role;
do $$ declare batch jsonb:='[{"price_area":"DK1","starts_at":"2026-10-22T22:00:00Z","ends_at":"2026-10-22T22:15:00Z","interval_minutes":15,"price_dkk_mwh":-12.345678,"source":"DayAheadPrices","raw_record":{"synthetic":true}}]'; n bigint; start_cursor date; rejected boolean:=false; begin
 select cursor into start_cursor from public.spot_price_archive_state where id;
 assert public.archive_spot_price_batch(batch,'recent','2026-10-23','2026-10-24',192)=1;
 assert public.archive_spot_price_batch(batch,'recent','2026-10-23','2026-10-24',192)=1;
 assert(select count(*)=1 from public.spot_price_archive),'Idempotent repeat';assert(select count(*)=0 from public.spot_price_versions),'No spurious revisions';
 batch:=jsonb_set(batch,'{0,price_dkk_mwh}','0');perform public.archive_spot_price_batch(batch,'recent','2026-10-23','2026-10-24',192);
 assert(select count(*)=1 from public.spot_price_versions),'Correction audit missing';assert(select price_dkk_mwh=-12.345678 from public.spot_price_versions),'Previous negative price lost';
 assert(select revision=2 and price_dkk_mwh=0 from public.spot_price_archive),'Correction not applied';
 assert(select not complete and received_count=1 from public.spot_price_archive_ranges),'Missing data called complete';
 perform public.archive_spot_price_batch('[]','history',start_cursor,(start_cursor+interval '1 month')::date,1488,start_cursor,(start_cursor+interval '1 month')::date);
 begin perform public.archive_spot_price_batch('[]','history',start_cursor,(start_cursor+interval '1 month')::date,1488,start_cursor,(start_cursor+interval '1 month')::date);exception when serialization_failure then rejected:=true;end;assert rejected,'Stale cursor overwrite';
end $$;
reset role;
set local role authenticated;
do $$ declare rejected boolean:=false; begin
 assert(select count(*)=1 from public.spot_price_archive),'Authenticated price read';
 begin perform public.archive_spot_price_batch('[]','recent','2026-10-23','2026-10-24',192);exception when insufficient_privilege then rejected:=true;end;assert rejected,'Client write bypass';
 rejected:=false;begin perform 1 from public.spot_price_archive_state;exception when insufficient_privilege then rejected:=true;end;assert rejected,'Private job state exposed';
end $$;
reset role;
set local role anon;
do $$ declare rejected boolean:=false;begin begin perform 1 from public.spot_price_archive;exception when insufficient_privilege then rejected:=true;end;assert rejected,'Unexpected anonymous price access';end $$;
rollback;
