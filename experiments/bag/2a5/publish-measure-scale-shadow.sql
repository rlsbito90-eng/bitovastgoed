-- BAG BUILD 2A.5 — publicatie en meting van de deterministische schaallading.
\set ON_ERROR_STOP on

BEGIN;
SET LOCAL statement_timeout = '110s';
SET LOCAL lock_timeout = '5s';

GRANT bag_publisher, bag_reader TO postgres WITH SET TRUE, INHERIT FALSE;
SET LOCAL ROLE bag_publisher;

INSERT INTO bag_published.objecten
SELECT * FROM bag_staging.objecten WHERE datasetversie_id = :dataset_id;

INSERT INTO bag_published.voorkomens
SELECT * FROM bag_staging.voorkomens WHERE datasetversie_id = :dataset_id;

INSERT INTO bag_published.relaties
SELECT * FROM bag_staging.relaties WHERE datasetversie_id = :dataset_id;

INSERT INTO bag_published.geometrieen
SELECT * FROM bag_staging.geometrieen WHERE datasetversie_id = :dataset_id;

UPDATE bag_control.datasetversies
SET status = 'actief',
    is_actief = true,
    gevalideerd_op = now(),
    geactiveerd_op = now()
WHERE id = :dataset_id;

RESET ROLE;
COMMIT;

ANALYZE bag_published.objecten;
ANALYZE bag_published.voorkomens;
ANALYZE bag_published.relaties;
ANALYZE bag_published.geometrieen;

SET ROLE bag_reader;

DO $assertions$
DECLARE
  object_count bigint;
  voorkomen_count bigint;
  relatie_count bigint;
  geometrie_count bigint;
BEGIN
  SELECT count(*) INTO object_count FROM bag_published.objecten;
  SELECT count(*) INTO voorkomen_count FROM bag_published.voorkomens;
  SELECT count(*) INTO relatie_count FROM bag_published.relaties;
  SELECT count(*) INTO geometrie_count FROM bag_published.geometrieen;

  IF (object_count, voorkomen_count, relatie_count, geometrie_count)
       <> (:sample_rows, :sample_rows, :sample_rows, :sample_rows) THEN
    RAISE EXCEPTION
      '2A.5 telling faalde: objecten=%, voorkomens=%, relaties=%, geometrieen=%',
      object_count, voorkomen_count, relatie_count, geometrie_count;
  END IF;
END
$assertions$;

EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT identificatie
FROM bag_published.objecten
WHERE objecttype = 'Pand'
  AND identificatie >= 'SCALE-PND-000050000'
ORDER BY identificatie
LIMIT 100;

EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT identificatie
FROM bag_published.geometrieen
WHERE geometrie && extensions.st_makeenvelope(100000, 450000, 101000, 451000, 28992)
LIMIT 2500;

RESET ROLE;

SELECT
  '2A.5_SCALE_PUBLISH_QUERY_OK' AS status,
  :sample_rows::bigint AS sample_rows,
  pg_database_size(current_database()) AS database_bytes,
  (
    SELECT sum(pg_total_relation_size(c.oid))
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('bag_control', 'bag_staging', 'bag_published')
      AND c.relkind IN ('r', 'm')
  ) AS bag_table_and_index_bytes;
