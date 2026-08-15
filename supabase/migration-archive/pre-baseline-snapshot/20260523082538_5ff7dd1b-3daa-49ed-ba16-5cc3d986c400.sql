-- Trek EXECUTE-rechten in voor SECURITY DEFINER-functies die niet
-- rechtstreeks door de client/RPC nodig zijn. RLS-policies en triggers
-- blijven werken (die draaien als owner of via interne calls).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_refnummer() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_intern_gebruiker(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
-- has_role/is_intern_gebruiker blijven beschikbaar voor authenticated zodat
-- RLS-policies (die als de aanroepende rol evalueren) blijven werken.