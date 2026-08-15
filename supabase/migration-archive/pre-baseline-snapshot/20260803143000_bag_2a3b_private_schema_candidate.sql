-- BAG BUILD 2A.3B — lokale Supabase-migratiekandidaat.
-- Niet uitvoeren buiten een afzonderlijk bevestigde shadow-proef.
BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

CREATE SCHEMA bag_control AUTHORIZATION postgres;
CREATE SCHEMA bag_staging AUTHORIZATION postgres;
CREATE SCHEMA bag_published AUTHORIZATION postgres;

DO $roles$
DECLARE
  rol_onveilig boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'bag_loader') THEN
    EXECUTE 'CREATE ROLE bag_loader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'bag_publisher') THEN
    EXECUTE 'CREATE ROLE bag_publisher NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'bag_reader') THEN
    EXECUTE 'CREATE ROLE bag_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS';
  END IF;

  SELECT bool_or(
    rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit
    OR rolreplication OR rolbypassrls
  )
  INTO rol_onveilig
  FROM pg_catalog.pg_roles
  WHERE rolname IN ('bag_loader', 'bag_publisher', 'bag_reader');

  IF COALESCE(rol_onveilig, true) THEN
    RAISE EXCEPTION 'BAG-rollen moeten NOLOGIN, NOINHERIT en NOBYPASSRLS blijven';
  END IF;
END
$roles$;

-- De afgescheiden BAG-rollen mogen PostGIS-typen en -functies gebruiken,
-- zonder daardoor toegang tot CRM-, Auth- of Storage-schema's te krijgen.
GRANT USAGE ON SCHEMA extensions
  TO bag_loader, bag_publisher, bag_reader;

CREATE TABLE bag_control.datasetversies (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  datasetversie text NOT NULL,
  scope_code text NOT NULL,
  status text NOT NULL DEFAULT 'staging'
    CHECK (status IN ('staging', 'gevalideerd', 'actief', 'vervangen', 'mislukt')),
  is_actief boolean NOT NULL DEFAULT false,
  bron_checksum text NOT NULL,
  bron_checksum_algoritme text NOT NULL DEFAULT 'sha256'
    CHECK (bron_checksum_algoritme = 'sha256'),
  bron_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  aangemaakt_op timestamptz NOT NULL DEFAULT now(),
  gevalideerd_op timestamptz,
  geactiveerd_op timestamptz,
  vervangen_op timestamptz,
  CHECK (NOT is_actief OR status = 'actief'),
  UNIQUE (datasetversie, scope_code)
);

CREATE UNIQUE INDEX bag_datasetversies_een_actief_per_scope_idx
  ON bag_control.datasetversies (scope_code)
  WHERE is_actief;
CREATE INDEX bag_datasetversies_status_idx
  ON bag_control.datasetversies (status);

CREATE TABLE bag_staging.objecten (
  datasetversie_id bigint NOT NULL
    REFERENCES bag_control.datasetversies(id) ON DELETE CASCADE,
  objecttype text NOT NULL CHECK (objecttype IN (
    'Pand', 'Verblijfsobject', 'Nummeraanduiding', 'OpenbareRuimte',
    'Woonplaats', 'Standplaats', 'Ligplaats'
  )),
  identificatie text NOT NULL,
  ingeladen_op timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (datasetversie_id, objecttype, identificatie)
);

CREATE INDEX bag_staging_objecten_lookup_idx
  ON bag_staging.objecten (objecttype, identificatie);

CREATE TABLE bag_staging.voorkomens (
  datasetversie_id bigint NOT NULL,
  objecttype text NOT NULL,
  identificatie text NOT NULL,
  voorkomen_sleutel text NOT NULL,
  voorkomenidentificatie integer NOT NULL,
  is_actueel boolean NOT NULL,
  begin_geldigheid date,
  eind_geldigheid date,
  status text,
  velden jsonb NOT NULL DEFAULT '{}'::jsonb,
  ingeladen_op timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (datasetversie_id, objecttype, identificatie, voorkomen_sleutel),
  FOREIGN KEY (datasetversie_id, objecttype, identificatie)
    REFERENCES bag_staging.objecten(datasetversie_id, objecttype, identificatie)
    ON DELETE CASCADE
);

