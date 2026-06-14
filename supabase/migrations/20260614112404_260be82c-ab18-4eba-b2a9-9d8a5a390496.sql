CREATE OR REPLACE FUNCTION public.activate_off_market_cron(p_secret text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  v_jobid  bigint;
  v_url    text := 'https://ljudxyrqoifhfikueric.supabase.co/functions/v1/off-market-sync-scheduler';
  v_sql    text;
  v_old    record;
BEGIN
  IF p_secret IS NULL OR length(p_secret) < 10 THEN
    RAISE EXCEPTION 'Geldige cron-secret vereist';
  END IF;

  FOR v_old IN SELECT jobid FROM cron.job WHERE jobname = 'off-market-sync-hourly' LOOP
    PERFORM cron.unschedule(v_old.jobid);
  END LOOP;

  v_sql := format($body$
    select net.http_post(
      url := %L,
      headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', %L),
      body := jsonb_build_object('triggered_at', now()::text),
      timeout_milliseconds := 60000
    );
  $body$, v_url, p_secret);

  v_jobid := cron.schedule('off-market-sync-hourly', '0 * * * *', v_sql);

  RETURN jsonb_build_object(
    'jobid', v_jobid,
    'jobname', 'off-market-sync-hourly',
    'schedule', '0 * * * *'
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.activate_off_market_cron(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_off_market_cron(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_off_market_cron(text) TO service_role;