-- BAG BUILD 2A.7 — private, begrensde BAG-query-/servicelaag.

CREATE SCHEMA IF NOT EXISTS bag_service;

REVOKE ALL ON SCHEMA bag_service
  FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA bag_service TO bag_reader;

CREATE INDEX IF NOT EXISTS bag_published_geometrieen_object_idx
  ON bag_published.geometrieen (
    datasetversie_id, objecttype, identificatie, geometrie_volgnummer
  );

CREATE OR REPLACE FUNCTION bag_service.panden_in_viewport(
  p_scope_code text,
  p_min_x double precision,
  p_min_y double precision,
  p_max_x double precision,
  p_max_y double precision,
  p_limiet integer DEFAULT 2500
)
RETURNS TABLE (
  datasetversie_id bigint,
  identificatie text,
  geometrie_volgnummer integer,
  geometrie_geojson jsonb,
  afgekapt boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, bag_control, bag_published, extensions
SET jit = off
AS $function$
BEGIN
  IF p_scope_code IS NULL OR NOT (p_scope_code ~ '^[A-Za-z0-9_-]{1,64}$') THEN
    RAISE EXCEPTION 'Ongeldige BAG-scopecode';
  END IF;
  IF p_limiet < 1 OR p_limiet > 2500 THEN
    RAISE EXCEPTION 'Viewportlimiet moet tussen 1 en 2500 liggen';
  END IF;
  IF p_min_x < -10000 OR p_max_x > 300000
     OR p_min_y < 275000 OR p_max_y > 630000
     OR p_min_x >= p_max_x OR p_min_y >= p_max_y THEN
    RAISE EXCEPTION 'Ongeldige of onbegrensde RD New-viewport';
  END IF;

  RETURN QUERY
  WITH actieve_dataset AS MATERIALIZED (
    SELECT d.id
    FROM bag_control.datasetversies AS d
    WHERE d.scope_code = p_scope_code
      AND d.status = 'actief'
      AND d.is_actief
  ),
  treffers AS MATERIALIZED (
    SELECT
      g.datasetversie_id,
      g.identificatie,
      g.geometrie_volgnummer,
      g.geometrie
    FROM bag_published.geometrieen AS g
    JOIN actieve_dataset AS d ON d.id = g.datasetversie_id
    WHERE g.objecttype = 'Pand'
      AND g.geometrie && extensions.st_makeenvelope(
        p_min_x, p_min_y, p_max_x, p_max_y, 28992
      )
    LIMIT p_limiet + 1
  ),
  gemarkeerd AS (
    SELECT
      t.*,
      count(*) OVER () > p_limiet AS is_afgekapt
    FROM treffers AS t
  )
  SELECT
    g.datasetversie_id,
    g.identificatie,
    g.geometrie_volgnummer,
    extensions.st_asgeojson(g.geometrie, 6, 0)::jsonb,
    g.is_afgekapt
  FROM gemarkeerd AS g
  LIMIT p_limiet;
END
$function$;

CREATE OR REPLACE FUNCTION bag_service.zoek_panden(
  p_scope_code text,
  p_na_identificatie text DEFAULT NULL,
  p_limiet integer DEFAULT 100
)
RETURNS TABLE (
  datasetversie_id bigint,
  identificatie text,
  voorkomen_sleutel text,
  status text,
  velden jsonb,
  volgende_cursor text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, bag_control, bag_published
SET jit = off
AS $function$
BEGIN
  IF p_scope_code IS NULL OR NOT (p_scope_code ~ '^[A-Za-z0-9_-]{1,64}$') THEN
    RAISE EXCEPTION 'Ongeldige BAG-scopecode';
  END IF;
  IF p_limiet < 1 OR p_limiet > 250 THEN
    RAISE EXCEPTION 'Zoeklimiet moet tussen 1 en 250 liggen';
  END IF;

  RETURN QUERY
  WITH actieve_dataset AS MATERIALIZED (
    SELECT d.id
    FROM bag_control.datasetversies AS d
    WHERE d.scope_code = p_scope_code
      AND d.status = 'actief'
      AND d.is_actief
  ),
  pagina AS (
    SELECT
      o.datasetversie_id,
      o.identificatie,
      v.voorkomen_sleutel,
      v.status,
      v.velden
    FROM bag_published.objecten AS o
    JOIN actieve_dataset AS d ON d.id = o.datasetversie_id
    JOIN bag_published.voorkomens AS v
      ON v.datasetversie_id = o.datasetversie_id
     AND v.objecttype = o.objecttype
     AND v.identificatie = o.identificatie
     AND v.is_actueel
    WHERE o.objecttype = 'Pand'
      AND (p_na_identificatie IS NULL OR o.identificatie > p_na_identificatie)
    ORDER BY o.identificatie
    LIMIT p_limiet
  )
  SELECT
    p.datasetversie_id,
    p.identificatie,
    p.voorkomen_sleutel,
    p.status,
    p.velden,
    p.identificatie AS volgende_cursor
  FROM pagina AS p
  ORDER BY p.identificatie;
END
$function$;

ALTER FUNCTION bag_service.panden_in_viewport(
  text, double precision, double precision, double precision,
  double precision, integer
) OWNER TO postgres;
ALTER FUNCTION bag_service.zoek_panden(text, text, integer) OWNER TO postgres;

REVOKE ALL ON FUNCTION bag_service.panden_in_viewport(
  text, double precision, double precision, double precision,
  double precision, integer
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION bag_service.zoek_panden(text, text, integer)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION bag_service.panden_in_viewport(
  text, double precision, double precision, double precision,
  double precision, integer
) TO bag_reader;
GRANT EXECUTE ON FUNCTION bag_service.zoek_panden(text, text, integer)
  TO bag_reader;

COMMENT ON SCHEMA bag_service IS
  'Private, begrensde BAG-querygrens; niet rechtstreeks voor app-rollen.';
COMMENT ON FUNCTION bag_service.panden_in_viewport(
  text, double precision, double precision, double precision,
  double precision, integer
) IS 'Indexbare PolygonZ-viewportquery voor de actieve BAG-dataset, maximaal 2500.';
COMMENT ON FUNCTION bag_service.zoek_panden(text, text, integer) IS
  'Keysetgepageerde pandzoekfunctie voor de actieve BAG-dataset, maximaal 250.';
