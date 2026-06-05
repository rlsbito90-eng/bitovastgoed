UPDATE public.off_market_bronnen
SET config = jsonb_set(config, '{sru_creator}', to_jsonb(
  regexp_replace(config->>'sru_creator', '^gemeente\s+', '', 'i')
))
WHERE type = 'bekendmaking'
  AND config ? 'sru_creator'
  AND (config->>'sru_creator') ILIKE 'gemeente %';