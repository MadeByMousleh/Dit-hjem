begin;
set local plpgsql.check_asserts=on;
do $$
declare lease uuid:=gen_random_uuid();
begin
 assert not has_table_privilege('anon','public.public_energy_source_cache','SELECT');
 assert not has_function_privilege('authenticated','public.claim_public_energy_refresh(text,uuid,timestamptz)','EXECUTE');
 delete from public.public_energy_source_cache where cache_key='elpriser-v1:forecast';
 assert public.claim_public_energy_refresh('elpriser-v1:forecast',lease,now()-interval '1 day');
 assert public.finish_public_energy_refresh('elpriser-v1:forecast',lease,repeat('f',64),'[{"synthetic":true}]');
 assert (select count(*)=1 from public.public_energy_source_versions where cache_key='elpriser-v1:forecast' and content_hash=repeat('f',64));
 begin
  perform public.claim_public_energy_refresh('unapproved-source:forecast',lease,now()-interval '1 day');
  raise exception 'Unknown key must fail';
 exception when raise_exception then
  assert sqlerrm='Invalid public energy cache request';
 end;
end $$;
rollback;
