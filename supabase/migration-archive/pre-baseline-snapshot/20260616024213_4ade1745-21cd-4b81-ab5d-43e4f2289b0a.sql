UPDATE public.off_market_signalen
SET geo_status = 'niet_verrijkt',
    geo_foutmelding = NULL,
    geo_verrijkt_op = NULL
WHERE geo_status IN ('geen_match', 'fout')
  AND geo_gemeente_naam IS NULL
  AND lat IS NOT NULL
  AND lng IS NOT NULL;