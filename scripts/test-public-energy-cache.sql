begin;
set local plpgsql.check_asserts=on;
do $$
declare lease uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); ok boolean;
begin
 assert not has_table_privilege('anon','public.public_energy_source_cache','SELECT');
 assert not has_table_privilege('authenticated','public.public_energy_source_versions','SELECT');
 assert not has_function_privilege('authenticated','public.claim_public_energy_refresh(text,uuid,timestamptz)','EXECUTE');
 assert not has_function_privilege('anon','public.finish_public_energy_refresh(text,uuid,text,jsonb)','EXECUTE');
 delete from public.public_energy_source_cache where cache_key='energinet-v1:spot:2000-01';
 assert public.claim_public_energy_refresh('energinet-v1:spot:2000-01',lease,now()-interval '1 day');
 assert not public.claim_public_energy_refresh('energinet-v1:spot:2000-01',other,now()-interval '1 day');
 assert not public.finish_public_energy_refresh('energinet-v1:spot:2000-01',other,repeat('a',64),'[]');
 assert public.finish_public_energy_refresh('energinet-v1:spot:2000-01',lease,repeat('a',64),'[]');
 assert not public.claim_public_energy_refresh('energinet-v1:spot:2000-01',other,now()-interval '1 day');
 assert (select count(*)=1 from public.public_energy_source_versions where cache_key='energinet-v1:spot:2000-01');
end $$;
rollback;
