-- TRACK-2 — reconciliatie van reeds toegepaste read-activatie.
-- Productie bevat deze migratieversie al. Dit bestand maakt de lokale historie
-- gelijk aan remote en beschrijft idempotent de huidige least-privilege toestand.

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

drop policy if exists acquisitie_productiekern_dossiers_intern_lezen on public.off_market_acquisitie_dossiers;
create policy acquisitie_productiekern_dossiers_intern_lezen
  on public.off_market_acquisitie_dossiers for select to authenticated
  using (public.is_intern_gebruiker(auth.uid()));

drop policy if exists acquisitie_productiekern_briefversies_intern_lezen on public.off_market_brief_versies;
create policy acquisitie_productiekern_briefversies_intern_lezen
  on public.off_market_brief_versies for select to authenticated
  using (public.is_intern_gebruiker(auth.uid()));

drop policy if exists acquisitie_productiekern_printbatches_intern_lezen on public.off_market_printbatches;
create policy acquisitie_productiekern_printbatches_intern_lezen
  on public.off_market_printbatches for select to authenticated
  using (public.is_intern_gebruiker(auth.uid()));

drop policy if exists acquisitie_productiekern_printbatch_brieven_intern_lezen on public.off_market_printbatch_brieven;
create policy acquisitie_productiekern_printbatch_brieven_intern_lezen
  on public.off_market_printbatch_brieven for select to authenticated
  using (public.is_intern_gebruiker(auth.uid()));

revoke insert, update, delete, truncate, references, trigger
  on table public.off_market_acquisitie_dossiers from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.off_market_brief_versies from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.off_market_printbatches from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.off_market_printbatch_brieven from authenticated;
