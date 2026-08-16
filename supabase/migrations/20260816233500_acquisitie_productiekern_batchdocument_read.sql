-- Productiekern — geregistreerde BAT-artifacts moeten na refresh opnieuw
-- bereikbaar zijn zonder de formele documentset opnieuw te renderen.
-- Alleen interne authenticated gebruikers krijgen read; writes blijven RPC-only.

revoke all on table public.off_market_batchdocumenten from anon, authenticated;
grant select on table public.off_market_batchdocumenten to authenticated;

alter table public.off_market_batchdocumenten enable row level security;

drop policy if exists acquisitie_productiekern_batchdocumenten_intern_lezen
  on public.off_market_batchdocumenten;
create policy acquisitie_productiekern_batchdocumenten_intern_lezen
  on public.off_market_batchdocumenten
  for select
  to authenticated
  using (public.is_intern_gebruiker(auth.uid()));

revoke insert, update, delete, truncate, references, trigger
  on table public.off_market_batchdocumenten from authenticated;
