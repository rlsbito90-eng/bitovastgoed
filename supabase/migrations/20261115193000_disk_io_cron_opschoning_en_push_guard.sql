-- Bito CRM — Disk IO verlagen (nov 2026)
--
-- Aanleiding: Supabase meldt dat het Disk IO-budget opraakt. pg_stat_statements
-- toont dat de meeste writes uit cron/pg_net komen, niet uit CRM-gebruik.
--
-- 1. cron.job_run_details werd nooit opgeschoond en blijft groeien.
--    Nieuwe cronjob ruimt in kleine batches op (bewaart 3 dagen), zodat er geen
--    grote I/O-piek ontstaat. Volgorde op runid (primary key) houdt het goedkoop.
-- 2. notification_push_http_tick deed elke minuut een HTTP-call naar de
--    Edge Function, ook als er niets te versturen is. Iedere call schrijft rijen
--    in net.http_request_queue en net._http_response. Nu eerst een goedkope
--    EXISTS-check op dezelfde voorwaarden als notification-push-send gebruikt
--    (index idx_notification_deliveries_due_pending).
--    De engine-tick blijft ongewijzigd elke minuut draaien (getimede deadlines).
-- 3. Index op off_market_signalen(created_at desc): de signalenlijst sorteerde
--    brede rijen zonder index en schreef daarbij temp-bestanden naar schijf.

-- 1. Opschonen cron-geschiedenis -------------------------------------------
do $$
declare
  v_jobid bigint;
begin
  for v_jobid in select jobid from cron.job where jobname = 'bito-cron-history-purge' loop
    perform cron.unschedule(v_jobid);
  end loop;

  perform cron.schedule(
    'bito-cron-history-purge',
    '*/15 * * * *',
    $purge$
      delete from cron.job_run_details
      where runid in (
        select runid
        from cron.job_run_details
        where end_time < now() - interval '3 days'
        order by runid
        limit 5000
      );
    $purge$
  );
end $$;

-- 2. Push-tick alleen aanroepen als er iets klaarstaat ----------------------
create or replace function public.notification_push_http_tick()
returns bigint language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_secret text; v_request_id bigint;
begin
  -- Zelfde filter als notification-push-send; zonder werk geen HTTP-call.
  if not exists (
    select 1
    from public.notification_deliveries d
    where d.sent_at is null
      and d.failed_at is null
      and d.retry_count < 3
      and d.available_at <= now()
  ) then
    return null;
  end if;

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

revoke all on function public.notification_push_http_tick() from public, anon, authenticated;
grant execute on function public.notification_push_http_tick() to service_role;

-- 3. Sorteerindex signalenlijst ---------------------------------------------
create index if not exists idx_off_market_signalen_created_at
  on public.off_market_signalen (created_at desc);
