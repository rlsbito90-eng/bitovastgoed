-- BAG BUILD 2A.4B — transactionele synthetische shadowproef.
-- Vereist dat BUILD 2A.4A al exact drie lege BAG-schema's heeft aangemaakt.
-- De volledige proef, inclusief tijdelijke SET ROLE-toestemming, wordt teruggerold.
\set ON_ERROR_STOP on

BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';
SET LOCAL idle_in_transaction_session_timeout = '30s';

DO $preflight$
DECLARE
  bag_schema_count integer;
  bag_row_count bigint;
BEGIN
  SELECT count(*) INTO bag_schema_count
  FROM pg_catalog.pg_namespace
  WHERE nspname IN ('bag_control', 'bag_staging', 'bag_published');

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

  IF bag_schema_count <> 3 OR bag_row_count <> 0 THEN
    RAISE EXCEPTION
      '2A.4B vereist exact drie lege BAG-schema''s; schema''s=%, rijen=%',
      bag_schema_count, bag_row_count;
  END IF;
END
$preflight$;

-- Lovable Cloud maakt postgres lid met SET FALSE. Deze tijdelijke verruiming
-- bestaat uitsluitend binnen de transactie en verdwijnt door ROLLBACK.
GRANT bag_loader, bag_publisher, bag_reader TO postgres
  WITH SET TRUE, INHERIT FALSE;

SET LOCAL ROLE bag_loader;

INSERT INTO bag_control.datasetversies (
  id, datasetversie, scope_code, status, is_actief,
  bron_checksum, bron_metadata
) OVERRIDING SYSTEM VALUE VALUES (
  900000001, 'synthetic-2a4b-20260803', 'TEST_AMSTERDAM',
  'staging', false, repeat('a', 64),
  '{"synthetic":true,"build":"2A.4B"}'::jsonb
);

INSERT INTO bag_staging.objecten (
  datasetversie_id, objecttype, identificatie
) VALUES
  (900000001, 'Woonplaats', 'TEST-WPL-001'),
  (900000001, 'OpenbareRuimte', 'TEST-OPR-001'),
  (900000001, 'Nummeraanduiding', 'TEST-NUM-001'),
  (900000001, 'Pand', 'TEST-PND-001'),
  (900000001, 'Verblijfsobject', 'TEST-VBO-001');

INSERT INTO bag_staging.voorkomens (
  datasetversie_id, objecttype, identificatie, voorkomen_sleutel,
  voorkomenidentificatie, is_actueel, begin_geldigheid, status, velden
) VALUES
  (900000001, 'Woonplaats', 'TEST-WPL-001', 'v1', 1, true,
   DATE '2026-01-01', 'Woonplaats aangewezen', '{"naam":"Testdam"}'),
  (900000001, 'OpenbareRuimte', 'TEST-OPR-001', 'v1', 1, true,
   DATE '2026-01-01', 'Naamgeving uitgegeven', '{"naam":"Schaduwstraat"}'),
  (900000001, 'Nummeraanduiding', 'TEST-NUM-001', 'v1', 1, true,
   DATE '2026-01-01', 'Naamgeving uitgegeven',
   '{"huisnummer":42,"postcode":"1011AA"}'),
  (900000001, 'Pand', 'TEST-PND-001', 'v1', 1, true,
   DATE '2026-01-01', 'Pand in gebruik', '{"bouwjaar":1995}'),
  (900000001, 'Verblijfsobject', 'TEST-VBO-001', 'v1', 1, true,
   DATE '2026-01-01', 'Verblijfsobject in gebruik', '{"oppervlakte":125}');

INSERT INTO bag_staging.relaties (
  datasetversie_id, bron_objecttype, bron_identificatie,
  relatietype, doel_identificatie
) VALUES
  (900000001, 'OpenbareRuimte', 'TEST-OPR-001',
   'ligt_in_woonplaats', 'TEST-WPL-001'),
  (900000001, 'Nummeraanduiding', 'TEST-NUM-001',
   'ligt_aan_openbare_ruimte', 'TEST-OPR-001'),
  (900000001, 'Verblijfsobject', 'TEST-VBO-001',
   'heeft_hoofdadres', 'TEST-NUM-001'),
  (900000001, 'Verblijfsobject', 'TEST-VBO-001',
   'maakt_deel_uit_van', 'TEST-PND-001');

INSERT INTO bag_staging.geometrieen (
  datasetversie_id, objecttype, identificatie, voorkomen_sleutel,
  voorkomenidentificatie, geometrie_volgnummer, geometrie
) VALUES
  (900000001, 'Pand', 'TEST-PND-001', 'v1', 1, 1,
   extensions.st_geomfromtext(
     'POLYGON Z((121000 487000 0,121020 487000 0,121020 487020 0,121000 487020 0,121000 487000 0))',
     28992
   )),
  (900000001, 'Verblijfsobject', 'TEST-VBO-001', 'v1', 1, 1,
   extensions.st_geomfromtext('POINT Z(121010 487010 0)', 28992));

RESET ROLE;
SET LOCAL ROLE bag_publisher;

INSERT INTO bag_published.objecten (
  datasetversie_id, objecttype, identificatie
)
SELECT datasetversie_id, objecttype, identificatie
FROM bag_staging.objecten
WHERE datasetversie_id = 900000001;

INSERT INTO bag_published.voorkomens (
  datasetversie_id, objecttype, identificatie, voorkomen_sleutel,
  voorkomenidentificatie, is_actueel, begin_geldigheid, eind_geldigheid,
  status, velden
)
SELECT datasetversie_id, objecttype, identificatie, voorkomen_sleutel,
       voorkomenidentificatie, is_actueel, begin_geldigheid, eind_geldigheid,
       status, velden
