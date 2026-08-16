-- Canonieke, automatisch afgeleide primaire rechthebbenden voor Off-Market acquisitie.
-- Bron blijft het opgeslagen Kadasterbericht; dit veld voorkomt dat een dossier met
-- meerdere rechthebbenden kunstmatig tot één `eigenaar_*` record wordt gereduceerd.
-- Geen bestaande data wordt gemuteerd door deze migratie.

alter table public.off_market_signalen
  add column if not exists eigenaar_rechthebbenden jsonb not null default '[]'::jsonb;

comment on column public.off_market_signalen.eigenaar_rechthebbenden is
  'Canonieke primaire acquisitierechthebbenden uit eigenaarsonderzoek/Kadaster; array met naam/bedrijfsnaam, KvK, aandeel, rechtstype en correspondentieadres.';

alter table public.off_market_signalen
  drop constraint if exists off_market_signalen_eigenaar_rechthebbenden_array_check;

alter table public.off_market_signalen
  add constraint off_market_signalen_eigenaar_rechthebbenden_array_check
  check (jsonb_typeof(eigenaar_rechthebbenden) = 'array');
