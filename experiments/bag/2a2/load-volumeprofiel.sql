\set ON_ERROR_STOP on
\timing on
SET search_path TO bag_experiment, public;
SET synchronous_commit = off;

CREATE OR REPLACE FUNCTION assert_eq(actual bigint, expected bigint, label text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF actual <> expected THEN
    RAISE EXCEPTION '% wijkt af: verwacht %, ontvangen %', label, expected, actual;
  END IF;
END;
$$;

INSERT INTO datasetversies(datasetversie, scope_code, status, is_actief, bron_checksum)
VALUES ('assen-volumeprofiel-2a2', '0106', 'staging', false, repeat('a', 64));

SELECT id AS datasetversie_id
FROM datasetversies
WHERE datasetversie = 'assen-volumeprofiel-2a2' AND scope_code = '0106'
\gset

CREATE TEMP TABLE object_catalog AS
SELECT
  n AS rn,
  CASE
    WHEN n <= 50697 THEN 'Pand'
    WHEN n <= 93697 THEN 'Verblijfsobject'
    WHEN n <= 127697 THEN 'Nummeraanduiding'
    WHEN n <= 128697 THEN 'OpenbareRuimte'
    WHEN n <= 128704 THEN 'Woonplaats'
    WHEN n <= 128733 THEN 'Standplaats'
    ELSE 'Ligplaats'
  END AS objecttype,
  lpad(n::text, 16, '0') AS identificatie
FROM generate_series(1, 128745) AS n;
CREATE UNIQUE INDEX object_catalog_rn_idx ON object_catalog(rn);
ANALYZE object_catalog;

INSERT INTO staging_objecten(datasetversie_id, objecttype, identificatie)
SELECT :datasetversie_id, objecttype, identificatie
FROM object_catalog;

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
  1,
  rn > 39302,
  DATE '2000-01-01' + ((rn % 8000)::integer),
  CASE WHEN rn <= 39302 THEN DATE '2020-01-01' ELSE NULL END,
  'synthetisch',
  jsonb_build_object('bron', 'assen-volumeprofiel', 'rn', rn)
FROM object_catalog;

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
  2,
  true,
  DATE '2020-01-01',
  NULL,
  'synthetisch-actueel',
  jsonb_build_object('bron', 'assen-volumeprofiel', 'rn', rn, 'historisch', true)
FROM object_catalog
WHERE rn <= 39302;

INSERT INTO staging_relaties(
  datasetversie_id,
  bron_objecttype,
  bron_identificatie,
  relatietype,
  doel_identificatie
)
SELECT
  :datasetversie_id,
  bron.objecttype,
  bron.identificatie,
  'synthetische_relatie_' || ((g - 1) / 128745 + 1)::text,
  doel.identificatie
FROM generate_series(1, 212738) AS g
JOIN object_catalog bron ON bron.rn = ((g - 1) % 128745) + 1
JOIN object_catalog doel ON doel.rn = ((g * 7919 - 1) % 128745) + 1;

INSERT INTO staging_geometrieen(
  datasetversie_id,
  objecttype,
  identificatie,
  voorkomenidentificatie,
  geometrie
)
SELECT
  :datasetversie_id,
  c.objecttype,
  c.identificatie,
  CASE WHEN c.rn <= 39302 THEN 2 ELSE 1 END,
  CASE
    WHEN c.objecttype = 'Pand' THEN ST_Force3D(
      ST_MakeEnvelope(
        100000 + (c.rn % 1000) * 10,
        450000 + ((c.rn / 1000) % 1000) * 10,
        100008 + (c.rn % 1000) * 10,
        450008 + ((c.rn / 1000) % 1000) * 10,
        28992
      )
    )
    ELSE ST_SetSRID(
      ST_MakePoint(
        100000 + (c.rn % 1000) * 10,
        450000 + ((c.rn / 1000) % 1000) * 10,
        0
      ),
      28992
    )
  END
FROM object_catalog c
WHERE c.rn <= 122388;

ANALYZE staging_objecten;
ANALYZE staging_voorkomens;
ANALYZE staging_relaties;
ANALYZE staging_geometrieen;

SELECT assert_eq(
  (SELECT count(*) FROM staging_objecten WHERE datasetversie_id = :datasetversie_id),
  128745,
  'Objecttelling'
);
SELECT assert_eq(
  (SELECT count(*) FROM staging_voorkomens WHERE datasetversie_id = :datasetversie_id),
  168047,
  'Voorkomentelling'
);
SELECT assert_eq(
  (SELECT count(*) FROM staging_relaties WHERE datasetversie_id = :datasetversie_id),
  212738,
  'Relatietelling'
);
SELECT assert_eq(
  (SELECT count(*) FROM staging_geometrieen WHERE datasetversie_id = :datasetversie_id),
  122388,
  'Geometrietelling'
);

BEGIN;
  INSERT INTO objecten SELECT * FROM staging_objecten WHERE datasetversie_id = :datasetversie_id;
  INSERT INTO voorkomens SELECT * FROM staging_voorkomens WHERE datasetversie_id = :datasetversie_id;
  INSERT INTO relaties SELECT * FROM staging_relaties WHERE datasetversie_id = :datasetversie_id;
  INSERT INTO geometrieen SELECT * FROM staging_geometrieen WHERE datasetversie_id = :datasetversie_id;
  UPDATE datasetversies
  SET status = 'actief', is_actief = true
  WHERE id = :datasetversie_id;
COMMIT;

ANALYZE objecten;
ANALYZE voorkomens;
ANALYZE relaties;
ANALYZE geometrieen;
