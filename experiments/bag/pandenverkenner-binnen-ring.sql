-- Pandenverkenner — geometrische filter "Amsterdam binnen de ring".
--
-- De bestaande API-contracten blijven intact. De interne pseudo-wijkcode
-- WK0363RG wordt uitsluitend voor scope 0363 geïnterpreteerd als:
-- binnen de A10, ten zuiden van het IJ. Amsterdam-Noord telt niet mee.
--
-- De polygon is bewust gelijk aan src/lib/offMarket/amsterdamRing.ts.
-- Geen postcode- of wijkbenadering: classificatie gebeurt op het BAG-pandcentroid.

CREATE OR REPLACE FUNCTION bag_service.is_binnen_amsterdam_ring(
  p_centroid extensions.geometry
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'pg_catalog', 'extensions'
AS $function$
  SELECT p_centroid IS NOT NULL
    AND extensions.st_covers(
      extensions.st_transform(
        extensions.st_geomfromtext(
          'POLYGON((
            4.7960 52.3845,
            4.8000 52.3720,
            4.7910 52.3550,
            4.7900 52.3390,
            4.8010 52.3265,
            4.8240 52.3195,
            4.8500 52.3180,
            4.8780 52.3185,
            4.9050 52.3210,
            4.9300 52.3270,
            4.9490 52.3380,
            4.9610 52.3520,
            4.9670 52.3680,
            4.9630 52.3820,
            4.9500 52.3890,
            4.9250 52.3885,
            4.9000 52.3865,
            4.8750 52.3850,
            4.8500 52.3845,
            4.8250 52.3850,
            4.7960 52.3845
          ))',
          4326
        ),
        28992
      ),
      p_centroid
    );
$function$;

REVOKE ALL ON FUNCTION bag_service.is_binnen_amsterdam_ring(extensions.geometry) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bag_service.is_binnen_amsterdam_ring(extensions.geometry) TO bag_reader;

-- Houd de bestaande signatures van zoek_panden_v4 en panden_kaart_v3 intact.
-- We wijzigen alleen hun interne interpretatie van de gereserveerde sentinel.
DO $migration$
DECLARE
  v_def text;
  v_new text;
  v_old_wijk text := 'AND (cardinality(COALESCE(p_wijk_codes,ARRAY[]::text[]))=0 OR i.wijk_code=ANY(p_wijk_codes))';
  v_new_wijk text := 'AND (cardinality(array_remove(COALESCE(p_wijk_codes,ARRAY[]::text[]),''WK0363RG''))=0 OR i.wijk_code=ANY(array_remove(COALESCE(p_wijk_codes,ARRAY[]::text[]),''WK0363RG'')))';
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'bag_service'
    AND p.proname = 'zoek_panden_v4'
    AND pg_get_function_identity_arguments(p.oid) = 'p_scope_code text, p_na_identificatie text, p_limiet integer, p_bouwjaar_van integer, p_bouwjaar_tot integer, p_statussen text[], p_vbo_som_van numeric, p_vbo_som_tot numeric, p_vbo_max_van numeric, p_vbo_max_tot numeric, p_vbo_aantal_van integer, p_vbo_aantal_tot integer, p_gebruiksdoelen text[], p_is_gemengd boolean, p_vbo_modus text, p_wijk_codes text[], p_buurt_codes text[]';

  IF v_def IS NULL THEN RAISE EXCEPTION 'zoek_panden_v4 bronfunctie ontbreekt'; END IF;
  IF position(v_old_wijk IN v_def) = 0 THEN RAISE EXCEPTION 'zoek_panden_v4 wijkpredicate wijkt af van verwacht contract'; END IF;

  v_new := replace(v_def, v_old_wijk, v_new_wijk);
  v_new := replace(
    v_new,
    'WHERE i.scope_code=p_scope_code' || E'\n',
    'WHERE i.scope_code=p_scope_code' || E'\n' ||
    '    AND (NOT (''WK0363RG''=ANY(COALESCE(p_wijk_codes,ARRAY[]::text[]))) OR bag_service.is_binnen_amsterdam_ring(i.centroid))' || E'\n'
  );
  IF v_new = v_def OR position('bag_service.is_binnen_amsterdam_ring(i.centroid)' IN v_new) = 0 THEN
    RAISE EXCEPTION 'zoek_panden_v4 ringpatch kon niet veilig worden opgebouwd';
  END IF;
  EXECUTE v_new;

  SELECT pg_get_functiondef(p.oid)
  INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'bag_service'
    AND p.proname = 'panden_kaart_v3'
    AND pg_get_function_identity_arguments(p.oid) = 'p_scope_code text, p_min_lon double precision, p_min_lat double precision, p_max_lon double precision, p_max_lat double precision, p_zoom double precision, p_limiet integer, p_bouwjaar_van integer, p_bouwjaar_tot integer, p_statussen text[], p_vbo_som_van numeric, p_vbo_som_tot numeric, p_vbo_max_van numeric, p_vbo_max_tot numeric, p_vbo_aantal_van integer, p_vbo_aantal_tot integer, p_gebruiksdoelen text[], p_is_gemengd boolean, p_vbo_modus text, p_wijk_codes text[], p_buurt_codes text[]';

  IF v_def IS NULL THEN RAISE EXCEPTION 'panden_kaart_v3 bronfunctie ontbreekt'; END IF;
  IF position(v_old_wijk IN v_def) = 0 THEN RAISE EXCEPTION 'panden_kaart_v3 wijkpredicate wijkt af van verwacht contract'; END IF;

  v_new := replace(v_def, v_old_wijk, v_new_wijk);
  v_new := replace(
    v_new,
    'WHERE i.scope_code=p_scope_code AND i.centroid IS NOT NULL' || E'\n',
    'WHERE i.scope_code=p_scope_code AND i.centroid IS NOT NULL' || E'\n' ||
    '        AND (NOT (''WK0363RG''=ANY(COALESCE(p_wijk_codes,ARRAY[]::text[]))) OR bag_service.is_binnen_amsterdam_ring(i.centroid))' || E'\n'
  );
  IF v_new = v_def OR position('bag_service.is_binnen_amsterdam_ring(i.centroid)' IN v_new) = 0 THEN
    RAISE EXCEPTION 'panden_kaart_v3 ringpatch kon niet veilig worden opgebouwd';
  END IF;
  EXECUTE v_new;
END
$migration$;

-- Contractchecks voor menselijke review / handmatige verificatie:
-- 1. SELECT count(*) FROM bag_search.pand_search_index WHERE scope_code='0363'
--      AND bag_service.is_binnen_amsterdam_ring(centroid);
-- 2. zoek_panden_v4(..., ARRAY['WK0363RG'], ...) mag alleen panden binnen polygon retourneren.
-- 3. Zonder WK0363RG moet het resultaat gelijk blijven aan vóór deze patch.
