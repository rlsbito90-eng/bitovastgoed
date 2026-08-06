\set ON_ERROR_STOP on

BEGIN;
SET LOCAL statement_timeout = '90min';
SET LOCAL lock_timeout = '10s';

DO $preflight$
DECLARE
  v_existing integer;
  v_safe_memberships integer;
BEGIN
  SELECT count(*) INTO v_existing
  FROM bag_control.datasetversies
  WHERE datasetversie = 'v20260805' AND scope_code = '0363';

  IF v_existing <> 0 THEN
    RAISE EXCEPTION 'Amsterdam dataset v20260805/0363 bestaat al; aantal=%', v_existing;
  END IF;

  SELECT count(*) INTO v_safe_memberships
  FROM pg_catalog.pg_auth_members AS m
  JOIN pg_catalog.pg_roles AS granted ON granted.oid = m.roleid
  JOIN pg_catalog.pg_roles AS member ON member.oid = m.member
  WHERE member.rolname = 'postgres'
    AND granted.rolname IN ('bag_loader', 'bag_publisher', 'bag_reader')
    AND NOT m.set_option;

  IF v_safe_memberships <> 3 THEN
    RAISE EXCEPTION 'Verwacht exact drie BAG-memberships met SET FALSE; gevonden=%', v_safe_memberships;
  END IF;

  IF NOT has_database_privilege('bag_loader', current_database(), 'TEMP') THEN
    RAISE EXCEPTION 'bag_loader mist TEMP-recht voor transactionele bulkimport';
  END IF;
END
$preflight$;

GRANT bag_loader TO postgres WITH SET TRUE, INHERIT FALSE;
SET LOCAL ROLE bag_loader;

