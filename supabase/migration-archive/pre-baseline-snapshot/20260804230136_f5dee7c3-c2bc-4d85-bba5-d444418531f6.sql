-- 1. Policies expliciet beperken tot authenticated
DROP POLICY IF EXISTS "Intern leest scenario_financing_facilities" ON public.scenario_financing_facilities;
DROP POLICY IF EXISTS "Intern verwijdert scenario_financing_facilities" ON public.scenario_financing_facilities;
DROP POLICY IF EXISTS "Intern voegt scenario_financing_facilities toe" ON public.scenario_financing_facilities;
DROP POLICY IF EXISTS "Intern wijzigt scenario_financing_facilities" ON public.scenario_financing_facilities;

CREATE POLICY "Intern leest scenario_financing_facilities"
  ON public.scenario_financing_facilities FOR SELECT TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern voegt scenario_financing_facilities toe"
  ON public.scenario_financing_facilities FOR INSERT TO authenticated
  WITH CHECK (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern wijzigt scenario_financing_facilities"
  ON public.scenario_financing_facilities FOR UPDATE TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()))
  WITH CHECK (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern verwijdert scenario_financing_facilities"
  ON public.scenario_financing_facilities FOR DELETE TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

-- 2. Vast zoekpad voor triggerfuncties
ALTER FUNCTION public.vastgoedkans_nummer_toekennen() SET search_path = public;
ALTER FUNCTION public.vastgoedrekenen_bronpakket_touch_updated_at() SET search_path = public;

-- 3. anon EXECUTE intrekken op SECURITY DEFINER functies (trigger- en beheerfuncties)
REVOKE EXECUTE ON FUNCTION public.next_crm_objectnummer() FROM anon;
REVOKE EXECUTE ON FUNCTION public.prevent_crm_objectnummer_update() FROM anon;
REVOKE EXECUTE ON FUNCTION public.vastgoedrekenen_bronimport_mapping_actor_guard() FROM anon;
REVOKE EXECUTE ON FUNCTION public.vastgoedrekenen_enforce_bronpakket_actor() FROM anon;
REVOKE EXECUTE ON FUNCTION public.vastgoedrekenen_import_codes_valid(text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.vastgoedrekenen_import_kengetallen(uuid, jsonb, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.vastgoedrekenen_lock_approved_package_entries() FROM anon;
REVOKE EXECUTE ON FUNCTION public.vastgoedrekenen_lock_bronpakket_metadata() FROM anon;
REVOKE EXECUTE ON FUNCTION public.vastgoedrekenen_snapshot_bronpakket() FROM anon;
REVOKE EXECUTE ON FUNCTION public.vastgoedrekenen_validate_bronpakket_approval() FROM anon;
REVOKE EXECUTE ON FUNCTION public.vastgoedkans_nummer_toekennen() FROM anon;
REVOKE EXECUTE ON FUNCTION public.vastgoedrekenen_bronpakket_touch_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon;
REVOKE EXECUTE ON FUNCTION public.activate_off_market_cron(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_refnummer() FROM anon;
REVOKE EXECUTE ON FUNCTION public.off_market_bron_stats() FROM anon;
REVOKE EXECUTE ON FUNCTION public.off_market_promote_to_object(uuid) FROM anon;