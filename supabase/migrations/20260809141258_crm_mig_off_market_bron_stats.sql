CREATE OR REPLACE FUNCTION public.off_market_bron_stats()
RETURNS TABLE (bron_id uuid,totaal bigint,onverwerkt bigint,verwerkt bigint,gepromoveerd bigint,geskipt bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT r.bron_id,count(*)::bigint,count(*) FILTER(WHERE r.verwerkt=false)::bigint,count(*) FILTER(WHERE r.verwerkt=true)::bigint,count(*) FILTER(WHERE r.signaal_id IS NOT NULL)::bigint,count(*) FILTER(WHERE r.verwerkt=true AND r.signaal_id IS NULL)::bigint
FROM public.off_market_signalen_ruw r WHERE public.is_intern_gebruiker(auth.uid()) GROUP BY r.bron_id; $$;
REVOKE ALL ON FUNCTION public.off_market_bron_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.off_market_bron_stats() TO authenticated,service_role;