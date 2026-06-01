DROP VIEW IF EXISTS public.object_huur_metrics;
ALTER TABLE public.referentie_objecten DROP COLUMN IF EXISTS prijs_per_m2;

ALTER TABLE public.objecten
  ALTER COLUMN oppervlakte TYPE numeric(14,2) USING oppervlakte::numeric,
  ALTER COLUMN oppervlakte_gbo TYPE numeric(14,2) USING oppervlakte_gbo::numeric,
  ALTER COLUMN oppervlakte_vvo TYPE numeric(14,2) USING oppervlakte_vvo::numeric,
  ALTER COLUMN oppervlakte_bvo TYPE numeric(14,2) USING oppervlakte_bvo::numeric,
  ALTER COLUMN perceel_oppervlakte TYPE numeric(14,2) USING perceel_oppervlakte::numeric;

ALTER TABLE public.calculation_components
  ALTER COLUMN surface_gbo TYPE numeric(14,2) USING surface_gbo::numeric,
  ALTER COLUMN surface_vvo TYPE numeric(14,2) USING surface_vvo::numeric,
  ALTER COLUMN surface_bvo TYPE numeric(14,2) USING surface_bvo::numeric;

ALTER TABLE public.sell_off_units
  ALTER COLUMN surface_gbo TYPE numeric(14,2) USING surface_gbo::numeric,
  ALTER COLUMN surface_vvo TYPE numeric(14,2) USING surface_vvo::numeric,
  ALTER COLUMN surface_bvo TYPE numeric(14,2) USING surface_bvo::numeric;

ALTER TABLE public.residential_wws_units
  ALTER COLUMN living_area_m2 TYPE numeric(14,2) USING living_area_m2::numeric,
  ALTER COLUMN other_indoor_space_m2 TYPE numeric(14,2) USING other_indoor_space_m2::numeric,
  ALTER COLUMN outdoor_space_m2 TYPE numeric(14,2) USING outdoor_space_m2::numeric;

ALTER TABLE public.object_huurders
  ALTER COLUMN oppervlakte_m2 TYPE numeric(14,2) USING oppervlakte_m2::numeric;

ALTER TABLE public.referentie_objecten
  ALTER COLUMN m2 TYPE numeric(14,2) USING m2::numeric;

ALTER TABLE public.zoekprofielen
  ALTER COLUMN oppervlakte_min TYPE numeric(14,2) USING oppervlakte_min::numeric,
  ALTER COLUMN oppervlakte_max TYPE numeric(14,2) USING oppervlakte_max::numeric;

-- Generated column opnieuw aanmaken met numeric m2
ALTER TABLE public.referentie_objecten
  ADD COLUMN prijs_per_m2 numeric
  GENERATED ALWAYS AS (CASE WHEN m2 > 0 THEN vraagprijs::numeric / m2 ELSE NULL::numeric END) STORED;

-- View opnieuw aanmaken met numeric verhuurde_m2
CREATE VIEW public.object_huur_metrics AS
SELECT o.id AS object_id,
  COALESCE(count(h.id), 0::bigint)::integer AS aantal_huurders,
  COALESCE(sum(h.jaarhuur), 0::numeric)::bigint AS totale_jaarhuur,
  COALESCE(sum(h.oppervlakte_m2), 0::numeric)::numeric(14,2) AS verhuurde_m2,
  CASE
    WHEN sum(h.jaarhuur) > 0::numeric THEN round(sum(EXTRACT(epoch FROM h.einddatum::timestamp without time zone::timestamp with time zone - now()) / 31557600.0 * h.jaarhuur::numeric) / NULLIF(sum(h.jaarhuur), 0::numeric), 2)
    ELSE NULL::numeric
  END AS walt_jaren,
  CASE
    WHEN sum(h.jaarhuur) > 0::numeric THEN round(sum(EXTRACT(epoch FROM h.einddatum::timestamp without time zone::timestamp with time zone - now()) / 31557600.0 * h.jaarhuur::numeric) / NULLIF(sum(h.jaarhuur), 0::numeric), 2)
    ELSE NULL::numeric
  END AS walb_jaren
FROM public.objecten o
LEFT JOIN public.object_huurders h ON h.object_id = o.id
GROUP BY o.id;

GRANT SELECT ON public.object_huur_metrics TO authenticated;
GRANT ALL ON public.object_huur_metrics TO service_role;