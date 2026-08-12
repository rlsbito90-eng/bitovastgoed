-- BUILD 1E.1 kandidaat — NIET automatisch toepassen.
-- Gefilterde centroidkaart voor de actieve Pandenverkenner-index.
-- Input en output zijn WGS84; intern blijft de ruimtelijke index RD New (EPSG:28992).

CREATE OR REPLACE FUNCTION bag_service.panden_in_viewport_v2(
  p_scope_code text,
  p_min_lon double precision,
  p_min_lat double precision,
  p_max_lon double precision,
  p_max_lat double precision,
  p_limiet integer DEFAULT 1500,
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
  p_vbo_modus text DEFAULT 'alle',
  p_wijk_codes text[] DEFAULT NULL,
  p_buurt_codes text[] DEFAULT NULL
)
RETURNS TABLE(
  datasetversie_id bigint,
  index_build_id bigint,
  identificatie text,
  status text,
  bouwjaar integer,
  vbo_aantal integer,
  vbo_oppervlakte_som numeric,
  gebruiksdoelen text[],
  is_gemengd boolean,
  primair_adres text,
  primair_postcode text,
  primair_plaats text,
  wijk_code text,
  wijk_naam text,
  buurt_code text,
  buurt_naam text,
  centroid_geojson jsonb,
  afgekapt boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'bag_control', 'bag_search', 'extensions'
SET jit TO 'off'
AS $function$
BEGIN
  IF p_scope_code IS NULL OR NOT (p_scope_code ~ '^[0-9]{4}$') THEN
    RAISE EXCEPTION 'Ongeldige BAG-scopecode';
  END IF;
  IF p_limiet < 1 OR p_limiet > 1500 THEN
    RAISE EXCEPTION 'Kaartlimiet moet tussen 1 en 1500 liggen';
  END IF;
  IF p_min_lon < 3.0 OR p_max_lon > 8.0 OR p_min_lat < 50.0 OR p_max_lat > 54.5
     OR p_min_lon >= p_max_lon OR p_min_lat >= p_max_lat THEN
    RAISE EXCEPTION 'Ongeldige of onbegrensde WGS84-kaartviewport';
  END IF;
  IF p_vbo_modus NOT IN ('alle','met_vbo','zonder_vbo') THEN
    RAISE EXCEPTION 'Ongeldige VBO-modus';
  END IF;
  IF cardinality(COALESCE(p_statussen, ARRAY[]::text[])) > 16
     OR cardinality(COALESCE(p_gebruiksdoelen, ARRAY[]::text[])) > 16
     OR cardinality(COALESCE(p_wijk_codes, ARRAY[]::text[])) > 64
     OR cardinality(COALESCE(p_buurt_codes, ARRAY[]::text[])) > 128 THEN
    RAISE EXCEPTION 'Te veel multiselectopties';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_wijk_codes, ARRAY[]::text[])) value
    WHERE NOT (value ~ '^WK[0-9]{4}[A-Z0-9]{2}$') OR substr(value, 3, 4) <> p_scope_code
  ) OR EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_buurt_codes, ARRAY[]::text[])) value
    WHERE NOT (value ~ '^BU[0-9]{4}[A-Z0-9]{4}$') OR substr(value, 3, 4) <> p_scope_code
  ) THEN
    RAISE EXCEPTION 'Ongeldige wijk- of buurtcode';
  END IF;
  IF p_bouwjaar_van IS NOT NULL AND p_bouwjaar_tot IS NOT NULL AND p_bouwjaar_van > p_bouwjaar_tot THEN RAISE EXCEPTION 'Ongeldig bouwjaarbereik'; END IF;
  IF p_vbo_som_van IS NOT NULL AND p_vbo_som_tot IS NOT NULL AND p_vbo_som_van > p_vbo_som_tot THEN RAISE EXCEPTION 'Ongeldig GBO-bereik'; END IF;
  IF p_vbo_max_van IS NOT NULL AND p_vbo_max_tot IS NOT NULL AND p_vbo_max_van > p_vbo_max_tot THEN RAISE EXCEPTION 'Ongeldig VBO-maxbereik'; END IF;
  IF p_vbo_aantal_van IS NOT NULL AND p_vbo_aantal_tot IS NOT NULL AND p_vbo_aantal_van > p_vbo_aantal_tot THEN RAISE EXCEPTION 'Ongeldig VBO-aantalbereik'; END IF;

  RETURN QUERY
  WITH actieve AS MATERIALIZED (
    SELECT b.id AS build_id, b.datasetversie_id
    FROM bag_search.index_builds b
    JOIN bag_control.datasetversies d
      ON d.id=b.datasetversie_id AND d.scope_code=b.scope_code AND d.status='actief' AND d.is_actief
    WHERE b.scope_code=p_scope_code
      AND b.status='actief'
      AND b.validatie_fouten=0
      AND b.gebouwd_panden=b.verwacht_panden
  ),
  viewport AS MATERIALIZED (
    SELECT extensions.st_transform(
      extensions.st_makeenvelope(p_min_lon, p_min_lat, p_max_lon, p_max_lat, 4326),
      28992
    ) AS geom
  ),
  treffers AS MATERIALIZED (
    SELECT i.*
    FROM bag_search.pand_search_index i
    JOIN actieve a ON a.build_id=i.index_build_id AND a.datasetversie_id=i.datasetversie_id
    CROSS JOIN viewport v
    WHERE i.scope_code=p_scope_code
      AND i.centroid IS NOT NULL
      AND i.centroid && v.geom
      AND extensions.st_intersects(i.centroid, v.geom)
      AND (p_bouwjaar_van IS NULL OR i.oorspronkelijk_bouwjaar >= p_bouwjaar_van)
      AND (p_bouwjaar_tot IS NULL OR i.oorspronkelijk_bouwjaar <= p_bouwjaar_tot)
      AND (cardinality(COALESCE(p_statussen, ARRAY[]::text[]))=0 OR i.pandstatus_huidig=ANY(p_statussen))
      AND (p_vbo_som_van IS NULL OR i.vbo_oppervlakte_som >= p_vbo_som_van)
      AND (p_vbo_som_tot IS NULL OR i.vbo_oppervlakte_som <= p_vbo_som_tot)
      AND (p_vbo_max_van IS NULL OR i.vbo_oppervlakte_max >= p_vbo_max_van)
      AND (p_vbo_max_tot IS NULL OR i.vbo_oppervlakte_max <= p_vbo_max_tot)
      AND (p_vbo_aantal_van IS NULL OR i.vbo_aantal >= p_vbo_aantal_van)
      AND (p_vbo_aantal_tot IS NULL OR i.vbo_aantal <= p_vbo_aantal_tot)
      AND (cardinality(COALESCE(p_gebruiksdoelen, ARRAY[]::text[]))=0 OR i.gebruiksdoelen && p_gebruiksdoelen)
      AND (p_is_gemengd IS NULL OR i.is_gemengd=p_is_gemengd)
      AND (cardinality(COALESCE(p_wijk_codes, ARRAY[]::text[]))=0 OR i.wijk_code=ANY(p_wijk_codes))
      AND (cardinality(COALESCE(p_buurt_codes, ARRAY[]::text[]))=0 OR i.buurt_code=ANY(p_buurt_codes))
      AND (p_vbo_modus='alle' OR (p_vbo_modus='met_vbo' AND i.heeft_vbo) OR (p_vbo_modus='zonder_vbo' AND NOT i.heeft_vbo))
    ORDER BY i.pand_identificatie
    LIMIT p_limiet + 1
  ),
  gemarkeerd AS (
    SELECT t.*, count(*) OVER () > p_limiet AS is_afgekapt
    FROM treffers t
  )
  SELECT
    g.datasetversie_id,
    g.index_build_id,
    g.pand_identificatie,
    g.pandstatus_huidig,
    g.oorspronkelijk_bouwjaar,
    g.vbo_aantal,
    g.vbo_oppervlakte_som,
    g.gebruiksdoelen,
    g.is_gemengd,
    g.primair_adres,
    g.primair_postcode,
    g.primair_plaats,
    g.wijk_code,
    g.wijk_naam,
    g.buurt_code,
    g.buurt_naam,
    extensions.st_asgeojson(extensions.st_transform(g.centroid, 4326), 6, 0)::jsonb,
    g.is_afgekapt
  FROM gemarkeerd g
  LIMIT p_limiet;
END
$function$;

-- Activatiegate buiten deze kandidaat:
-- REVOKE ALL ON FUNCTION bag_service.panden_in_viewport_v2(...) FROM PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION bag_service.panden_in_viewport_v2(...) TO bag_reader;
