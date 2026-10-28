begin;
set local plpgsql.check_asserts=on;
do $$ declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); begin
 insert into auth.users(id,email,email_confirmed_at) values(a,a::text||'@example.invalid',now()),(b,b::text||'@example.invalid',now());
 perform set_config('plan.a',a::text,true);perform set_config('plan.b',b::text,true);
end $$;
set local role authenticated;
do $$ begin
 perform set_config('request.jwt.claim.sub',current_setting('plan.a'),true);perform set_config('plan.house',public.ensure_my_household()::text,true);
 perform set_config('request.jwt.claim.sub',current_setting('plan.b'),true);perform public.ensure_my_household();
end $$;
reset role;
set local role service_role;
do $$ declare h uuid:=current_setting('plan.house')::uuid; a uuid:=current_setting('plan.a')::uuid; address uuid:='33333333-3333-3333-3333-333333333333'; id uuid:='44444444-4444-4444-4444-444444444444'; rejected boolean:=false; begin
 assert public.save_property_document(h,address,id,a,0,'Plan.pdf','application/pdf','JVBERi0xLjQ=')=1;
 begin perform public.save_property_document(h,address,id,current_setting('plan.b')::uuid,1,'Intruder.pdf','application/pdf','JVBERi0xLjQ=');exception when insufficient_privilege then rejected:=true;end;assert rejected,'Non-member write';
 rejected:=false;begin perform public.save_property_document(h,address,id,a,0,'Stale.pdf','application/pdf','JVBERi0xLjQ=');exception when serialization_failure then rejected:=true;end;assert rejected,'Stale overwrite';
 assert public.save_property_document(h,address,id,a,1,'Deleted','application/pdf',null)=2;
 rejected:=false;begin perform public.save_property_document(h,address,id,a,1,'Restore.pdf','application/pdf','JVBERi0xLjQ=');exception when serialization_failure then rejected:=true;end;assert rejected,'Stale resurrection';
 assert public.save_property_document(h,address,id,a,2,'Plan.pdf','application/pdf','JVBERi0xLjQ=')=3;
end $$;
reset role;
set local role authenticated;
do $$ declare rejected boolean:=false;begin
 perform set_config('request.jwt.claim.sub',current_setting('plan.a'),true);assert(select count(*)=1 from public.property_documents),'Own document unavailable';
 assert(select count(*)=0 from public.property_documents where address_id='55555555-5555-5555-5555-555555555555'),'Address isolation';
 begin perform public.save_property_document(current_setting('plan.house')::uuid,'33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444',current_setting('plan.a')::uuid,3,'Bypass','application/pdf','JVBERi0xLjQ=');exception when insufficient_privilege then rejected:=true;end;assert rejected,'Direct client write';
 perform set_config('request.jwt.claim.sub',current_setting('plan.b'),true);assert(select count(*)=0 from public.property_documents),'Cross-household read';
end $$;
reset role;
set local role anon;
do $$ declare rejected boolean:=false;begin begin perform 1 from public.property_documents;exception when insufficient_privilege then rejected:=true;end;assert rejected,'Anonymous read';end $$;
rollback;
