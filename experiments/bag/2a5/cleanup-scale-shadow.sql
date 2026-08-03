-- BAG BUILD 2A.5 — idempotente cleanup. Mag uitsluitend op de shadow draaien.
\set ON_ERROR_STOP on

BEGIN;
SET LOCAL statement_timeout = '110s';
SET LOCAL lock_timeout = '5s';

DELETE FROM bag_published.geometrieen WHERE datasetversie_id = :dataset_id;
DELETE FROM bag_published.relaties WHERE datasetversie_id = :dataset_id;
DELETE FROM bag_published.voorkomens WHERE datasetversie_id = :dataset_id;
DELETE FROM bag_published.objecten WHERE datasetversie_id = :dataset_id;
DELETE FROM bag_control.datasetversies WHERE id = :dataset_id;

GRANT bag_loader, bag_publisher, bag_reader TO postgres
  WITH SET FALSE, INHERIT FALSE;
COMMIT;

VACUUM (ANALYZE, TRUNCATE) bag_staging.geometrieen;
VACUUM (ANALYZE, TRUNCATE) bag_staging.relaties;
VACUUM (ANALYZE, TRUNCATE) bag_staging.voorkomens;
VACUUM (ANALYZE, TRUNCATE) bag_staging.objecten;
VACUUM (ANALYZE, TRUNCATE) bag_published.geometrieen;
VACUUM (ANALYZE, TRUNCATE) bag_published.relaties;
VACUUM (ANALYZE, TRUNCATE) bag_published.voorkomens;
VACUUM (ANALYZE, TRUNCATE) bag_published.objecten;

-- DELETE + VACUUM verkleint lege heaps, maar niet altijd de tijdens de proef
-- gegroeide indexen. Omdat de shadow na de assertions leeg is, herstellen we
-- ook de indexvoetafdruk deterministisch.
REINDEX TABLE bag_staging.objecten;
REINDEX TABLE bag_staging.voorkomens;
REINDEX TABLE bag_staging.relaties;
REINDEX TABLE bag_staging.geometrieen;
REINDEX TABLE bag_published.objecten;
REINDEX TABLE bag_published.voorkomens;
REINDEX TABLE bag_published.relaties;
REINDEX TABLE bag_published.geometrieen;
REINDEX TABLE bag_control.datasetversies;

DO $cleanup_assertions$
DECLARE
  bag_row_count bigint;
  set_memberships integer;
BEGIN
  SELECT
    (SELECT count(*) FROM bag_control.datasetversies)
    + (SELECT count(*) FROM bag_control.geometrie_afwijkingen)
    + (SELECT count(*) FROM bag_staging.objecten)
    + (SELECT count(*) FROM bag_staging.voorkomens)
    + (SELECT count(*) FROM bag_staging.relaties)
    + (SELECT count(*) FROM bag_staging.geometrieen)
    + (SELECT count(*) FROM bag_published.objecten)
    + (SELECT count(*) FROM bag_published.voorkomens)
    + (SELECT count(*) FROM bag_published.relaties)
    + (SELECT count(*) FROM bag_published.geometrieen)
  INTO bag_row_count;

  SELECT count(*) INTO set_memberships
  FROM pg_catalog.pg_auth_members AS m
  JOIN pg_catalog.pg_roles AS granted ON granted.oid = m.roleid
  JOIN pg_catalog.pg_roles AS member ON member.oid = m.member
  WHERE member.rolname = 'postgres'
    AND granted.rolname IN ('bag_loader', 'bag_publisher', 'bag_reader')
    AND m.set_option;

  IF bag_row_count <> 0 OR set_memberships <> 0 THEN
    RAISE EXCEPTION
      '2A.5 cleanup faalde: BAG-rijen=%, blijvende SET-memberships=%',
      bag_row_count, set_memberships;
  END IF;
END
$cleanup_assertions$;

SELECT '2A.5_SCALE_CLEANUP_OK' AS status;
