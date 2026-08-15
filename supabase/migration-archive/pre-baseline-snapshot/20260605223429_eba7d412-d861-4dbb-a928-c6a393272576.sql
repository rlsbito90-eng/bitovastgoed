CREATE OR REPLACE FUNCTION public.off_market_bron_stats()
RETURNS TABLE (
  bron_id uuid,
  totaal bigint,
  onverwerkt bigint,
  verwerkt bigint,
  gepromoveerd bigint,
  geskipt bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.bron_id,
    count(*)::bigint                                                 AS totaal,
    count(*) FILTER (WHERE r.verwerkt = false)::bigint               AS onverwerkt,
    count(*) FILTER (WHERE r.verwerkt = true)::bigint                AS verwerkt,
    count(*) FILTER (WHERE r.signaal_id IS NOT NULL)::bigint         AS gepromoveerd,
    count(*) FILTER (WHERE r.verwerkt = true AND r.signaal_id IS NULL)::bigint AS geskipt
  FROM public.off_market_signalen_ruw r
  WHERE public.is_intern_gebruiker(auth.uid())
  GROUP BY r.bron_id;
$$;

REVOKE ALL ON FUNCTION public.off_market_bron_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.off_market_bron_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.off_market_bron_stats() TO service_role;