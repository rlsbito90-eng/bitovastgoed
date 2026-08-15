-- Sta 'maandelijks' toe als frequentie
ALTER TABLE public.off_market_bronnen
  DROP CONSTRAINT IF EXISTS off_market_bronnen_frequentie_check;
ALTER TABLE public.off_market_bronnen
  ADD CONSTRAINT off_market_bronnen_frequentie_check
  CHECK (frequentie = ANY (ARRAY['handmatig'::text, 'dagelijks'::text, 'wekelijks'::text, 'maandelijks'::text]));

-- Extensies voor pg_cron + pg_net (cronjob zelf wordt apart aangemaakt)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;