-- BAG BUILD 2A.7 — verificatie bovenop een actieve 2A.5-schaaldataset.
\set ON_ERROR_STOP on

SET ROLE bag_reader;

SELECT count(*) AS resultaat_rijen, bool_and(afgekapt) AS correct_afgekapt
FROM bag_service.panden_in_viewport(
  'NL_SCALE_PROXY', 100000, 450000, 101000, 451000, 2500
);

EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT *
FROM bag_service.panden_in_viewport(
  'NL_SCALE_PROXY', 100000, 450000, 100100, 450100, 2500
);

EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT *
FROM bag_service.zoek_panden(
  'NL_SCALE_PROXY', 'SCALE-PND-000050000', 100
);

RESET ROLE;

-- Zelfde vaste interne query als de SECURITY DEFINER-functie. Dit plan moet
-- bag_published_geometrieen_gist_idx tonen; een Seq Scan is een releaseblocker.
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
WITH actieve_dataset AS MATERIALIZED (
  SELECT id
  FROM bag_control.datasetversies
  WHERE scope_code = 'NL_SCALE_PROXY'
    AND status = 'actief'
    AND is_actief
),
treffers AS MATERIALIZED (
  SELECT g.datasetversie_id, g.identificatie,
         g.geometrie_volgnummer, g.geometrie
  FROM bag_published.geometrieen AS g
  JOIN actieve_dataset AS d ON d.id = g.datasetversie_id
  WHERE g.objecttype = 'Pand'
    AND g.geometrie && extensions.st_makeenvelope(
      100000, 450000, 100100, 450100, 28992
    )
  LIMIT 2501
)
SELECT * FROM treffers LIMIT 2500;

DO $security_assertions$
BEGIN
  IF NOT has_schema_privilege('bag_reader', 'bag_service', 'USAGE')
     OR has_schema_privilege('anon', 'bag_service', 'USAGE')
     OR has_schema_privilege('authenticated', 'bag_service', 'USAGE')
     OR has_schema_privilege('service_role', 'bag_service', 'USAGE')
     OR NOT has_function_privilege(
       'bag_reader',
       'bag_service.panden_in_viewport(text,double precision,double precision,double precision,double precision,integer)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION '2A.7 private serviceprivileges faalden';
  END IF;
END
$security_assertions$;

SELECT '2A.7_QUERY_SERVICE_SCALE_OK' AS status;
