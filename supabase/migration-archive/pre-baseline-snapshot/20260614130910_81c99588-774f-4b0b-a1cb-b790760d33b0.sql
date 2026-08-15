
ALTER TABLE public.off_market_bronnen
  ADD COLUMN IF NOT EXISTS tijdstip_minuut smallint NOT NULL DEFAULT 0;

ALTER TABLE public.off_market_bronnen
  DROP CONSTRAINT IF EXISTS off_market_bronnen_tijdstip_minuut_chk;

ALTER TABLE public.off_market_bronnen
  ADD CONSTRAINT off_market_bronnen_tijdstip_minuut_chk
  CHECK (tijdstip_minuut IN (0, 15, 30, 45));

-- Vervang oude uurlijkse cron door kwartier-cron.
-- Behoudt jobnaam en hergebruikt bestaande secret (via DO-block fetcht command opnieuw).
DO $$
DECLARE
  v_old record;
  v_cmd text;
BEGIN
  -- Pak command van bestaande job (bevat al de secret).
  SELECT command INTO v_cmd FROM cron.job WHERE jobname = 'off-market-sync-hourly' LIMIT 1;

  -- Unschedule alle bestaande off-market jobs (voorkomt duplicaten).
  FOR v_old IN SELECT jobid FROM cron.job WHERE jobname IN ('off-market-sync-hourly','off-market-sync-quarter-hourly') LOOP
    PERFORM cron.unschedule(v_old.jobid);
  END LOOP;

  IF v_cmd IS NOT NULL THEN
    PERFORM cron.schedule('off-market-sync-quarter-hourly', '*/15 * * * *', v_cmd);
  END IF;
END $$;
