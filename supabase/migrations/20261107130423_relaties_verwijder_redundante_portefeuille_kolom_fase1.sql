-- Al uitgevoerd 2026-11-07; remote migratieversie 20261107130423.
-- Voorkomt dubbele portefeuillebron naast bestaande property_types-taxonomie.
-- Geen dataverlies toestaan: stop wanneer onverwacht ingevulde data bestaat.
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.relaties WHERE portefeuille_interesse IS NOT NULL) THEN
   RAISE EXCEPTION 'Kolom bevat gegevens; verwijdering geblokkeerd';
 END IF;
END $$;

ALTER TABLE public.relaties DROP COLUMN IF EXISTS portefeuille_interesse;
