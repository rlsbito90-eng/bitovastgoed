-- BUILD A — SECURITY / RELEASEPOORT
-- NIET AUTOMATISCH TOEPASSEN.
-- Dit reviewbestand staat bewust buiten supabase/migrations en eindigt met
-- ROLLBACK. Het verleent dus geen productiepermissies zolang geen afzonderlijke,
-- expliciet goedgekeurde migratie wordt gemaakt.

begin;

-- De write-RPC's zijn SECURITY DEFINER. Daarom mag autorisatie niet uitsluitend
-- afhangen van RLS of EXECUTE-grants: iedere RPC roept deze guard aan vóór enige
-- idempotentiecheck of write.
create or replace function public.assert_off_market_productiekern_actor(p_actor_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, auth, pg_temp
as $$
declare
  v_auth_uid uuid;
begin
  v_auth_uid := auth.uid();

  if v_auth_uid is null then
    raise exception 'auth_verplicht';
  end if;

  if p_actor_id is null or p_actor_id <> v_auth_uid then
    raise exception 'actor_mismatch';
  end if;

  if not coalesce(public.is_intern_gebruiker(v_auth_uid), false) then
    raise exception 'intern_gebruiker_verplicht';
  end if;
end;
$$;

revoke all on function public.assert_off_market_productiekern_actor(uuid)
  from public, anon, authenticated;

-- Nieuwe productiekern-tabellen blijven voor writes volledig gesloten. Alleen
-- de tabellen die de concrete read-repository gebruikt krijgen een SELECT-pad.
revoke all on table public.off_market_acquisitie_dossiers from anon, authenticated;
revoke all on table public.off_market_brief_versies from anon, authenticated;
revoke all on table public.off_market_printbatches from anon, authenticated;
revoke all on table public.off_market_printbatch_brieven from anon, authenticated;
revoke all on table public.off_market_batchdocumenten from anon, authenticated;
revoke all on table public.off_market_productie_events from anon, authenticated;
revoke all on table public.off_market_productie_nummerreeksen from anon, authenticated;

grant select on table public.off_market_acquisitie_dossiers to authenticated;
grant select on table public.off_market_brief_versies to authenticated;
grant select on table public.off_market_printbatches to authenticated;
grant select on table public.off_market_printbatch_brieven to authenticated;

-- RLS: alleen interne gebruikers mogen de nieuwe leesmodellen direct lezen.
-- Writes verlopen uitsluitend via de beveiligde RPC's en krijgen bewust geen
-- INSERT/UPDATE/DELETE-policy.
drop policy if exists acquisitie_productiekern_dossiers_select_intern
  on public.off_market_acquisitie_dossiers;
create policy acquisitie_productiekern_dossiers_select_intern
  on public.off_market_acquisitie_dossiers
  for select to authenticated
  using (public.is_intern_gebruiker(auth.uid()));

drop policy if exists acquisitie_productiekern_briefversies_select_intern
  on public.off_market_brief_versies;
create policy acquisitie_productiekern_briefversies_select_intern
  on public.off_market_brief_versies
  for select to authenticated
  using (public.is_intern_gebruiker(auth.uid()));

drop policy if exists acquisitie_productiekern_printbatches_select_intern
  on public.off_market_printbatches;
create policy acquisitie_productiekern_printbatches_select_intern
  on public.off_market_printbatches
  for select to authenticated
  using (public.is_intern_gebruiker(auth.uid()));

drop policy if exists acquisitie_productiekern_batchbrieven_select_intern
  on public.off_market_printbatch_brieven;
create policy acquisitie_productiekern_batchbrieven_select_intern
  on public.off_market_printbatch_brieven
  for select to authenticated
  using (public.is_intern_gebruiker(auth.uid()));

-- Geen directe leestoegang is nodig op nummerreeksen, batchdocumenten of audit.
-- Die blijven ook voor authenticated zonder tabelprivileges.

-- Alleen authenticated krijgt in het uiteindelijke releaseontwerp EXECUTE op de
-- negen publieke write-RPC's. anon/public blijven expliciet gesloten.
grant execute on function public.off_market_verwerking_starten(uuid, uuid, text, timestamptz) to authenticated;
grant execute on function public.off_market_brief_reserveren(uuid, uuid, text, timestamptz) to authenticated;
grant execute on function public.off_market_briefversie_aanmaken(uuid, uuid, text, timestamptz, jsonb, jsonb) to authenticated;
grant execute on function public.off_market_printbatch_aanmaken(uuid, text, timestamptz, date) to authenticated;
grant execute on function public.off_market_briefversie_aan_batch_toevoegen(uuid, uuid, uuid, uuid, text, timestamptz) to authenticated;
grant execute on function public.off_market_brief_definitief_maken(uuid, uuid, uuid, text, integer, timestamptz, integer) to authenticated;
grant execute on function public.off_market_batch_documenten_registreren(uuid, uuid, text, integer, timestamptz, jsonb) to authenticated;
grant execute on function public.off_market_batch_geprint_markeren(uuid, uuid, text, integer, timestamptz) to authenticated;
grant execute on function public.off_market_brief_gepost_markeren(uuid, uuid, uuid, text, uuid, text, integer, timestamptz) to authenticated;

revoke all on function public.off_market_verwerking_starten(uuid, uuid, text, timestamptz) from public, anon;
revoke all on function public.off_market_brief_reserveren(uuid, uuid, text, timestamptz) from public, anon;
revoke all on function public.off_market_briefversie_aanmaken(uuid, uuid, text, timestamptz, jsonb, jsonb) from public, anon;
revoke all on function public.off_market_printbatch_aanmaken(uuid, text, timestamptz, date) from public, anon;
revoke all on function public.off_market_briefversie_aan_batch_toevoegen(uuid, uuid, uuid, uuid, text, timestamptz) from public, anon;
revoke all on function public.off_market_brief_definitief_maken(uuid, uuid, uuid, text, integer, timestamptz, integer) from public, anon;
revoke all on function public.off_market_batch_documenten_registreren(uuid, uuid, text, integer, timestamptz, jsonb) from public, anon;
revoke all on function public.off_market_batch_geprint_markeren(uuid, uuid, text, integer, timestamptz) from public, anon;
revoke all on function public.off_market_brief_gepost_markeren(uuid, uuid, uuid, text, uuid, text, integer, timestamptz) from public, anon;

rollback;