CREATE INDEX bag_staging_voorkomens_bron_id_idx
  ON bag_staging.voorkomens (
    datasetversie_id, objecttype, identificatie, voorkomenidentificatie
  );
CREATE INDEX bag_staging_voorkomens_actueel_idx
  ON bag_staging.voorkomens (datasetversie_id, objecttype, is_actueel);
CREATE INDEX bag_staging_voorkomens_geldigheid_idx
  ON bag_staging.voorkomens (begin_geldigheid, eind_geldigheid);
CREATE INDEX bag_staging_voorkomens_velden_gin_idx
  ON bag_staging.voorkomens USING gin (velden);

CREATE TABLE bag_staging.relaties (
  datasetversie_id bigint NOT NULL,
  bron_objecttype text NOT NULL,
  bron_identificatie text NOT NULL,
  relatietype text NOT NULL,
  doel_identificatie text NOT NULL,
  ingeladen_op timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (
    datasetversie_id, bron_objecttype, bron_identificatie,
    relatietype, doel_identificatie
  ),
  FOREIGN KEY (datasetversie_id, bron_objecttype, bron_identificatie)
    REFERENCES bag_staging.objecten(datasetversie_id, objecttype, identificatie)
    ON DELETE CASCADE
);

CREATE INDEX bag_staging_relaties_bron_idx
  ON bag_staging.relaties (bron_objecttype, bron_identificatie);
CREATE INDEX bag_staging_relaties_doel_idx
  ON bag_staging.relaties (doel_identificatie);

CREATE TABLE bag_staging.geometrieen (
  datasetversie_id bigint NOT NULL,
  objecttype text NOT NULL,
  identificatie text NOT NULL,
  voorkomen_sleutel text NOT NULL,
  voorkomenidentificatie integer NOT NULL,
  geometrie_volgnummer integer NOT NULL CHECK (geometrie_volgnummer > 0),
  geometrie extensions.geometry(GeometryZ, 28992) NOT NULL,
  ingeladen_op timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (
    datasetversie_id, objecttype, identificatie,
    voorkomen_sleutel, geometrie_volgnummer
  ),
  FOREIGN KEY (datasetversie_id, objecttype, identificatie, voorkomen_sleutel)
    REFERENCES bag_staging.voorkomens(
      datasetversie_id, objecttype, identificatie, voorkomen_sleutel
    ) ON DELETE CASCADE,
  CHECK (extensions.st_srid(geometrie) = 28992),
  CHECK (extensions.st_ndims(geometrie) = 3),
  CHECK (extensions.geometrytype(geometrie) IN ('POINT', 'POLYGON'))
);

CREATE INDEX bag_staging_geometrieen_gist_idx
  ON bag_staging.geometrieen USING gist (geometrie);
CREATE INDEX bag_staging_geometrieen_object_idx
  ON bag_staging.geometrieen (objecttype, identificatie);

CREATE TABLE bag_control.geometrie_afwijkingen (
  datasetversie_id bigint NOT NULL
    REFERENCES bag_control.datasetversies(id) ON DELETE CASCADE,
  objecttype text NOT NULL,
  identificatie text NOT NULL,
  voorkomen_sleutel text NOT NULL,
  voorkomenidentificatie integer,
  geometrie_volgnummer integer NOT NULL CHECK (geometrie_volgnummer > 0),
  reden text NOT NULL,
  wkt text,
  bronmetadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  vastgelegd_op timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (
    datasetversie_id, objecttype, identificatie,
    voorkomen_sleutel, geometrie_volgnummer
  )
);

CREATE INDEX bag_geometrie_afwijkingen_bron_idx
  ON bag_control.geometrie_afwijkingen (
    objecttype, identificatie, voorkomenidentificatie
  );

CREATE TABLE bag_published.objecten (
  datasetversie_id bigint NOT NULL
    REFERENCES bag_control.datasetversies(id) ON DELETE RESTRICT,
  objecttype text NOT NULL CHECK (objecttype IN (
    'Pand', 'Verblijfsobject', 'Nummeraanduiding', 'OpenbareRuimte',
    'Woonplaats', 'Standplaats', 'Ligplaats'
  )),
  identificatie text NOT NULL,
  gepubliceerd_op timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (datasetversie_id, objecttype, identificatie)
);

