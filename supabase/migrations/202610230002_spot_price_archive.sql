begin;
create table public.spot_price_archive (
 price_area text not null check(price_area in ('DK1','DK2')),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 interval_minutes integer not null check(interval_minutes in (15,60)),
 price_dkk_mwh numeric not null check(price_dkk_mwh::text not in ('NaN','Infinity','-Infinity')),
 source text not null check(source in ('DayAheadPrices','Elspotprices')),
 raw_record jsonb not null check(jsonb_typeof(raw_record)='object' and octet_length(raw_record::text)<10000),
 revision bigint not null default 1,
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 primary key(price_area,starts_at),
 check(ends_at=starts_at+interval_minutes*interval '1 minute')
);
create table public.spot_price_versions (like public.spot_price_archive including defaults);
alter table public.spot_price_versions add column replaced_at timestamptz not null default now();
create unique index spot_price_versions_identity on public.spot_price_versions(price_area,starts_at,revision);
create table public.spot_price_archive_state(id boolean primary key default true check(id),cursor date not null);
insert into public.spot_price_archive_state(id,cursor) values(true,(date_trunc('year',now())-interval '5 years')::date);
create table public.spot_price_archive_ranges(
 kind text not null check(kind in ('recent','history')),
 date_from date not null,date_to date not null check(date_to>date_from and date_to-date_from<=31),
 expected_count integer not null,received_count integer not null,
 complete boolean not null,checked_at timestamptz not null default now(),retry_after timestamptz not null,
 primary key(kind,date_from,date_to)
);
alter table public.spot_price_archive enable row level security;
alter table public.spot_price_versions enable row level security;
alter table public.spot_price_archive_state enable row level security;
alter table public.spot_price_archive_ranges enable row level security;
revoke all on public.spot_price_archive,public.spot_price_versions,public.spot_price_archive_state,public.spot_price_archive_ranges from public,anon,authenticated;
grant select on public.spot_price_archive to authenticated;
create policy spot_price_member_read on public.spot_price_archive for select to authenticated using(true);
grant all on public.spot_price_archive,public.spot_price_versions,public.spot_price_archive_state,public.spot_price_archive_ranges to service_role;
create function public.archive_spot_price_batch(p_rows jsonb,p_kind text,p_from date,p_to date,p_expected_count integer,p_cursor date default null,p_next date default null)
 returns integer language plpgsql security definer set search_path=pg_catalog,public as $$
declare row_data jsonb; current_row public.spot_price_archive%rowtype; start_time timestamptz; area text; count_rows integer:=0;
begin
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>6500 or p_kind not in ('recent','history') or p_to<=p_from or p_to-p_from>31 or p_expected_count<0 then raise exception 'Invalid batch'; end if;
 perform pg_advisory_xact_lock(hashtextextended('spot-price-archive-v1',0));
 if p_next is not null then
  if p_kind<>'history' or p_next<>p_to or p_from<>p_cursor or (select cursor from public.spot_price_archive_state where id) is distinct from p_cursor then raise exception 'Archive cursor changed' using errcode='40001'; end if;
 end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r group by r->>'price_area',r->>'starts_at' having count(*)>1) then raise exception 'Duplicate price'; end if;
 for row_data in select value from jsonb_array_elements(p_rows) loop
  start_time:=(row_data->>'starts_at')::timestamptz;area:=row_data->>'price_area';
  if start_time < (p_from::timestamp at time zone 'Europe/Copenhagen') or start_time >= (p_to::timestamp at time zone 'Europe/Copenhagen') then raise exception 'Price outside period'; end if;
  select * into current_row from public.spot_price_archive where price_area=area and starts_at=start_time;
  if found and (current_row.ends_at,current_row.price_dkk_mwh,current_row.source,current_row.raw_record) is distinct from ((row_data->>'ends_at')::timestamptz,(row_data->>'price_dkk_mwh')::numeric,row_data->>'source',row_data->'raw_record') then
   insert into public.spot_price_versions select current_row.*,now();
   update public.spot_price_archive set ends_at=(row_data->>'ends_at')::timestamptz,interval_minutes=(row_data->>'interval_minutes')::integer,price_dkk_mwh=(row_data->>'price_dkk_mwh')::numeric,source=row_data->>'source',raw_record=row_data->'raw_record',revision=revision+1,last_seen_at=now() where price_area=area and starts_at=start_time;
  elsif found then
   update public.spot_price_archive set last_seen_at=now() where price_area=area and starts_at=start_time;
  else
   insert into public.spot_price_archive(price_area,starts_at,ends_at,interval_minutes,price_dkk_mwh,source,raw_record)
   values(area,start_time,(row_data->>'ends_at')::timestamptz,(row_data->>'interval_minutes')::integer,(row_data->>'price_dkk_mwh')::numeric,row_data->>'source',row_data->'raw_record');
  end if;
  count_rows:=count_rows+1;
 end loop;
 insert into public.spot_price_archive_ranges(kind,date_from,date_to,expected_count,received_count,complete,retry_after)
 values(p_kind,p_from,p_to,p_expected_count,count_rows,count_rows=p_expected_count,now()+interval '7 days')
 on conflict(kind,date_from,date_to) do update set expected_count=excluded.expected_count,received_count=excluded.received_count,complete=excluded.complete,checked_at=now(),retry_after=excluded.retry_after;
 if p_next is not null then update public.spot_price_archive_state set cursor=p_next where id;end if;
 return count_rows;
end; $$;
revoke all on function public.archive_spot_price_batch(jsonb,text,date,date,integer,date,date) from public,anon,authenticated;
grant execute on function public.archive_spot_price_batch(jsonb,text,date,date,integer,date,date) to service_role;
comment on table public.spot_price_archive is 'Energinet actual spot prices in DKK/MWh excluding VAT, tariffs and supplier markup; source intervals and revisions retained.';
commit;
