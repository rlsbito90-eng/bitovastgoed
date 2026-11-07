-- Al uitgevoerd op Supabase 2026-11-07; remote migratieversie 20261107145805.
-- Officiële gemeenten en losse plaatsen zijn direct deel van Relaties.
-- Behoud bestaande waarden: nullable, geen default, geen backfill.
ALTER TABLE public.relaties
  ADD COLUMN IF NOT EXISTS zoek_gemeenten text[],
  ADD COLUMN IF NOT EXISTS zoek_plaatsen text[];

COMMENT ON COLUMN public.relaties.zoek_gemeenten IS 'Primaire bestuurlijke zoekgemeenten op Relaties; zonder gevalideerde objectgemeente blijft matching te verifiëren';
COMMENT ON COLUMN public.relaties.zoek_plaatsen IS 'Primaire zoekplaatsen, apart van bestuurlijke gemeente; bedoeld als R2-geografisch criterium';
