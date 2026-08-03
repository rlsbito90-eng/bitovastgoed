-- BAG BUILD 2A.6 — transactionele activatie- en rollbackproef.
\set ON_ERROR_STOP on

BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';

GRANT bag_loader, bag_publisher, bag_reader TO postgres
  WITH SET TRUE, INHERIT FALSE;

SET LOCAL ROLE bag_loader;

INSERT INTO bag_control.datasetversies (
  id, datasetversie, scope_code, status, is_actief, bron_checksum
) OVERRIDING SYSTEM VALUE VALUES
  (900000061, 'synthetic-2a6-a', 'TEST_2A6', 'staging', false, repeat('a', 64)),
  (900000062, 'synthetic-2a6-b', 'TEST_2A6', 'staging', false, repeat('b', 64));

INSERT INTO bag_staging.objecten (datasetversie_id, objecttype, identificatie)
VALUES
  (900000061, 'Pand', 'TEST-2A6-PAND-A'),
  (900000062, 'Pand', 'TEST-2A6-PAND-B');

INSERT INTO bag_staging.voorkomens (
  datasetversie_id, objecttype, identificatie, voorkomen_sleutel,
  voorkomenidentificatie, is_actueel, begin_geldigheid, status
) VALUES
  (900000061, 'Pand', 'TEST-2A6-PAND-A', 'v1', 1, true,
   DATE '2026-01-01', 'Pand in gebruik'),
  (900000062, 'Pand', 'TEST-2A6-PAND-B', 'v1', 1, true,
   DATE '2026-02-01', 'Pand in gebruik');

RESET ROLE;
SET LOCAL ROLE bag_publisher;

INSERT INTO bag_published.objecten SELECT * FROM bag_staging.objecten;
INSERT INTO bag_published.voorkomens SELECT * FROM bag_staging.voorkomens;

UPDATE bag_control.datasetversies
SET status = 'gevalideerd', gevalideerd_op = clock_timestamp()
WHERE id IN (900000061, 900000062);

SELECT * FROM bag_control.activeer_datasetversie(900000061);
SELECT * FROM bag_control.activeer_datasetversie(900000062);

DO $activation_assertions$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM bag_control.datasetversies
    WHERE id = 900000062 AND status = 'actief' AND is_actief
  ) OR NOT EXISTS (
    SELECT 1 FROM bag_control.datasetversies
    WHERE id = 900000061 AND status = 'vervangen' AND NOT is_actief
  ) THEN
    RAISE EXCEPTION '2A.6 activatieketen faalde';
  END IF;
END
$activation_assertions$;

SELECT * FROM bag_control.rollback_datasetversie(900000062, 900000061);

DO $rollback_assertions$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM bag_control.datasetversies
    WHERE id = 900000061 AND status = 'actief' AND is_actief
  ) OR NOT EXISTS (
    SELECT 1 FROM bag_control.datasetversies
    WHERE id = 900000062 AND status = 'vervangen' AND NOT is_actief
  ) THEN
    RAISE EXCEPTION '2A.6 rollbackketen faalde';
  END IF;
END
$rollback_assertions$;

RESET ROLE;
SET LOCAL ROLE bag_reader;

DO $reader_assertions$
BEGIN
  IF (SELECT count(*) FROM bag_control.datasetversies) <> 1
     OR (SELECT count(*) FROM bag_published.objecten) <> 1
     OR NOT EXISTS (
       SELECT 1 FROM bag_published.objecten
       WHERE identificatie = 'TEST-2A6-PAND-A'
     ) THEN
    RAISE EXCEPTION '2A.6 reader ziet niet uitsluitend de herstelde versie';
  END IF;
END
$reader_assertions$;

RESET ROLE;
ROLLBACK;

SELECT '2A.6_VERSION_ACTIVATION_ROLLBACK_OK' AS status;
