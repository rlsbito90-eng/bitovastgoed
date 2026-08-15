alter function public.vastgoedkans_nummer_toekennen() set search_path = public;
alter function public.vastgoedrekenen_bronpakket_touch_updated_at() set search_path = public;

revoke execute on function public.next_crm_objectnummer() from anon;
revoke execute on function public.prevent_crm_objectnummer_update() from public, anon, authenticated;
revoke execute on function public.vastgoedrekenen_bronimport_mapping_actor_guard() from public, anon, authenticated;
revoke execute on function public.vastgoedrekenen_enforce_bronpakket_actor() from public, anon, authenticated;
revoke execute on function public.vastgoedrekenen_lock_approved_package_entries() from public, anon, authenticated;
revoke execute on function public.vastgoedrekenen_lock_bronpakket_metadata() from public, anon, authenticated;
revoke execute on function public.vastgoedrekenen_snapshot_bronpakket() from public, anon, authenticated;
revoke execute on function public.vastgoedrekenen_validate_bronpakket_approval() from public, anon, authenticated;
revoke execute on function public.vastgoedkans_nummer_toekennen() from public, anon, authenticated;
revoke execute on function public.vastgoedrekenen_bronpakket_touch_updated_at() from public, anon, authenticated;
revoke execute on function public.update_updated_at_column() from public, anon, authenticated;
revoke execute on function public.generate_refnummer() from public, anon;
revoke execute on function public.off_market_bron_stats() from public, anon;
revoke execute on function public.off_market_promote_to_object(uuid) from public, anon;
revoke execute on function public.vastgoedrekenen_import_codes_valid(text, jsonb) from public, anon;
revoke execute on function public.vastgoedrekenen_import_kengetallen(uuid, jsonb, jsonb, jsonb) from public, anon;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.is_intern_gebruiker(uuid) from public, anon;

grant execute on function public.vastgoedrekenen_import_kengetallen(uuid, jsonb, jsonb, jsonb) to authenticated;