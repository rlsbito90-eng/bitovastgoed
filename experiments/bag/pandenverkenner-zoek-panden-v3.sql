-- BUILD 1C.2 kandidaat — NIET automatisch toepassen.
-- Nieuwe functie naast bag_service.zoek_panden_v2; v2 blijft fallback.
-- Multiselectsemantiek:
--   statussen: OR (pandstatus = ANY geselecteerde status)
--   gebruiksdoelen: OR (array-overlap met minimaal één geselecteerde functie)

CREATE OR REPLACE FUNCTION bag_service.zoek_panden_v3(
  p_scope_code text,
  p_na_identificatie text DEFAULT NULL,
  p_limiet integer DEFAULT 100,
  p_bouwjaar_van integer DEFAULT NULL,
  p_bouwjaar_tot integer DEFAULT NULL,
  p_statussen text[] DEFAULT NULL,
  p_vbo_som_van numeric DEFAULT NULL,
  p_vbo_som_tot numeric DEFAULT NULL,
  p_vbo_max_van numeric DEFAULT NULL,
  p_vbo_max_tot numeric DEFAULT NULL,
  p_vbo_aantal_van integer DEFAULT NULL,
  p_vbo_aantal_tot integer DEFAULT NULL,
  p_gebruiksdoelen text[] DEFAULT NULL,
  p_is_gemengd boolean DEFAULT NULL,
  p_vbo_modus text DEFAULT 'alle'
)
RETURNS TABLE(
  datasetversie_id bigint,
  index_build_id bigint,
  identificatie text,
  voorkomen_sleutel text,
  status text,
  bouwjaar integer,
  heeft_vbo boolean,
  vbo_aantal integer,
  vbo_oppervlakte_som numeric,
  vbo_oppervlakte_max numeric,
  gebruiksdoelen text[],
  is_gemengd boolean,
  primair_nummeraanduiding_id text,
  primair_adres text,
  primair_straat text,
  primair_huisnummer text,
  primair_postcode text,
  primair_plaats text,
  adres_count integer,
  gemeente_code text,
  gemeente_naam text,
  wijk_code text,
  wijk_naam text,
  buurt_code text,
  buurt_naam text,
  centroid geometry,
  pand_geometrie geometry,
  volgende_cursor text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'bag_control', 'bag_search'
SET jit TO 'off'
AS $function$
BEGIN
  IF p_scope_code IS NULL OR NOT (p_scope_code ~ '^[A-Za-z0-9_-]{1,64}$') THEN
    RAISE EXCEPTION 'Ongeldige BAG-scopecode';
  END IF;
  IF p_limiet < 1 OR p_limiet > 250 THEN
    RAISE EXCEPTION 'Zoeklimiet moet tussen 1 en 250 liggen';
  END IF;
  IF p_vbo_modus NOT IN ('alle','met_vbo','zonder_vbo') THEN
    RAISE EXCEPTION 'Ongeldige VBO-modus';
  END IF;
  IF cardinality(COALESCE(p_statussen, ARRAY[]::text[])) > 16
     OR cardinality(COALESCE(p_gebruiksdoelen, ARRAY[]::text[])) > 16 THEN
    RAISE EXCEPTION 'Te veel multiselectopties';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_statussen, ARRAY[]::text[])) value
    WHERE btrim(value) = '' OR length(value) > 128
  ) OR EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_gebruiksdoelen, ARRAY[]::text[])) value
    WHERE btrim(value) = '' OR length(value) > 128
  ) THEN
    RAISE EXCEPTION 'Ongeldige multiselectoptie';
  END IF;
  IF p_bouwjaar_van IS NOT NULL AND p_bouwjaar_tot IS NOT NULL AND p_bouwjaar_van > p_bouwjaar_tot THEN
    RAISE EXCEPTION 'Ongeldig bouwjaarbereik';
  END IF;
  IF p_vbo_som_van IS NOT NULL AND p_vbo_som_tot IS NOT NULL AND p_vbo_som_van > p_vbo_som_tot THEN
    RAISE EXCEPTION 'Ongeldig GBO-bereik';
  END IF;
  IF p_vbo_max_van IS NOT NULL AND p_vbo_max_tot IS NOT NULL AND p_vbo_max_van > p_vbo_max_tot THEN
    RAISE EXCEPTION 'Ongeldig VBO-maxbereik';
  END IF;
  IF p_vbo_aantal_van IS NOT NULL AND p_vbo_aantal_tot IS NOT NULL AND p_vbo_aantal_van > p_vbo_aantal_tot THEN
    RAISE EXCEPTION 'Ongeldig VBO-aantalbereik';
  END IF;

  RETURN QUERY
  WITH actieve AS MATERIALIZED (
    SELECT b.id AS build_id, b.datasetversie_id
    FROM bag_search.index_builds b
    JOIN bag_control.datasetversies d
      ON d.id = b.datasetversie_id
     AND d.scope_code = b.scope_code
     AND d.status = 'actief'
     AND d.is_actief
    WHERE b.scope_code = p_scope_code
      AND b.status = 'actief'
      AND b.validatie_fouten = 0
      AND b.gebouwd_panden = b.verwacht_panden
  )
  SELECT
    i.datasetversie_id,
    i.index_build_id,
    i.pand_identificatie,
    i.voorkomen_sleutel,
    i.pandstatus_huidig,
    i.oorspronkelijk_bouwjaar,
    i.heeft_vbo,
    i.vbo_aantal,
    i.vbo_oppervlakte_som,
    i.vbo_oppervlakte_max,
    i.gebruiksdoelen,
    i.is_gemengd,
    i.primair_nummeraanduiding_id,
    i.primair_adres,
    i.primair_straat,
    i.primair_huisnummer,
    i.primair_postcode,
    i.primair_plaats,
    i.adres_count,
    i.gemeente_code,
    i.gemeente_naam,
    i.wijk_code,
    i.wijk_naam,
    i.buurt_code,
    i.buurt_naam,
    i.centroid,
    i.pand_geometrie,
    i.pand_identificatie AS volgende_cursor
  FROM bag_search.pand_search_index i
  JOIN actieve a
    ON a.build_id = i.index_build_id
   AND a.datasetversie_id = i.datasetversie_id
  WHERE i.scope_code = p_scope_code
    AND (p_na_identificatie IS NULL OR i.pand_identificatie > p_na_identificatie)
    AND (p_bouwjaar_van IS NULL OR i.oorspronkelijk_bouwjaar >= p_bouwjaar_van)
    AND (p_bouwjaar_tot IS NULL OR i.oorspronkelijk_bouwjaar <= p_bouwjaar_tot)
    AND (cardinality(COALESCE(p_statussen, ARRAY[]::text[])) = 0 OR i.pandstatus_huidig = ANY(p_statussen))
    AND (p_vbo_som_van IS NULL OR i.vbo_oppervlakte_som >= p_vbo_som_van)
    AND (p_vbo_som_tot IS NULL OR i.vbo_oppervlakte_som <= p_vbo_som_tot)
    AND (p_vbo_max_van IS NULL OR i.vbo_oppervlakte_max >= p_vbo_max_van)
    AND (p_vbo_max_tot IS NULL OR i.vbo_oppervlakte_max <= p_vbo_max_tot)
    AND (p_vbo_aantal_van IS NULL OR i.vbo_aantal >= p_vbo_aantal_van)
    AND (p_vbo_aantal_tot IS NULL OR i.vbo_aantal <= p_vbo_aantal_tot)
    AND (cardinality(COALESCE(p_gebruiksdoelen, ARRAY[]::text[])) = 0 OR i.gebruiksdoelen && p_gebruiksdoelen)
    AND (p_is_gemengd IS NULL OR i.is_gemengd = p_is_gemengd)
    AND (
      p_vbo_modus = 'alle'
      OR (p_vbo_modus = 'met_vbo' AND i.heeft_vbo)
      OR (p_vbo_modus = 'zonder_vbo' AND NOT i.heeft_vbo)
    )
  ORDER BY i.pand_identificatie
  LIMIT p_limiet;
END
$function$;

-- Geen DROP/REPLACE van zoek_panden_v2.
-- Geen GRANT in deze kandidaat; permissions worden in de apply-gate expliciet gecontroleerd.