CREATE INDEX bag_published_objecten_lookup_idx
  ON bag_published.objecten (objecttype, identificatie);

CREATE TABLE bag_published.voorkomens (
  datasetversie_id bigint NOT NULL,
  objecttype text NOT NULL,
  identificatie text NOT NULL,
  voorkomen_sleutel text NOT NULL,
  voorkomenidentificatie integer NOT NULL,
  is_actueel boolean NOT NULL,
  begin_geldigheid date,
  eind_geldigheid date,
  status text,
  velden jsonb NOT NULL DEFAULT '{}'::jsonb,
  gepubliceerd_op timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (datasetversie_id, objecttype, identificatie, voorkomen_sleutel),
  FOREIGN KEY (datasetversie_id, objecttype, identificatie)
    REFERENCES bag_published.objecten(datasetversie_id, objecttype, identificatie)
    ON DELETE CASCADE
);

CREATE INDEX bag_published_voorkomens_bron_id_idx
  ON bag_published.voorkomens (
    datasetversie_id, objecttype, identificatie, voorkomenidentificatie
  );
CREATE INDEX bag_published_voorkomens_actueel_idx
  ON bag_published.voorkomens (datasetversie_id, objecttype, is_actueel);

CREATE TABLE bag_published.relaties (
  datasetversie_id bigint NOT NULL,
  bron_objecttype text NOT NULL,
  bron_identificatie text NOT NULL,
  relatietype text NOT NULL,
  doel_identificatie text NOT NULL,
  gepubliceerd_op timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (
    datasetversie_id, bron_objecttype, bron_identificatie,
    relatietype, doel_identificatie
  ),
  FOREIGN KEY (datasetversie_id, bron_objecttype, bron_identificatie)
    REFERENCES bag_published.objecten(datasetversie_id, objecttype, identificatie)
    ON DELETE CASCADE
);

CREATE INDEX bag_published_relaties_bron_idx
  ON bag_published.relaties (bron_objecttype, bron_identificatie);
CREATE INDEX bag_published_relaties_doel_idx
  ON bag_published.relaties (doel_identificatie);

CREATE TABLE bag_published.geometrieen (
  datasetversie_id bigint NOT NULL,
  objecttype text NOT NULL,
  identificatie text NOT NULL,
  voorkomen_sleutel text NOT NULL,
  voorkomenidentificatie integer NOT NULL,
  geometrie_volgnummer integer NOT NULL CHECK (geometrie_volgnummer > 0),
  geometrie extensions.geometry(GeometryZ, 28992) NOT NULL,
  gepubliceerd_op timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (
    datasetversie_id, objecttype, identificatie,
    voorkomen_sleutel, geometrie_volgnummer
  ),
  FOREIGN KEY (datasetversie_id, objecttype, identificatie, voorkomen_sleutel)
    REFERENCES bag_published.voorkomens(
      datasetversie_id, objecttype, identificatie, voorkomen_sleutel
    ) ON DELETE CASCADE,
  CHECK (extensions.st_srid(geometrie) = 28992),
  CHECK (extensions.st_ndims(geometrie) = 3),
  CHECK (extensions.geometrytype(geometrie) IN ('POINT', 'POLYGON'))
);

CREATE INDEX bag_published_geometrieen_gist_idx
  ON bag_published.geometrieen USING gist (geometrie);

-- De drie standaard-applicatierollen krijgen in 2A.3B bewust geen BAG-toegang.
REVOKE ALL ON SCHEMA bag_control, bag_staging, bag_published
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA bag_control, bag_staging, bag_published
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA bag_control, bag_staging, bag_published
  FROM PUBLIC, anon, authenticated, service_role;

GRANT USAGE ON SCHEMA bag_control, bag_staging TO bag_loader;
GRANT SELECT, INSERT ON bag_control.datasetversies TO bag_loader;
GRANT USAGE, SELECT ON SEQUENCE bag_control.datasetversies_id_seq TO bag_loader;
GRANT SELECT, INSERT ON bag_control.geometrie_afwijkingen TO bag_loader;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA bag_staging TO bag_loader;

