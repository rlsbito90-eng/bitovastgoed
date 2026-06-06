REVOKE EXECUTE ON FUNCTION public.is_intern_gebruiker(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_refnummer() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.off_market_bron_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.off_market_promote_to_object(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_intern_gebruiker(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_refnummer() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.off_market_bron_stats() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.off_market_promote_to_object(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;