-- BAG BUILD 2A.5 — deterministische shadow-schaallading.
-- Wordt uitsluitend via run-2a5-shadow-scale-probe.sh uitgevoerd.
\set ON_ERROR_STOP on

BEGIN;
SET LOCAL statement_timeout = '110s';
SET LOCAL lock_timeout = '5s';

DO $preflight$
DECLARE
  bag_row_count bigint;
  veilige_memberships integer;
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

  IF bag_row_count <> 0 THEN
    RAISE EXCEPTION '2A.5 vereist een lege BAG-shadow; rijen=%', bag_row_count;
  END IF;

  SELECT count(*) INTO veilige_memberships
  FROM pg_catalog.pg_auth_members AS m
  JOIN pg_catalog.pg_roles AS granted ON granted.oid = m.roleid
  JOIN pg_catalog.pg_roles AS member ON member.oid = m.member
  WHERE member.rolname = 'postgres'
    AND granted.rolname IN ('bag_loader', 'bag_publisher', 'bag_reader')
    AND NOT m.set_option;

  IF veilige_memberships <> 3 THEN
    RAISE EXCEPTION
      '2A.5 vereist exact drie bestaande BAG-memberships met SET FALSE; gevonden=%',
      veilige_memberships;
  END IF;
END
$preflight$;

GRANT bag_loader, bag_publisher, bag_reader TO postgres
  WITH SET TRUE, INHERIT FALSE;

SET LOCAL ROLE bag_loader;

INSERT INTO bag_control.datasetversies (
  id, datasetversie, scope_code, status, is_actief,
  bron_checksum, bron_metadata
) OVERRIDING SYSTEM VALUE VALUES (
  :dataset_id,
  'synthetic-2a5-scale-' || :'sample_rows',
  'NL_SCALE_PROXY',
  'staging',
  false,
  repeat('b', 64),
  jsonb_build_object(
    'synthetic', true,
    'build', '2A.5',
    'sample_rows', :sample_rows
  )
);

INSERT INTO bag_staging.objecten (
  datasetversie_id, objecttype, identificatie
)
SELECT
  :dataset_id,
  'Pand',
  'SCALE-PND-' || lpad(n::text, 9, '0')
FROM generate_series(1, :sample_rows) AS reeks(n);

INSERT INTO bag_staging.voorkomens (
  datasetversie_id, objecttype, identificatie, voorkomen_sleutel,
  voorkomenidentificatie, is_actueel, begin_geldigheid, status, velden
)
SELECT
  :dataset_id,
  'Pand',
  'SCALE-PND-' || lpad(n::text, 9, '0'),
  'v1',
  1,
  true,
  DATE '2026-01-01',
  'Pand in gebruik',
  jsonb_build_object('bouwjaar', 1900 + (n % 126), 'synthetic', true)
FROM generate_series(1, :sample_rows) AS reeks(n);

INSERT INTO bag_staging.relaties (
  datasetversie_id, bron_objecttype, bron_identificatie,
  relatietype, doel_identificatie
)
SELECT
  :dataset_id,
  'Pand',
  'SCALE-PND-' || lpad(n::text, 9, '0'),
  'synthetische_schaalrelatie',
  'SCALE-PND-' || lpad(n::text, 9, '0')
FROM generate_series(1, :sample_rows) AS reeks(n);

INSERT INTO bag_staging.geometrieen (
  datasetversie_id, objecttype, identificatie, voorkomen_sleutel,
  voorkomenidentificatie, geometrie_volgnummer, geometrie
)
SELECT
  :dataset_id,
  'Pand',
  'SCALE-PND-' || lpad(n::text, 9, '0'),
  'v1',
  1,
  1,
  extensions.st_force3dz(
    extensions.st_makeenvelope(
      100000 + ((n - 1) % 1000) * 10,
      450000 + ((n - 1) / 1000) * 10,
      100008 + ((n - 1) % 1000) * 10,
      450008 + ((n - 1) / 1000) * 10,
      28992
    ),
    0
  )
FROM generate_series(1, :sample_rows) AS reeks(n);

RESET ROLE;
COMMIT;

ANALYZE bag_staging.objecten;
ANALYZE bag_staging.voorkomens;
ANALYZE bag_staging.relaties;
ANALYZE bag_staging.geometrieen;

SELECT '2A.5_SCALE_LOAD_OK' AS status, :sample_rows::bigint AS sample_rows;