GRANT USAGE ON SCHEMA bag_control, bag_staging, bag_published TO bag_publisher;
GRANT SELECT, UPDATE ON bag_control.datasetversies TO bag_publisher;
GRANT SELECT ON bag_control.geometrie_afwijkingen TO bag_publisher;
GRANT SELECT ON ALL TABLES IN SCHEMA bag_staging TO bag_publisher;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA bag_published TO bag_publisher;

GRANT USAGE ON SCHEMA bag_control, bag_published TO bag_reader;
GRANT SELECT ON bag_control.datasetversies TO bag_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA bag_published TO bag_reader;

ALTER TABLE bag_control.datasetversies ENABLE ROW LEVEL SECURITY;
ALTER TABLE bag_control.datasetversies FORCE ROW LEVEL SECURITY;
ALTER TABLE bag_control.geometrie_afwijkingen ENABLE ROW LEVEL SECURITY;
ALTER TABLE bag_control.geometrie_afwijkingen FORCE ROW LEVEL SECURITY;
ALTER TABLE bag_staging.objecten ENABLE ROW LEVEL SECURITY;
ALTER TABLE bag_staging.objecten FORCE ROW LEVEL SECURITY;
ALTER TABLE bag_staging.voorkomens ENABLE ROW LEVEL SECURITY;
ALTER TABLE bag_staging.voorkomens FORCE ROW LEVEL SECURITY;
ALTER TABLE bag_staging.relaties ENABLE ROW LEVEL SECURITY;
ALTER TABLE bag_staging.relaties FORCE ROW LEVEL SECURITY;
ALTER TABLE bag_staging.geometrieen ENABLE ROW LEVEL SECURITY;
ALTER TABLE bag_staging.geometrieen FORCE ROW LEVEL SECURITY;
ALTER TABLE bag_published.objecten ENABLE ROW LEVEL SECURITY;
ALTER TABLE bag_published.objecten FORCE ROW LEVEL SECURITY;
ALTER TABLE bag_published.voorkomens ENABLE ROW LEVEL SECURITY;
ALTER TABLE bag_published.voorkomens FORCE ROW LEVEL SECURITY;
ALTER TABLE bag_published.relaties ENABLE ROW LEVEL SECURITY;
ALTER TABLE bag_published.relaties FORCE ROW LEVEL SECURITY;
ALTER TABLE bag_published.geometrieen ENABLE ROW LEVEL SECURITY;
ALTER TABLE bag_published.geometrieen FORCE ROW LEVEL SECURITY;

CREATE POLICY bag_loader_datasetversies_lezen
  ON bag_control.datasetversies FOR SELECT TO bag_loader USING (true);
CREATE POLICY bag_loader_datasetversies_aanmaken
  ON bag_control.datasetversies FOR INSERT TO bag_loader
  WITH CHECK (status = 'staging' AND NOT is_actief);
CREATE POLICY bag_publisher_datasetversies_beheren
  ON bag_control.datasetversies FOR ALL TO bag_publisher
  USING (true) WITH CHECK (true);
CREATE POLICY bag_reader_actieve_datasetversies_lezen
  ON bag_control.datasetversies FOR SELECT TO bag_reader
  USING (is_actief AND status = 'actief');

CREATE POLICY bag_loader_afwijkingen_lezen
  ON bag_control.geometrie_afwijkingen FOR SELECT TO bag_loader USING (true);
CREATE POLICY bag_loader_afwijkingen_aanmaken
  ON bag_control.geometrie_afwijkingen FOR INSERT TO bag_loader WITH CHECK (true);
CREATE POLICY bag_publisher_afwijkingen_lezen
  ON bag_control.geometrie_afwijkingen FOR SELECT TO bag_publisher USING (true);

CREATE POLICY bag_loader_objecten_beheren
  ON bag_staging.objecten FOR ALL TO bag_loader USING (true) WITH CHECK (true);
