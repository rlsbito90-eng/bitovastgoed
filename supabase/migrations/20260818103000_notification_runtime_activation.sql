-- Bito CRM — notification runtime activation
-- Server-only runtime secrets + pg_cron/pg_net orchestration.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table if not exists public.notification_runtime_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.notification_runtime_secrets enable row level security;
revoke all on public.notification_runtime_secrets from public, anon, authenticated;
grant select on public.notification_runtime_secrets to service_role;

comment on table public.notification_runtime_secrets is
  'Server-only notificatie-runtimegeheimen. Geen client policies; service_role leest voor Edge Functions.';

create or replace function public.notification_engine_http_tick()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_secret text;
  v_request_id bigint;
begin
  select value into v_secret
  from public.notification_runtime_secrets
  where key = 'cron_secret';

  if v_secret is null or length(v_secret) < 32 then
    raise exception 'notification cron secret ontbreekt';
  end if;

  select net.http_post(
    url := 'https://vyjocdlwfxrblusfngfq.supabase.co/functions/v1/notification-engine-tick',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) into v_request_id;

  return v_request_id;
end;
$$;

create or replace function public.notification_push_http_tick()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_secret text;
  v_request_id bigint;
begin
  select value into v_secret
  from public.notification_runtime_secrets
  where key = 'cron_secret';

  if v_secret is null or length(v_secret) < 32 then
    raise exception 'notification cron secret ontbreekt';
  end if;

  select net.http_post(
    url := 'https://vyjocdlwfxrblusfngfq.supabase.co/functions/v1/notification-push-send',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.notification_engine_http_tick() from public, anon, authenticated;
revoke all on function public.notification_push_http_tick() from public, anon, authenticated;
grant execute on function public.notification_engine_http_tick() to service_role;
grant execute on function public.notification_push_http_tick() to service_role;

-- Idempotente cron-installatie op naam.
do $$
declare
  v_jobid bigint;
begin
  for v_jobid in
    select jobid from cron.job
    where jobname in ('bito-notification-engine-5m', 'bito-notification-push-1m')
  loop
    perform cron.unschedule(v_jobid);
  end loop;

  perform cron.schedule(
    'bito-notification-engine-5m',
    '*/5 * * * *',
    'select public.notification_engine_http_tick();'
  );

  perform cron.schedule(
    'bito-notification-push-1m',
    '* * * * *',
    'select public.notification_push_http_tick();'
  );
end $$;
