-- Al uitgevoerd op Supabase 2026-11-07; corresponderend met remote migratieversie 20261107125506.
-- Additieve basisvelden; oude data blijft intact. De portefeuille-indicator
-- wordt in de daaropvolgende migratie verwijderd wegens duplicatie met property_types.
ALTER TABLE public.relaties
 ADD COLUMN IF NOT EXISTS zoekgebied_toelichting text,
 ADD COLUMN IF NOT EXISTS gewenste_objectomvang text,
 ADD COLUMN IF NOT EXISTS gewenste_situatie text[],
 ADD COLUMN IF NOT EXISTS aankooptermijn text,
 ADD COLUMN IF NOT EXISTS financieringsstructuur text,
 ADD COLUMN IF NOT EXISTS financieringsstatus text,
 ADD COLUMN IF NOT EXISTS besluitvorming text,
 ADD COLUMN IF NOT EXISTS uitsluitingen text,
 ADD COLUMN IF NOT EXISTS overige_toelichting text,
 ADD COLUMN IF NOT EXISTS strategie_toelichting text,
 ADD COLUMN IF NOT EXISTS portefeuille_interesse boolean;

COMMENT ON COLUMN public.relaties.zoekgebied_toelichting IS 'Vrije zoekgebiedtekst websiteformulier; handmatig beoordelen, niet automatisch geocoderen';
COMMENT ON COLUMN public.relaties.gewenste_situatie IS 'Meerdere mogelijke situaties; automatische matching mag dit niet als één hard filter interpreteren';
COMMENT ON COLUMN public.relaties.portefeuille_interesse IS 'NULL = niet geregistreerd; TRUE/FALSE = expliciet vastgesteld';