CREATE TEMP TABLE raw_objecten (
  objecttype text NOT NULL,
  identificatie text NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE raw_voorkomens (
  objecttype text NOT NULL,
  identificatie text NOT NULL,
  voorkomen_sleutel text NOT NULL,
  voorkomenidentificatie integer NOT NULL,
  is_actueel boolean NOT NULL,
  begin_geldigheid date,
  eind_geldigheid date,
  status text,
  velden jsonb NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE raw_relaties (
  bron_objecttype text NOT NULL,
  bron_identificatie text NOT NULL,
  relatietype text NOT NULL,
  doel_identificatie text NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE raw_geometrieen (
  objecttype text NOT NULL,
  identificatie text NOT NULL,
  voorkomen_sleutel text NOT NULL,
  voorkomenidentificatie integer NOT NULL,
  geometrie_volgnummer integer NOT NULL,
  wkt text NOT NULL
) ON COMMIT DROP;

\copy raw_objecten FROM '__OBJECTEN_CSV__' WITH (FORMAT csv)
\copy raw_voorkomens FROM '__VOORKOMENS_CSV__' WITH (FORMAT csv)
\copy raw_relaties FROM '__RELATIES_CSV__' WITH (FORMAT csv)
\copy raw_geometrieen FROM '__GEOMETRIEEN_CSV__' WITH (FORMAT csv)

SELECT 1 / (
  (SELECT count(*) FROM raw_objecten) = :expected_objecten::bigint
  AND (SELECT count(*) FROM raw_voorkomens) = :expected_voorkomens::bigint
  AND (SELECT count(*) FROM raw_relaties) = :expected_relaties::bigint
  AND (SELECT count(*) FROM raw_geometrieen) = :expected_geometrieen::bigint
)::integer AS raw_manifest_tellingen_ok;

INSERT INTO bag_control.datasetversies (
  datasetversie, scope_code, status, is_actief, bron_checksum, bron_metadata
) VALUES (
  'v20260805',
  '0363',
  'staging',
  false,
  :'bron_checksum',
  jsonb_build_object(
    'officieel', true,
    'bron', 'Kadaster landelijke BAG-selectie Amsterdam',
    'gemeentecode', '0363',
    'artifact_id', 8973886061,
    'export_manifest_sha256', :'manifest_checksum',
    'adapter_fouten', 0,
    'geometrie_koppelafwijkingen', 0,
    'publicatie', 'niet_uitgevoerd'
  )
)
RETURNING id AS datasetversie_id \gset

INSERT INTO bag_staging.objecten (datasetversie_id, objecttype, identificatie)
SELECT :datasetversie_id, objecttype, identificatie FROM raw_objecten;

INSERT INTO bag_staging.voorkomens (
  datasetversie_id, objecttype, identificatie, voorkomen_sleutel,
  voorkomenidentificatie, is_actueel, begin_geldigheid, eind_geldigheid,
  status, velden
)
SELECT :datasetversie_id, objecttype, identificatie, voorkomen_sleutel,
  voorkomenidentificatie, is_actueel, begin_geldigheid, eind_geldigheid,
  status, velden
FROM raw_voorkomens;

INSERT INTO bag_staging.relaties (
  datasetversie_id, bron_objecttype, bron_identificatie, relatietype, doel_identificatie
)
SELECT :datasetversie_id, bron_objecttype, bron_identificatie, relatietype, doel_identificatie
FROM raw_relaties;

CREATE TEMP TABLE geometrie_beoordeling ON COMMIT DROP AS
SELECT objecttype, identificatie, voorkomen_sleutel, voorkomenidentificatie,
  geometrie_volgnummer, wkt,
  extensions.st_force3d(extensions.st_geomfromtext(wkt, 28992)) AS geometrie
FROM raw_geometrieen;

INSERT INTO bag_control.geometrie_afwijkingen (
  datasetversie_id, objecttype, identificatie, voorkomen_sleutel,
  voorkomenidentificatie, geometrie_volgnummer, reden, wkt, bronmetadata
)
SELECT :datasetversie_id, objecttype, identificatie, voorkomen_sleutel,
  voorkomenidentificatie, geometrie_volgnummer,
  extensions.st_isvalidreason(geometrie), wkt,
  jsonb_build_object('bron', 'amsterdam_artifact_8973886061')
FROM geometrie_beoordeling
WHERE NOT extensions.st_isvalid(geometrie);

INSERT INTO bag_staging.geometrieen (
  datasetversie_id, objecttype, identificatie, voorkomen_sleutel,
  voorkomenidentificatie, geometrie_volgnummer, geometrie
)
SELECT :datasetversie_id, objecttype, identificatie, voorkomen_sleutel,
  voorkomenidentificatie, geometrie_volgnummer, geometrie
FROM geometrie_beoordeling
WHERE extensions.st_isvalid(geometrie);

SELECT 1 / (
  (SELECT count(*) FROM bag_staging.objecten WHERE datasetversie_id = :datasetversie_id) = :expected_objecten::bigint
  AND (SELECT count(*) FROM bag_staging.voorkomens WHERE datasetversie_id = :datasetversie_id) = :expected_voorkomens::bigint
  AND (SELECT count(*) FROM bag_staging.relaties WHERE datasetversie_id = :datasetversie_id) = :expected_relaties::bigint
  AND (SELECT count(*) FROM bag_staging.geometrieen WHERE datasetversie_id = :datasetversie_id) = :expected_geometrieen::bigint
  AND (SELECT count(*) FROM bag_control.geometrie_afwijkingen WHERE datasetversie_id = :datasetversie_id) = 0
)::integer AS staging_tellingen_ok;

SELECT 1 / (NOT EXISTS (
  SELECT 1 FROM bag_staging.geometrieen
  WHERE datasetversie_id = :datasetversie_id
    AND (extensions.st_srid(geometrie) <> 28992
      OR extensions.st_ndims(geometrie) <> 3
      OR NOT extensions.st_isvalid(geometrie))
))::integer AS staging_geometrieen_ok;

SELECT 1 / (NOT EXISTS (
  SELECT 1
  FROM bag_staging.voorkomens v
  LEFT JOIN bag_staging.objecten o
    ON o.datasetversie_id = v.datasetversie_id
   AND o.objecttype = v.objecttype
   AND o.identificatie = v.identificatie
  WHERE v.datasetversie_id = :datasetversie_id
    AND o.identificatie IS NULL
))::integer AS voorkomen_object_integriteit_ok;

RESET ROLE;
REVOKE bag_loader FROM postgres GRANTED BY postgres;

ANALYZE bag_staging.objecten;
ANALYZE bag_staging.voorkomens;
ANALYZE bag_staging.relaties;
ANALYZE bag_staging.geometrieen;

COMMIT;

SELECT 'AMSTERDAM_SHADOW_STAGING_IMPORT_OK' AS status,
  :datasetversie_id::bigint AS datasetversie_id;
