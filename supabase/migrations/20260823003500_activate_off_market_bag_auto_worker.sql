-- Activeer automatische BAG-verrijking via de dedicated BAG V2.6 worker.
-- Alleen signalen met bag_status=niet_verrijkt en geo_status=verrijkt worden door de worker geselecteerd.
-- Geen Kadaster- of AI-call in deze keten.

DO $$
DECLARE
  existing_job bigint;
BEGIN
  SELECT jobid INTO existing_job
  FROM cron.job
  WHERE jobname = 'off-market-bag-auto-five-minutely'
  LIMIT 1;

  IF existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job);
  END IF;
END $$;

SELECT cron.schedule(
  'off-market-bag-auto-five-minutely',
  '*/5 * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://vyjocdlwfxrblusfngfq.supabase.co/functions/v1/off-market-bag-auto-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          SELECT value
          FROM public.off_market_runtime_secrets
          WHERE key = 'cron_secret'
          LIMIT 1
        )
      ),
      body := '{}'::jsonb
    );
  $cron$
);
