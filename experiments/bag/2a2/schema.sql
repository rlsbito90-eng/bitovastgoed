\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS bag_experiment;
SET search_path TO bag_experiment, public;

CREATE TABLE datasetversies (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  datasetversie text NOT NULL,
  scope_code text NOT NULL,
  status text NOT NULL CHECK (status IN ('staging', 'gevalideerd', 'actief', 'vervangen')),
  is_actief boolean NOT NULL DEFAULT false,
  bron_checksum text NOT NULL,
  aangemaakt_op timestamptz NOT NULL DEFAULT now(),
  UNIQUE (datasetversie, scope_code)
);

CREATE UNIQUE INDEX datasetversies_een_actief_per_scope_idx
  ON datasetversies (scope_code)
  WHERE is_actief;

CREATE TABLE staging_objecten (
  datasetversie_id bigint NOT NULL REFERENCES datasetversies(id) ON DELETE CASCADE,
  objecttype text NOT NULL,
  identificatie text NOT NULL,
  PRIMARY KEY (datasetversie_id, objecttype, identificatie)
);

CREATE INDEX staging_objecten_lookup_idx
  ON staging_objecten (objecttype, identificatie);

CREATE TABLE staging_voorkomens (
  datasetversie_id bigint NOT NULL,
  objecttype text NOT NULL,
  identificatie text NOT NULL,
  voorkomenidentificatie integer NOT NULL,
  is_actueel boolean NOT NULL,
  begin_geldigheid date,
  eind_geldigheid date,
  status text,
  velden jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (datasetversie_id, objecttype, identificatie, voorkomenidentificatie),
  FOREIGN KEY (datasetversie_id, objecttype, identificatie)
    REFERENCES staging_objecten(datasetversie_id, objecttype, identificatie)
    ON DELETE CASCADE
);

CREATE INDEX staging_voorkomens_actueel_idx
  ON staging_voorkomens (datasetversie_id, objecttype, is_actueel);
CREATE INDEX staging_voorkomens_geldigheid_idx
  ON staging_voorkomens (begin_geldigheid, eind_geldigheid);
CREATE INDEX staging_voorkomens_velden_gin_idx
  ON staging_voorkomens USING gin (velden);

CREATE TABLE staging_relaties (
  datasetversie_id bigint NOT NULL,
  bron_objecttype text NOT NULL,
  bron_identificatie text NOT NULL,
  relatietype text NOT NULL,
  doel_identificatie text NOT NULL,
  PRIMARY KEY (
    datasetversie_id,
    bron_objecttype,
    bron_identificatie,
    relatietype,
    doel_identificatie
  ),
  FOREIGN KEY (datasetversie_id, bron_objecttype, bron_identificatie)
    REFERENCES staging_objecten(datasetversie_id, objecttype, identificatie)
    ON DELETE CASCADE
);

CREATE INDEX staging_relaties_bron_idx
  ON staging_relaties (bron_objecttype, bron_identificatie);
CREATE INDEX staging_relaties_doel_idx
  ON staging_relaties (doel_identificatie);

CREATE TABLE staging_geometrieen (
  datasetversie_id bigint NOT NULL,
  objecttype text NOT NULL,
  identificatie text NOT NULL,
  voorkomenidentificatie integer NOT NULL,
  geometrie geometry(GeometryZ, 28992) NOT NULL,
  PRIMARY KEY (datasetversie_id, objecttype, identificatie, voorkomenidentificatie),
  FOREIGN KEY (datasetversie_id, objecttype, identificatie, voorkomenidentificatie)
    REFERENCES staging_voorkomens(
      datasetversie_id,
      objecttype,
      identificatie,
      voorkomenidentificatie
    ) ON DELETE CASCADE,
  CHECK (ST_SRID(geometrie) = 28992),
  CHECK (ST_NDims(geometrie) = 3),
  CHECK (GeometryType(geometrie) IN ('POINT', 'POLYGON'))
);

CREATE INDEX staging_geometrieen_gist_idx
  ON staging_geometrieen USING gist (geometrie);
CREATE INDEX staging_geometrieen_object_idx
  ON staging_geometrieen (objecttype, identificatie);

CREATE TABLE objecten (LIKE staging_objecten INCLUDING ALL);
CREATE TABLE voorkomens (LIKE staging_voorkomens INCLUDING ALL);
CREATE TABLE relaties (LIKE staging_relaties INCLUDING ALL);
CREATE TABLE geometrieen (LIKE staging_geometrieen INCLUDING ALL);

ALTER TABLE objecten
  ADD FOREIGN KEY (datasetversie_id) REFERENCES datasetversies(id) ON DELETE RESTRICT;
ALTER TABLE voorkomens
  ADD FOREIGN KEY (datasetversie_id, objecttype, identificatie)
  REFERENCES objecten(datasetversie_id, objecttype, identificatie) ON DELETE CASCADE;
ALTER TABLE relaties
  ADD FOREIGN KEY (datasetversie_id, bron_objecttype, bron_identificatie)
  REFERENCES objecten(datasetversie_id, objecttype, identificatie) ON DELETE CASCADE;
ALTER TABLE geometrieen
  ADD FOREIGN KEY (datasetversie_id, objecttype, identificatie, voorkomenidentificatie)
  REFERENCES voorkomens(datasetversie_id, objecttype, identificatie, voorkomenidentificatie)
  ON DELETE CASCADE;

CREATE INDEX objecten_lookup_idx ON objecten (objecttype, identificatie);
CREATE INDEX voorkomens_actueel_idx ON voorkomens (datasetversie_id, objecttype, is_actueel);
CREATE INDEX relaties_bron_idx ON relaties (bron_objecttype, bron_identificatie);
CREATE INDEX relaties_doel_idx ON relaties (doel_identificatie);
CREATE INDEX geometrieen_gist_idx ON geometrieen USING gist (geometrie);
