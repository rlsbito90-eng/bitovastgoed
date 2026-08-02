\set ON_ERROR_STOP on
\timing on
SET search_path TO bag_experiment, public;
SET synchronous_commit = off;

CREATE UNLOGGED TABLE raw_objecten (
  objecttype text NOT NULL,
  identificatie text NOT NULL
);
CREATE UNLOGGED TABLE raw_voorkomens (
  objecttype text NOT NULL,
  identificatie text NOT NULL,
  voorkomenidentificatie integer NOT NULL,
  is_actueel boolean NOT NULL,
  begin_geldigheid date,
  eind_geldigheid date,
  status text,
  velden jsonb NOT NULL
);
CREATE UNLOGGED TABLE raw_relaties (
  bron_objecttype text NOT NULL,
  bron_identificatie text NOT NULL,
  relatietype text NOT NULL,
  doel_identificatie text NOT NULL
);
CREATE UNLOGGED TABLE raw_geometrieen (
  objecttype text NOT NULL,
  identificatie text NOT NULL,
  voorkomenidentificatie integer NOT NULL,
  wkt text NOT NULL
);

INSERT INTO datasetversies(datasetversie, scope_code, status, is_actief, bron_checksum)
VALUES ('v20200601-officiele-assen-proef', '0106', 'staging', false, :'bron_checksum');

SELECT id AS datasetversie_id
FROM datasetversies
WHERE datasetversie = 'v20200601-officiele-assen-proef' AND scope_code = '0106'
\gset

INSERT INTO staging_objecten(datasetversie_id, objecttype, identificatie)
SELECT :datasetversie_id, objecttype, identificatie
FROM raw_objecten;

INSERT INTO staging_voorkomens(
  datasetversie_id,
  objecttype,
  identificatie,
  voorkomenidentificatie,
  is_actueel,
  begin_geldigheid,
  eind_geldigheid,
  status,
  velden
)
SELECT
  :datasetversie_id,
  objecttype,
  identificatie,
  voorkomenidentificatie,
  is_actueel,
  begin_geldigheid,
  eind_geldigheid,
  status,
  velden
FROM raw_voorkomens;

INSERT INTO staging_relaties(
  datasetversie_id,
  bron_objecttype,
  bron_identificatie,
  relatietype,
  doel_identificatie
)
SELECT
  :datasetversie_id,
  bron_objecttype,
  bron_identificatie,
  relatietype,
  doel_identificatie
FROM raw_relaties;

INSERT INTO staging_geometrieen(
  datasetversie_id,
  objecttype,
  identificatie,
  voorkomenidentificatie,
  geometrie
)
SELECT
  :datasetversie_id,
  objecttype,
  identificatie,
  voorkomenidentificatie,
  ST_Force3D(ST_GeomFromText(wkt, 28992))
FROM raw_geometrieen;

ANALYZE staging_objecten;
ANALYZE staging_voorkomens;
ANALYZE staging_relaties;
ANALYZE staging_geometrieen;

SELECT 1 / (count(*) = 128745)::int FROM staging_objecten WHERE datasetversie_id = :datasetversie_id;
SELECT 1 / (count(*) = 168047)::int FROM staging_voorkomens WHERE datasetversie_id = :datasetversie_id;
SELECT 1 / (count(*) = :expected_relations)::int FROM staging_relaties WHERE datasetversie_id = :datasetversie_id;
SELECT 1 / (count(*) = :expected_geometries)::int FROM staging_geometrieen WHERE datasetversie_id = :datasetversie_id;
SELECT 1 / (count(*) = 0)::int
FROM staging_geometrieen
WHERE datasetversie_id = :datasetversie_id
  AND (ST_SRID(geometrie) <> 28992 OR ST_NDims(geometrie) <> 3 OR NOT ST_IsValid(geometrie));

BEGIN;
  INSERT INTO objecten SELECT * FROM staging_objecten WHERE datasetversie_id = :datasetversie_id;
  INSERT INTO voorkomens SELECT * FROM staging_voorkomens WHERE datasetversie_id = :datasetversie_id;
  INSERT INTO relaties SELECT * FROM staging_relaties WHERE datasetversie_id = :datasetversie_id;
  INSERT INTO geometrieen SELECT * FROM staging_geometrieen WHERE datasetversie_id = :datasetversie_id;
  UPDATE datasetversies SET status = 'actief', is_actief = true WHERE id = :datasetversie_id;
COMMIT;

ANALYZE objecten;
ANALYZE voorkomens;
ANALYZE relaties;
ANALYZE geometrieen;

DROP TABLE raw_objecten;
DROP TABLE raw_voorkomens;
DROP TABLE raw_relaties;
DROP TABLE raw_geometrieen;
