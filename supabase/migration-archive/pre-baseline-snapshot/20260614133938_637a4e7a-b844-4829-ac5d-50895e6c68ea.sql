CREATE OR REPLACE FUNCTION public.activate_off_market_cron(p_secret text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_jobid  bigint;
  v_url    text := 'https://ljudxyrqoifhfikueric.supabase.co/functions/v1/off-market-sync-scheduler';
  v_sql    text;
  v_old    record;
BEGIN
  IF p_secret IS NULL OR length(p_secret) < 10 THEN
    RAISE EXCEPTION 'Geldige cron-secret vereist';
  END IF;

  FOR v_old IN SELECT jobid FROM cron.job WHERE jobname IN ('off-market-sync-hourly', 'off-market-sync-quarter-hourly') LOOP
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

  v_jobid := cron.schedule('off-market-sync-quarter-hourly', '*/15 * * * *', v_sql);

  RETURN jsonb_build_object(
    'jobid', v_jobid,
    'jobname', 'off-market-sync-quarter-hourly',
    'schedule', '*/15 * * * *'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.activate_off_market_cron(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_off_market_cron(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_off_market_cron(text) TO service_role;