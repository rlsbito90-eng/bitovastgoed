create or replace function public.vastgoedrekenen_bronimport_mapping_actor_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Een mappingprofiel vereist een aangemelde gebruiker.'; end if;
  if tg_op='INSERT' then
    new.created_by := v_actor; new.system_managed := false; new.schema_version := 1; new.created_at := now(); new.updated_at := now(); return new;
  end if;
  if old.system_managed then raise exception 'Een systeembeheerd mappingprofiel kan niet worden gewijzigd.'; end if;
  if old.created_by is distinct from v_actor then raise exception 'Alleen de maker kan dit mappingprofiel wijzigen.'; end if;
  new.created_by := old.created_by; new.system_managed := old.system_managed; new.schema_version := old.schema_version; new.created_at := old.created_at; new.updated_at := now(); return new;
end; $$;

drop trigger if exists vastgoedrekenen_bronimport_mapping_actor_guard_trigger on public.vastgoedrekenen_bronimport_mapping_profielen;
create trigger vastgoedrekenen_bronimport_mapping_actor_guard_trigger before insert or update on public.vastgoedrekenen_bronimport_mapping_profielen for each row execute function public.vastgoedrekenen_bronimport_mapping_actor_guard();

create or replace function public.prevent_crm_objectnummer_update()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.crm_objectnummer is not null and new.crm_objectnummer is distinct from old.crm_objectnummer then raise exception 'crm_objectnummer is immutable' using errcode='23514'; end if;
  return new;
end; $$;

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
revoke execute on function public.next_crm_objectnummer() from public, anon;
revoke execute on function public.generate_refnummer() from public, anon;
revoke execute on function public.off_market_bron_stats() from public, anon;
revoke execute on function public.off_market_promote_to_object(uuid) from public, anon;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.is_intern_gebruiker(uuid) from public, anon;