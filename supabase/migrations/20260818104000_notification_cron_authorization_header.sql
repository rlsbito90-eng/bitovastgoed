create or replace function public.notification_engine_http_tick()
returns bigint language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_secret text; v_request_id bigint;
begin
  select value into v_secret from public.notification_runtime_secrets where key='cron_secret';
  if v_secret is null or length(v_secret)<32 then raise exception 'notification cron secret ontbreekt'; end if;
  select net.http_post(
    url := 'https://vyjocdlwfxrblusfngfq.supabase.co/functions/v1/notification-engine-tick',
    headers := jsonb_build_object('content-type','application/json','authorization','Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) into v_request_id;
  return v_request_id;
end; $$;

create or replace function public.notification_push_http_tick()
returns bigint language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_secret text; v_request_id bigint;
begin
  select value into v_secret from public.notification_runtime_secrets where key='cron_secret';
  if v_secret is null or length(v_secret)<32 then raise exception 'notification cron secret ontbreekt'; end if;
  select net.http_post(
    url := 'https://vyjocdlwfxrblusfngfq.supabase.co/functions/v1/notification-push-send',
    headers := jsonb_build_object('content-type','application/json','authorization','Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  ) into v_request_id;
  return v_request_id;
end; $$;

revoke all on function public.notification_engine_http_tick() from public, anon, authenticated;
revoke all on function public.notification_push_http_tick() from public, anon, authenticated;
grant execute on function public.notification_engine_http_tick() to service_role;
grant execute on function public.notification_push_http_tick() to service_role;
