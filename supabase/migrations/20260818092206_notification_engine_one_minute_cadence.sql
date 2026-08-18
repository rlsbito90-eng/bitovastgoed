-- Bito CRM — notification engine cadence
-- Timed deadlines moeten rond hun expliciete minuut worden geprojecteerd.

do $$
declare
  v_jobid bigint;
begin
  for v_jobid in
    select jobid from cron.job where jobname = 'bito-notification-engine-5m'
  loop
    perform cron.unschedule(v_jobid);
  end loop;

  for v_jobid in
    select jobid from cron.job where jobname = 'bito-notification-engine-1m'
  loop
    perform cron.unschedule(v_jobid);
  end loop;

  perform cron.schedule(
    'bito-notification-engine-1m',
    '* * * * *',
    'select public.notification_engine_http_tick();'
  );
end $$;
