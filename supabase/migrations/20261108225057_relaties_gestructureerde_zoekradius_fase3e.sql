-- Behoud vrije zoektoelichting; voeg gestructureerde radius toe.
ALTER TABLE public.relaties
 ADD COLUMN IF NOT EXISTS zoek_radius_centrum text,
 ADD COLUMN IF NOT EXISTS zoek_radius_waarde numeric,
 ADD COLUMN IF NOT EXISTS zoek_radius_eenheid text,
 ADD COLUMN IF NOT EXISTS zoek_radius_lat double precision,
 ADD COLUMN IF NOT EXISTS zoek_radius_lon double precision;
ALTER TABLE public.relaties
 ADD CONSTRAINT zoek_radius_geldige_eenheid CHECK (zoek_radius_eenheid IS NULL OR zoek_radius_eenheid IN ('km_hemelsbreed','minuten_reistijd')),
 ADD CONSTRAINT zoek_radius_geldige_waarde CHECK (zoek_radius_waarde IS NULL OR (zoek_radius_waarde>0 AND zoek_radius_waarde<=1000)),
 ADD CONSTRAINT zoek_radius_lat_check CHECK (zoek_radius_lat IS NULL OR (zoek_radius_lat BETWEEN -90 AND 90)),
 ADD CONSTRAINT zoek_radius_lon_check CHECK (zoek_radius_lon IS NULL OR (zoek_radius_lon BETWEEN -180 AND 180));
-- R2 kent afstand pas wanneer objectcoördinaten herleidbaar en controleerbaar zijn.
ALTER TABLE public.objecten
 ADD COLUMN IF NOT EXISTS geo_lat double precision,
 ADD COLUMN IF NOT EXISTS geo_lon double precision,
 ADD COLUMN IF NOT EXISTS geo_bron text;
ALTER TABLE public.objecten
 ADD CONSTRAINT object_geo_lat_check CHECK (geo_lat IS NULL OR (geo_lat BETWEEN -90 AND 90)),
 ADD CONSTRAINT object_geo_lon_check CHECK (geo_lon IS NULL OR (geo_lon BETWEEN -180 AND 180));

-- Brongetrouwe conversie van vier bestaande profielvoorwaarden, zonder geografische aannames.
WITH bron(tekst,centrum,waarde,eenheid) AS (
  VALUES
   ('35 km vanaf Amersfoort','Amersfoort',35::numeric,'km_hemelsbreed'),
   ('Utrecht, maximaal 25 km','Utrecht',25::numeric,'km_hemelsbreed'),
   ('Bergen op Zoom, max. 25 km','Bergen op Zoom',25::numeric,'km_hemelsbreed'),
   ('Maximale reistijd van 60 minuten vanaf Ede. Denk aan Gelderland, Utrecht, Overijssel, Flevoland en Noord-Brabant.',
    'Ede',60::numeric,'minuten_reistijd')
)
UPDATE public.relaties r SET
  zoek_radius_centrum=b.centrum,
  zoek_radius_waarde=b.waarde,
  zoek_radius_eenheid=b.eenheid
FROM bron b
WHERE r.soft_deleted_at IS NULL
  AND trim(r.zoekgebied_toelichting)=b.tekst
  AND r.zoek_radius_eenheid IS NULL AND r.zoek_radius_centrum IS NULL AND r.zoek_radius_waarde IS NULL;

COMMENT ON COLUMN public.relaties.zoek_radius_centrum IS 'Oorspronkelijke centrumplaats, exacte locatie nog te verifiëren voor automatische kilometermatching.';
COMMENT ON COLUMN public.relaties.zoek_radius_eenheid IS 'km_hemelsbreed of minuten_reistijd; reistijd vereist afzonderlijke routeberekening.';
COMMENT ON COLUMN public.relaties.zoek_radius_lat IS 'Alleen een verifieerbaar gegeocodeerd centrum; niet uit plaatsnaam gokken.';
COMMENT ON COLUMN public.objecten.geo_lat IS 'Alleen geverifieerde objectlocatie, bijv. via BAG/PDOK; niet uit provincie of woonplaats afleiden.';