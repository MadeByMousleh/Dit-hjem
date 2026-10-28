begin;
do $$ declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); begin
 insert into auth.users(id,email,email_confirmed_at) values(a,a::text||'@example.invalid',now()),(b,b::text||'@example.invalid',now());
 perform set_config('model.a',a::text,true);perform set_config('model.b',b::text,true);
end $$;
set local role authenticated;
do $$ begin
 perform set_config('request.jwt.claim.sub',current_setting('model.a'),true);perform set_config('model.house',public.ensure_my_household()::text,true);
 perform set_config('request.jwt.claim.sub',current_setting('model.b'),true);perform public.ensure_my_household();
 assert (select count(*)=0 from public.property_models),'Unrelated models exposed';
end $$;
reset role;
set local role service_role;
do $$ declare h uuid:=current_setting('model.house')::uuid; a uuid:=current_setting('model.a')::uuid; address uuid:='33333333-3333-3333-3333-333333333333'; rejected boolean:=false; begin
 assert public.save_property_model(h,address,a,0,'synthetic-payload',repeat('a',64),100)=1;
 assert public.save_property_model(h,address,a,1,'replacement',repeat('b',64),100)=2;
 begin perform public.save_property_model(h,address,a,1,'stale',repeat('c',64),100);exception when serialization_failure then rejected:=true;end;
 assert rejected,'Stale overwrite accepted';assert (select payload='replacement' and revision=2 from public.property_models where household_id=h and address_id=address),'Previous model lost';
 rejected:=false;begin perform public.save_property_model(h,address,current_setting('model.b')::uuid,2,'intruder',repeat('c',64),100);exception when insufficient_privilege then rejected:=true;end;assert rejected,'Non-member saved a model';
end $$;
reset role;
set local role authenticated;
do $$ declare rejected boolean:=false; begin
 perform set_config('request.jwt.claim.sub',current_setting('model.a'),true);assert(select count(*)=1 from public.property_models),'Own model unavailable';
 begin perform public.save_property_model(current_setting('model.house')::uuid,'33333333-3333-3333-3333-333333333333',current_setting('model.a')::uuid,2,'bypass-validation',repeat('a',64),100);exception when insufficient_privilege then rejected:=true;end;assert rejected,'Direct client write bypassed gateway';
 perform set_config('request.jwt.claim.sub',current_setting('model.b'),true);assert(select count(*)=0 from public.property_models),'Cross-household read';
end $$;
reset role;
set local role anon;
do $$ declare rejected boolean:=false;begin begin perform 1 from public.property_models;exception when insufficient_privilege then rejected:=true;end;assert rejected,'Anonymous model access';end $$;
rollback;
