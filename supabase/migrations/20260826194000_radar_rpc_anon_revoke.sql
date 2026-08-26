-- Radar security hardening: maak execute-rechten expliciet per rol.
-- Triggerfunctie is uitsluitend intern door PostgreSQL nodig; gebruikers hoeven deze niet direct aan te roepen.

revoke execute on function public.off_market_guard_radar_do_not_contact_brief() from anon;
revoke execute on function public.off_market_guard_radar_do_not_contact_brief() from authenticated;

-- Gebruikers-RPC's vereisen auth.uid() + interne-gebruikercontrole in de functiebody.
-- Anonieme callers mogen de functies niet eens kunnen aanroepen.
revoke execute on function public.off_market_override_do_not_contact(uuid, text, text) from anon;
revoke execute on function public.off_market_set_primary_object(uuid, uuid, text) from anon;

grant execute on function public.off_market_override_do_not_contact(uuid, text, text) to authenticated;
grant execute on function public.off_market_set_primary_object(uuid, uuid, text) to authenticated;