FROM bag_staging.voorkomens
WHERE datasetversie_id = 900000001;

INSERT INTO bag_published.relaties (
  datasetversie_id, bron_objecttype, bron_identificatie,
  relatietype, doel_identificatie
)
SELECT datasetversie_id, bron_objecttype, bron_identificatie,
       relatietype, doel_identificatie
FROM bag_staging.relaties
WHERE datasetversie_id = 900000001;

INSERT INTO bag_published.geometrieen (
  datasetversie_id, objecttype, identificatie, voorkomen_sleutel,
  voorkomenidentificatie, geometrie_volgnummer, geometrie
)
SELECT datasetversie_id, objecttype, identificatie, voorkomen_sleutel,
       voorkomenidentificatie, geometrie_volgnummer, geometrie
FROM bag_staging.geometrieen
WHERE datasetversie_id = 900000001;

UPDATE bag_control.datasetversies
SET status = 'actief',
    is_actief = true,
    gevalideerd_op = now(),
    geactiveerd_op = now()
WHERE id = 900000001;

RESET ROLE;
SET LOCAL ROLE bag_reader;

DO $reader_assertions$
DECLARE
  dataset_count bigint;
  object_count bigint;
  voorkomen_count bigint;
  relatie_count bigint;
  geometrie_count bigint;
  punt_ligt_in_pand boolean;
  geometriecontract_ok boolean;
BEGIN
  SELECT count(*) INTO dataset_count FROM bag_control.datasetversies;
  SELECT count(*) INTO object_count FROM bag_published.objecten;
  SELECT count(*) INTO voorkomen_count FROM bag_published.voorkomens;
  SELECT count(*) INTO relatie_count FROM bag_published.relaties;
  SELECT count(*) INTO geometrie_count FROM bag_published.geometrieen;
  SELECT extensions.st_covers(p.geometrie, v.geometrie)
    INTO punt_ligt_in_pand
  FROM bag_published.geometrieen AS p
  JOIN bag_published.geometrieen AS v
    ON v.datasetversie_id = p.datasetversie_id
  WHERE p.objecttype = 'Pand'
    AND v.objecttype = 'Verblijfsobject';
  SELECT bool_and(
    extensions.st_srid(geometrie) = 28992
    AND extensions.st_ndims(geometrie) = 3
  ) INTO geometriecontract_ok
  FROM bag_published.geometrieen;

  IF (dataset_count, object_count, voorkomen_count, relatie_count, geometrie_count)
       <> (1, 5, 5, 4, 2)
     OR punt_ligt_in_pand IS NOT TRUE
     OR geometriecontract_ok IS NOT TRUE THEN
    RAISE EXCEPTION
      '2A.4B reader-validatie faalde: dataset=%, objecten=%, voorkomens=%, relaties=%, geometrieen=%, covers=%, contract=%',
      dataset_count, object_count, voorkomen_count, relatie_count,
      geometrie_count, punt_ligt_in_pand, geometriecontract_ok;
  END IF;
END
$reader_assertions$;

SELECT
  current_user AS reader_role,
  (SELECT count(*) FROM bag_control.datasetversies) AS zichtbare_datasetversies,
  (SELECT count(*) FROM bag_published.objecten) AS zichtbare_objecten,
  (SELECT count(*) FROM bag_published.voorkomens) AS zichtbare_voorkomens,
  (SELECT count(*) FROM bag_published.relaties) AS zichtbare_relaties,
  (SELECT count(*) FROM bag_published.geometrieen) AS zichtbare_geometrieen;

RESET ROLE;

DO $privilege_assertions$
BEGIN
  IF has_schema_privilege('anon', 'bag_published', 'USAGE')
     OR has_schema_privilege('authenticated', 'bag_published', 'USAGE')
     OR has_schema_privilege('service_role', 'bag_published', 'USAGE')
     OR has_table_privilege('bag_publisher', 'bag_published.objecten', 'UPDATE')
     OR has_table_privilege('bag_publisher', 'bag_published.objecten', 'DELETE')
     OR has_table_privilege('bag_loader', 'bag_published.objecten', 'INSERT')
     OR has_table_privilege('bag_reader', 'bag_staging.objecten', 'SELECT') THEN
    RAISE EXCEPTION '2A.4B privilege-isolatie faalde';
  END IF;
END
$privilege_assertions$;

ROLLBACK;

DO $rollback_assertions$
DECLARE
  bag_row_count bigint;
  tijdelijke_set_memberships integer;
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

  SELECT count(*) INTO tijdelijke_set_memberships
  FROM pg_catalog.pg_auth_members AS m
  JOIN pg_catalog.pg_roles AS granted ON granted.oid = m.roleid
  JOIN pg_catalog.pg_roles AS member ON member.oid = m.member
  WHERE member.rolname = 'postgres'
    AND granted.rolname IN ('bag_loader', 'bag_publisher', 'bag_reader')
    AND m.set_option;

  IF bag_row_count <> 0 OR tijdelijke_set_memberships <> 0 THEN
    RAISE EXCEPTION
      '2A.4B rollback faalde: BAG-rijen=%, SET-memberships=%',
      bag_row_count, tijdelijke_set_memberships;
  END IF;
END
$rollback_assertions$;

SELECT '2A.4B_SYNTHETIC_SHADOW_PROBE_OK' AS status;
