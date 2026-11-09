-- Locatieverificatie zonder fictieve radiusmatches.
-- PDOK bron en verificatietijd zijn expliciet; adreswijzigingen maken punten ongeldig.
ALTER TABLE public.relaties
  ADD COLUMN IF NOT EXISTS zoek_radius_bron text,
  ADD COLUMN IF NOT EXISTS zoek_radius_geverifieerd_op timestamptz;
ALTER TABLE public.objecten
  ADD COLUMN IF NOT EXISTS geo_geverifieerd_op timestamptz;

ALTER TABLE public.relaties
  ADD CONSTRAINT zoek_radius_pdok_bron_consistent CHECK (
    (zoek_radius_lat IS NULL AND zoek_radius_lon IS NULL AND zoek_radius_bron IS NULL AND zoek_radius_geverifieerd_op IS NULL)
    OR (zoek_radius_lat IS NOT NULL AND zoek_radius_lon IS NOT NULL
      AND zoek_radius_bron LIKE 'PDOK-WOONPLAATS:%' AND zoek_radius_geverifieerd_op IS NOT NULL)
  );
ALTER TABLE public.objecten
  ADD CONSTRAINT object_geo_pdok_bron_consistent CHECK (
    (geo_lat IS NULL AND geo_lon IS NULL AND geo_bron IS NULL AND geo_geverifieerd_op IS NULL)
    OR (geo_lat IS NOT NULL AND geo_lon IS NOT NULL
      AND geo_bron LIKE 'PDOK-BAG:%' AND geo_geverifieerd_op IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.crm_clear_object_geo_if_address_changed()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF (NEW.adres,NEW.postcode,NEW.plaats) IS DISTINCT FROM (OLD.adres,OLD.postcode,OLD.plaats) THEN
    NEW.geo_lat := NULL;
    NEW.geo_lon := NULL;
    NEW.geo_bron := NULL;
    NEW.geo_geverifieerd_op := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crm_objectadres_invalidates_geo ON public.objecten;
CREATE TRIGGER crm_objectadres_invalidates_geo BEFORE UPDATE ON public.objecten
FOR EACH ROW EXECUTE FUNCTION public.crm_clear_object_geo_if_address_changed();

CREATE OR REPLACE FUNCTION public.crm_clear_radius_geo_if_center_changed()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.zoek_radius_centrum IS DISTINCT FROM OLD.zoek_radius_centrum THEN
    NEW.zoek_radius_lat := NULL;
    NEW.zoek_radius_lon := NULL;
    NEW.zoek_radius_bron := NULL;
    NEW.zoek_radius_geverifieerd_op := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crm_radius_center_invalidates_geo ON public.relaties;
CREATE TRIGGER crm_radius_center_invalidates_geo BEFORE UPDATE ON public.relaties
FOR EACH ROW EXECUTE FUNCTION public.crm_clear_radius_geo_if_center_changed();

COMMENT ON COLUMN public.objecten.geo_bron IS 'Handmatig gekozen PDOK-BAG adresresultaat: bron ID en leesbaar referentieadres.';
COMMENT ON COLUMN public.relaties.zoek_radius_bron IS 'Geverifieerd PDOK woonplaats-resultaat (centrum van de woonplaats, niet werkelijk vertrekadres).';
COMMENT ON COLUMN public.objecten.geo_geverifieerd_op IS 'Tijdstip van bewuste BAG-adresbevestiging door interne CRM-gebruiker.';
COMMENT ON COLUMN public.relaties.zoek_radius_geverifieerd_op IS 'Tijdstip van bewuste PDOK-woonplaatsbevestiging.';
