-- Automatische Off-Market AI-worker iedere 15 minuten.
-- De worker zelf is fail-closed via ai_enabled + auto_enrich_enabled + budgetguards.

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'off-market-ai-auto-quarter-hourly'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end;
$$;

select cron.schedule(
  'off-market-ai-auto-quarter-hourly',
  '*/15 * * * *',
  $cron$
    select net.http_post(
      url := 'https://vyjocdlwfxrblusfngfq.supabase.co/functions/v1/off-market-ai-auto-worker',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cron-secret',(
          select value
          from public.off_market_runtime_secrets
          where key='cron_secret'
          limit 1
        )
      ),
      body := '{}'::jsonb
    );
  $cron$
);