CREATE POLICY bag_loader_voorkomens_beheren
  ON bag_staging.voorkomens FOR ALL TO bag_loader USING (true) WITH CHECK (true);
CREATE POLICY bag_loader_relaties_beheren
  ON bag_staging.relaties FOR ALL TO bag_loader USING (true) WITH CHECK (true);
CREATE POLICY bag_loader_geometrieen_beheren
  ON bag_staging.geometrieen FOR ALL TO bag_loader USING (true) WITH CHECK (true);
CREATE POLICY bag_publisher_objecten_lezen
  ON bag_staging.objecten FOR SELECT TO bag_publisher USING (true);
CREATE POLICY bag_publisher_voorkomens_lezen
  ON bag_staging.voorkomens FOR SELECT TO bag_publisher USING (true);
CREATE POLICY bag_publisher_relaties_lezen
  ON bag_staging.relaties FOR SELECT TO bag_publisher USING (true);
CREATE POLICY bag_publisher_geometrieen_lezen
  ON bag_staging.geometrieen FOR SELECT TO bag_publisher USING (true);

CREATE POLICY bag_publisher_objecten_publiceren
  ON bag_published.objecten FOR INSERT TO bag_publisher WITH CHECK (true);
CREATE POLICY bag_publisher_voorkomens_publiceren
  ON bag_published.voorkomens FOR INSERT TO bag_publisher WITH CHECK (true);
CREATE POLICY bag_publisher_relaties_publiceren
  ON bag_published.relaties FOR INSERT TO bag_publisher WITH CHECK (true);
CREATE POLICY bag_publisher_geometrieen_publiceren
  ON bag_published.geometrieen FOR INSERT TO bag_publisher WITH CHECK (true);
CREATE POLICY bag_publisher_objecten_lezen
  ON bag_published.objecten FOR SELECT TO bag_publisher USING (true);
CREATE POLICY bag_publisher_voorkomens_lezen
  ON bag_published.voorkomens FOR SELECT TO bag_publisher USING (true);
CREATE POLICY bag_publisher_relaties_lezen
  ON bag_published.relaties FOR SELECT TO bag_publisher USING (true);
CREATE POLICY bag_publisher_geometrieen_lezen
  ON bag_published.geometrieen FOR SELECT TO bag_publisher USING (true);

CREATE POLICY bag_reader_actieve_objecten_lezen
  ON bag_published.objecten FOR SELECT TO bag_reader
  USING (EXISTS (
    SELECT 1 FROM bag_control.datasetversies AS d
    WHERE d.id = datasetversie_id AND d.is_actief AND d.status = 'actief'
  ));
CREATE POLICY bag_reader_actieve_voorkomens_lezen
  ON bag_published.voorkomens FOR SELECT TO bag_reader
  USING (EXISTS (
    SELECT 1 FROM bag_control.datasetversies AS d
    WHERE d.id = datasetversie_id AND d.is_actief AND d.status = 'actief'
  ));
CREATE POLICY bag_reader_actieve_relaties_lezen
  ON bag_published.relaties FOR SELECT TO bag_reader
  USING (EXISTS (
    SELECT 1 FROM bag_control.datasetversies AS d
    WHERE d.id = datasetversie_id AND d.is_actief AND d.status = 'actief'
  ));
CREATE POLICY bag_reader_actieve_geometrieen_lezen
  ON bag_published.geometrieen FOR SELECT TO bag_reader
  USING (EXISTS (
    SELECT 1 FROM bag_control.datasetversies AS d
    WHERE d.id = datasetversie_id AND d.is_actief AND d.status = 'actief'
  ));

-- Nieuwe objecten blijven standaard gesloten totdat een latere BUILD ze expliciet opent.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA bag_control
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA bag_staging
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA bag_published
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON SCHEMA bag_control IS
  'Private BAG-datasetsturing en geometriequarantaine; geen CRM-schema.';
COMMENT ON SCHEMA bag_staging IS
  'Private, versiegebonden BAG-importlaag; niet beschikbaar voor app-rollen.';
COMMENT ON SCHEMA bag_published IS
  'Private, immutable BAG-publicatielaag; ontsluiting volgt pas in BUILD 2A.7.';

COMMIT;
