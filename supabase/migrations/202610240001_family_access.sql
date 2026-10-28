begin;
alter table public.household_members add column family_role text not null default 'member' check(family_role in ('owner','member'));
-- Preserve the authority of existing, operator-provisioned members.
update public.household_members set family_role='owner';
alter table public.households add column home_profile jsonb not null default '{}'::jsonb check(jsonb_typeof(home_profile)='object');
alter table public.household_invitations
 add column created_by uuid references auth.users(id),
 add column expires_at timestamptz not null default (now()+interval '7 days'),
 add column accepted_at timestamptz,
 add column last_sent_at timestamptz not null default now(),
 add column email_delivery text not null default 'sent' check(email_delivery in ('pending','sent','failed'));

create or replace function public.claim_household_invitations() returns void
language plpgsql security definer set search_path='' as $$
declare invitation record;
begin
 for invitation in select i.household_id,i.email from public.household_invitations i join auth.users u on lower(u.email)=i.email
 where u.id=auth.uid() and u.email_confirmed_at is not null and i.created_by is null and i.expires_at>now() and i.accepted_at is null and i.email_delivery='sent' for update of i loop
  insert into public.household_members(household_id,user_id,family_role) values(invitation.household_id,auth.uid(),'member') on conflict do nothing;
  update public.household_invitations set accepted_at=now() where household_id=invitation.household_id and email=invitation.email;
 end loop;
end $$;
create function public.my_family_invitations() returns jsonb
language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('householdId',i.household_id,'name',h.name)),'[]'::jsonb)
 from public.household_invitations i join auth.users u on lower(u.email)=i.email join public.households h on h.id=i.household_id
 where u.id=auth.uid() and u.email_confirmed_at is not null and i.created_by is not null and i.expires_at>now() and i.accepted_at is null and i.email_delivery='sent';
$$;
create function public.accept_family_invitation(p_home uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare recipient text;
begin
 select i.email into recipient from public.household_invitations i join auth.users u on lower(u.email)=i.email
 where u.id=auth.uid() and u.email_confirmed_at is not null and i.household_id=p_home and i.expires_at>now() and i.accepted_at is null and i.email_delivery='sent' for update of i;
 if recipient is null then raise exception 'Invitation unavailable' using errcode='42501'; end if;
 insert into public.household_members(household_id,user_id,family_role) values(p_home,auth.uid(),'member') on conflict do nothing;
 update public.household_invitations set accepted_at=now() where household_id=p_home and email=recipient;
 return p_home;
end $$;
revoke all on function public.my_family_invitations(),public.accept_family_invitation(uuid) from public,anon;
grant execute on function public.my_family_invitations(),public.accept_family_invitation(uuid) to authenticated;
create or replace function public.ensure_my_household() returns uuid
language plpgsql security definer set search_path='' as $$
declare home_id uuid;
begin
 perform 1 from auth.users where id=auth.uid() and email_confirmed_at is not null for update;
 if not found then raise exception 'Confirm email first'; end if;
 perform public.claim_household_invitations();
 select household_id into home_id from public.household_members where user_id=auth.uid() order by household_id limit 1;
 if home_id is null then
  insert into public.households(name) values('Mit hjem') returning id into home_id;
  insert into public.household_members(household_id,user_id,family_role) values(home_id,auth.uid(),'owner');
 end if;
 return home_id;
end $$;

create function public.family_manage(p_home uuid,p_actor uuid,p_action text,p_email text default null,p_target uuid default null,p_profile jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor_role text; home_name text; shared jsonb; result jsonb;
begin
 select name,home_profile into home_name,shared from public.households where id=p_home for update;
 select family_role into actor_role from public.household_members where household_id=p_home and user_id=p_actor;
 if actor_role is null then raise exception 'No membership' using errcode='42501'; end if;
 if p_action<>'list' and actor_role<>'owner' then raise exception 'Owner only' using errcode='42501'; end if;
 if p_action='profile' then
  if p_profile is null or jsonb_typeof(p_profile)<>'object' or pg_column_size(p_profile)>12000 then raise exception 'Invalid profile'; end if;
  if exists(select 1 from jsonb_object_keys(p_profile) k where k not in ('address','addressId','addressX','addressY','municipalityCode','postcode','gridSupplierId','gridSupplierName','wasteCalendarUrl')) then raise exception 'Private profile fields forbidden'; end if;
  update public.households set home_profile=p_profile where id=p_home;
 elsif p_action='invite' then
  if p_email is null or p_email<>lower(trim(p_email)) or length(p_email)>254 or p_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email'; end if;
  if exists(select 1 from public.household_members m join auth.users u on u.id=m.user_id where m.household_id=p_home and lower(u.email)=p_email) then raise exception 'Already member' using errcode='23505'; end if;
  if exists(select 1 from public.household_invitations where household_id=p_home and email=p_email and last_sent_at>now()-interval '1 minute') then raise exception 'Wait before resend' using errcode='54000'; end if;
  if (select count(*) from public.household_members where household_id=p_home)+(select count(*) from public.household_invitations where household_id=p_home and accepted_at is null and expires_at>now() and email<>p_email)>=10 then raise exception 'Household limit' using errcode='54000'; end if;
  insert into public.household_invitations(household_id,email,created_by,expires_at,last_sent_at,email_delivery) values(p_home,p_email,p_actor,now()+interval '7 days',now(),'pending')
  on conflict(household_id,email) do update set created_by=p_actor,expires_at=excluded.expires_at,accepted_at=null,last_sent_at=now(),email_delivery='pending';
 elsif p_action in ('sent','failed') then
  update public.household_invitations set email_delivery=p_action where household_id=p_home and email=p_email and created_by=p_actor and email_delivery='pending';
 elsif p_action='revoke' then
  delete from public.household_invitations where household_id=p_home and email=p_email and accepted_at is null;
 elsif p_action='remove' then
  if p_target=p_actor then raise exception 'Cannot remove self'; end if;
  delete from public.household_members where household_id=p_home and user_id=p_target and family_role='member';
 elsif p_action<>'list' then raise exception 'Invalid operation'; end if;
 select jsonb_build_object('householdId',p_home,'name',h.name,'home',h.home_profile,'canManage',actor_role='owner',
  'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'given_name','Familiemedlem'),'email',u.email,'role',m.family_role)) from public.household_members m join auth.users u on u.id=m.user_id where m.household_id=p_home),'[]'::jsonb),
  'invitations',case when actor_role='owner' then coalesce((select jsonb_agg(jsonb_build_object('email',email,'expiresAt',expires_at,'delivery',email_delivery)) from public.household_invitations where household_id=p_home and accepted_at is null),'[]'::jsonb) else '[]'::jsonb end) into result from public.households h where h.id=p_home;
 return result;
end $$;
revoke all on function public.family_manage(uuid,uuid,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.family_manage(uuid,uuid,text,text,uuid,jsonb) to service_role;
commit;
