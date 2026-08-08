-- BUILD A — LEAST-PRIVILEGE ACTIVATIE SECURITY
-- NIET AUTOMATISCH TOEPASSEN.
-- Reviewdraft buiten supabase/migrations. Eindigt expliciet met ROLLBACK.
--
-- Dit bestand beschrijft uitsluitend het minimaal noodzakelijke toekomstige
-- activatiemodel nadat migratie, volledige tests, previewacceptatie én apart
-- productieakkoord groen zijn. Het activeert nu niets.

begin;

-- Nieuwe readmodellen: authenticated mag alleen SELECT en uitsluitend wanneer
-- de bestaande live CRM-helper de JWT-gebruiker als admin/medewerker herkent.
revoke all on table public.off_market_acquisitie_dossiers from anon, authenticated;
revoke all on table public.off_market_brief_versies from anon, authenticated;
revoke all on table public.off_market_printbatches from anon, authenticated;
revoke all on table public.off_market_printbatch_brieven from anon, authenticated;

grant select on table public.off_market_acquisitie_dossiers to authenticated;
grant select on table public.off_market_brief_versies to authenticated;
grant select on table public.off_market_printbatches to authenticated;
grant select on table public.off_market_printbatch_brieven to authenticated;

alter table public.off_market_acquisitie_dossiers enable row level security;
alter table public.off_market_brief_versies enable row level security;
alter table public.off_market_printbatches enable row level security;
alter table public.off_market_printbatch_brieven enable row level security;

drop policy if exists acquisitie_productiekern_dossiers_intern_lezen
  on public.off_market_acquisitie_dossiers;
create policy acquisitie_productiekern_dossiers_intern_lezen
  on public.off_market_acquisitie_dossiers
  for select
  to authenticated
  using (public.is_intern_gebruiker(auth.uid()));

drop policy if exists acquisitie_productiekern_briefversies_intern_lezen
  on public.off_market_brief_versies;
create policy acquisitie_productiekern_briefversies_intern_lezen
  on public.off_market_brief_versies
  for select
  to authenticated
  using (public.is_intern_gebruiker(auth.uid()));

drop policy if exists acquisitie_productiekern_printbatches_intern_lezen
  on public.off_market_printbatches;
create policy acquisitie_productiekern_printbatches_intern_lezen
  on public.off_market_printbatches
  for select
  to authenticated
  using (public.is_intern_gebruiker(auth.uid()));

drop policy if exists acquisitie_productiekern_printbatch_brieven_intern_lezen
  on public.off_market_printbatch_brieven;
create policy acquisitie_productiekern_printbatch_brieven_intern_lezen
  on public.off_market_printbatch_brieven
  for select
  to authenticated
  using (public.is_intern_gebruiker(auth.uid()));

-- Directe writes blijven verboden. Alle mutaties lopen uitsluitend via de
-- security-wrappers, die auth.uid(), interne rol en p_actor_id controleren.
revoke insert, update, delete, truncate, references, trigger
  on table public.off_market_acquisitie_dossiers from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.off_market_brief_versies from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.off_market_printbatches from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.off_market_printbatch_brieven from authenticated;

-- Alleen de negen publieke wrappers worden toekomstig callable.
grant execute on function public.off_market_verwerking_starten(uuid,uuid,text,timestamptz) to authenticated;
grant execute on function public.off_market_brief_reserveren(uuid,uuid,text,timestamptz) to authenticated;
grant execute on function public.off_market_briefversie_aanmaken(uuid,uuid,text,timestamptz,jsonb,jsonb) to authenticated;
grant execute on function public.off_market_printbatch_aanmaken(uuid,text,timestamptz,date) to authenticated;
grant execute on function public.off_market_briefversie_aan_batch_toevoegen(uuid,uuid,uuid,uuid,text,timestamptz) to authenticated;
grant execute on function public.off_market_brief_definitief_maken(uuid,uuid,uuid,text,integer,timestamptz,integer) to authenticated;
grant execute on function public.off_market_batch_documenten_registreren(uuid,uuid,text,integer,timestamptz,jsonb) to authenticated;
grant execute on function public.off_market_batch_geprint_markeren(uuid,uuid,text,integer,timestamptz) to authenticated;
grant execute on function public.off_market_brief_gepost_markeren(uuid,uuid,uuid,text,uuid,text,integer,timestamptz) to authenticated;

-- Helper en interne implementaties blijven expliciet niet-callable.
revoke all on function public.off_market_productiekern_assert_interne_actor(uuid) from public, anon, authenticated;
revoke all on function public.off_market_verwerking_starten_intern(uuid,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.off_market_brief_reserveren_intern(uuid,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.off_market_briefversie_aanmaken_intern(uuid,uuid,text,timestamptz,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.off_market_printbatch_aanmaken_intern(uuid,text,timestamptz,date) from public,anon,authenticated;
revoke all on function public.off_market_briefversie_aan_batch_toevoegen_intern(uuid,uuid,uuid,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.off_market_brief_definitief_maken_intern(uuid,uuid,uuid,text,integer,timestamptz,integer) from public,anon,authenticated;
revoke all on function public.off_market_batch_documenten_registreren_intern(uuid,uuid,text,integer,timestamptz,jsonb) from public,anon,authenticated;
revoke all on function public.off_market_batch_geprint_markeren_intern(uuid,uuid,text,integer,timestamptz) from public,anon,authenticated;
revoke all on function public.off_market_brief_gepost_markeren_intern(uuid,uuid,uuid,text,uuid,text,integer,timestamptz) from public,anon,authenticated;

-- Bestaande off_market_brieven-policies/grants worden bewust niet gewijzigd;
-- die zijn live read-only geverifieerd en blijven legacy + productiekern delen.
-- Tabellen zonder huidig direct readcontract (nummerreeksen, batchdocumenten,
-- productie_events) krijgen in deze activatie geen clientgrant.

rollback;
