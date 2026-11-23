
-- PediaQ v1.3 private scheduled Web Push backend; existing answer tables untouched.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create schema if not exists pediaq_internal;
revoke all on schema pediaq_internal from public, anon, authenticated;

create table if not exists public.pediaq_push_subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint_hash text not null check (endpoint_hash ~ '^[0-9a-f]{64}$'),
  endpoint text not null check (length(endpoint) between 20 and 2048 and endpoint like 'https://%'),
  p256dh text not null check (length(p256dh) between 40 and 200),
  auth text not null check (length(auth) between 15 and 100),
  slots text[] not null default array['07:00','12:00','22:00']::text[],
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(user_id,endpoint_hash),
  constraint valid_push_slots check (slots <@ array['07:00','12:00','22:00']::text[])
);
create index if not exists pediaq_push_by_enabled on public.pediaq_push_subscriptions(enabled) where enabled=true;
alter table public.pediaq_push_subscriptions enable row level security;
revoke all on public.pediaq_push_subscriptions from anon;
grant select,insert,update,delete on public.pediaq_push_subscriptions to authenticated;
grant select,insert,update,delete on public.pediaq_push_subscriptions to service_role;
create policy "Read own push subscriptions" on public.pediaq_push_subscriptions
  for select to authenticated using ((select auth.uid())=user_id);
create policy "Insert own push subscriptions" on public.pediaq_push_subscriptions
  for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Update own push subscriptions" on public.pediaq_push_subscriptions
  for update to authenticated using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);
create policy "Delete own push subscriptions" on public.pediaq_push_subscriptions
  for delete to authenticated using ((select auth.uid())=user_id);

create table pediaq_internal.push_secrets (
 id int primary key check (id=1),
 vapid_public text not null,
 vapid_private text not null,
 cron_secret text not null,
 project_url text not null
);
revoke all on pediaq_internal.push_secrets from public,anon,authenticated,service_role;

create table pediaq_internal.push_jobs (
 delivery_date date not null,
 slot text not null,
 started_at timestamptz not null default now(),
 primary key(delivery_date,slot)
);
revoke all on pediaq_internal.push_jobs from public,anon,authenticated,service_role;

create table pediaq_internal.push_delivery_log (
 delivery_date date not null,
 slot text not null,
 user_id uuid,
 endpoint_hash text not null,
 status text not null,
 created_at timestamptz not null default now(),
 primary key(delivery_date,slot,endpoint_hash,user_id)
);
revoke all on pediaq_internal.push_delivery_log from public,anon,authenticated,service_role;

create or replace function public.pediaq_claim_push_job(p_date date,p_slot text,p_signature text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare
 v_secret text;
 v_expected text;
 v_now timestamp;
 v_start timestamp;
begin
 if p_slot not in ('07:00','12:00','22:00') or p_signature is null then return false; end if;
 v_now := now() at time zone 'Asia/Tokyo';
 v_start := p_date::timestamp + p_slot::time;
 if (v_now - v_start) < interval '0 seconds' or (v_now - v_start)> interval '15 minutes' then return false; end if;
 select cron_secret into v_secret from pediaq_internal.push_secrets where id=1;
 if v_secret is null then return false; end if;
 v_expected := encode(extensions.hmac((p_date::text||'|'||p_slot)::bytea,v_secret::bytea,'sha256'),'hex');
 if p_signature<>v_expected then return false; end if;
 insert into pediaq_internal.push_jobs(delivery_date,slot) values(p_date,p_slot) on conflict do nothing;
 return found;
end
$$;
revoke all on function public.pediaq_claim_push_job(date,text,text) from public,anon,authenticated;
grant execute on function public.pediaq_claim_push_job(date,text,text) to service_role;

create or replace function public.pediaq_push_server_config()
returns jsonb language sql security definer set search_path=''
as $$
 select jsonb_build_object('publicKey',vapid_public,'privateKey',vapid_private)
 from pediaq_internal.push_secrets where id=1
$$;
revoke all on function public.pediaq_push_server_config() from public,anon,authenticated;
grant execute on function public.pediaq_push_server_config() to service_role;

create or replace function public.pediaq_log_push_result(p_date date,p_slot text,p_user_id uuid,p_endpoint_hash text,p_status text)
returns void language sql security definer set search_path=''
as $$
 insert into pediaq_internal.push_delivery_log(delivery_date,slot,user_id,endpoint_hash,status)
 values(p_date,p_slot,p_user_id,p_endpoint_hash,left(p_status,80))
 on conflict(delivery_date,slot,endpoint_hash,user_id) do update set status=excluded.status,created_at=now()
$$;
revoke all on function public.pediaq_log_push_result(date,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.pediaq_log_push_result(date,text,uuid,text,text) to service_role;

create or replace function pediaq_internal.invoke_scheduled_push(p_slot text)
returns bigint language plpgsql security invoker set search_path=''
as $$
declare
  v_secret text;
  v_url text;
  v_date date;
  v_sig text;
begin
  select cron_secret,project_url into v_secret,v_url from pediaq_internal.push_secrets where id=1;
  if v_secret is null then raise exception 'PediaQ push secret not configured'; end if;
  v_date:=(now() at time zone 'Asia/Tokyo')::date;
  v_sig:=encode(extensions.hmac((v_date::text||'|'||p_slot)::bytea,v_secret::bytea,'sha256'),'hex');
  return net.http_post(
    url=>v_url||'/functions/v1/pediaq-send-push',
    body=>jsonb_build_object('date',v_date,'slot',p_slot,'signature',v_sig),
    headers=>jsonb_build_object('Content-Type','application/json'),
    timeout_milliseconds=>30000
  );
end
$$;
revoke all on function pediaq_internal.invoke_scheduled_push(text) from public,anon,authenticated,service_role;
