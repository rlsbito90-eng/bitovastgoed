-- Automatische energieverrijking na een betrouwbare BAG-doelobjectmatch.
-- Alleen signalen met bag_status='verrijkt', bag_match_kwaliteit='exact' en een geldig VBO-ID
-- komen in aanmerking. De worker gebruikt caching en doet geen Kadaster- of AI-call.

update public.vastgoed_intelligence_config
set auto_energy_after_bag = true,
    updated_at = now()
where id = true;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'vastgoed-energy-auto-five-minutely'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end;
$$;

select cron.schedule(
  'vastgoed-energy-auto-five-minutely',
  '*/5 * * * *',
  $cron$
    select net.http_post(
      url := 'https://vyjocdlwfxrblusfngfq.supabase.co/functions/v1/vastgoed-energy-auto-worker',
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
