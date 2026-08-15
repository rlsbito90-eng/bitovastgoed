-- TRACK-2 — reconciliatie van reeds toegepaste wrapper-write-activatie.
-- Alleen de negen publieke wrappers zijn client-callable; helper en interne
-- implementaties blijven dicht. Er zijn geen directe tabelwrites voor authenticated.

grant execute on function public.off_market_verwerking_starten(uuid,uuid,text,timestamptz) to authenticated;
grant execute on function public.off_market_brief_reserveren(uuid,uuid,text,timestamptz) to authenticated;
grant execute on function public.off_market_briefversie_aanmaken(uuid,uuid,text,timestamptz,jsonb,jsonb) to authenticated;
grant execute on function public.off_market_printbatch_aanmaken(uuid,text,timestamptz,date) to authenticated;
grant execute on function public.off_market_briefversie_aan_batch_toevoegen(uuid,uuid,uuid,uuid,text,timestamptz) to authenticated;
grant execute on function public.off_market_brief_definitief_maken(uuid,uuid,uuid,text,integer,timestamptz,integer) to authenticated;
grant execute on function public.off_market_batch_documenten_registreren(uuid,uuid,text,integer,timestamptz,jsonb) to authenticated;
grant execute on function public.off_market_batch_geprint_markeren(uuid,uuid,text,integer,timestamptz) to authenticated;
grant execute on function public.off_market_brief_gepost_markeren(uuid,uuid,uuid,text,uuid,text,integer,timestamptz) to authenticated;

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

revoke insert, update, delete, truncate, references, trigger
  on table public.off_market_acquisitie_dossiers from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.off_market_brief_versies from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.off_market_printbatches from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.off_market_printbatch_brieven from authenticated;
