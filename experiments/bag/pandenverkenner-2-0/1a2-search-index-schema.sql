\set ON_ERROR_STOP on

-- Pandenverkenner 2.0 — BUILD 1A.2
-- Repository-only schema kandidaat. Niet als Supabase-migratie toepassen.
-- Doel: rebuildable read-model naast bag_published; geen nieuwe BAG-bronwaarheid.

CREATE SCHEMA IF NOT EXISTS bag_search;

CREATE TABLE bag_search.pand_search_index (
  datasetversie_id bigint NOT NULL,
  scope_code text NOT NULL,
  pand_identificatie text NOT NULL,
  voorkomen_sleutel text NOT NULL,
  index_versie text NOT NULL,

  pandstatus_huidig text,
  oorspronkelijk_bouwjaar integer,

  pand_geometrie geometry(GeometryZ, 28992),
  centroid geometry(Point, 28992),

  heeft_vbo boolean NOT NULL,
  vbo_aantal integer NOT NULL,
  vbo_oppervlakte_som numeric,
  vbo_oppervlakte_max numeric,
  gebruiksdoelen text[] NOT NULL DEFAULT '{}',
  is_gemengd boolean NOT NULL,

  primair_adres text,
  primair_straat text,
  primair_huisnummer text,
  primair_postcode text,
  primair_plaats text,
  adres_count integer NOT NULL,

  gemeente_code text NOT NULL,
  gemeente_naam text,
  cbs_jaarversie integer,
  wijk_code text,
  wijk_naam text,
  buurt_code text,
  buurt_naam text,
  stadsdeel_code text,
  stadsdeel_naam text,

  opgebouwd_op timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (datasetversie_id, scope_code, pand_identificatie),

  CHECK (scope_code ~ '^[A-Za-z0-9_-]{1,64}$'),
  CHECK (index_versie <> ''),
  CHECK (gemeente_code <> ''),
  CHECK (oorspronkelijk_bouwjaar IS NULL OR oorspronkelijk_bouwjaar BETWEEN 1000 AND 3000),
  CHECK (vbo_aantal >= 0),
  CHECK (adres_count >= 0),
  CHECK (vbo_oppervlakte_som IS NULL OR vbo_oppervlakte_som >= 0),
  CHECK (vbo_oppervlakte_max IS NULL OR vbo_oppervlakte_max >= 0),
  CHECK (
    (heeft_vbo AND vbo_aantal >= 1 AND vbo_oppervlakte_som IS NOT NULL AND vbo_oppervlakte_max IS NOT NULL)
    OR
    (NOT heeft_vbo AND vbo_aantal = 0 AND vbo_oppervlakte_som IS NULL AND vbo_oppervlakte_max IS NULL AND cardinality(gebruiksdoelen) = 0)
  ),
  CHECK (vbo_oppervlakte_som IS NULL OR vbo_oppervlakte_max IS NULL OR vbo_oppervlakte_max <= vbo_oppervlakte_som),
  CHECK (is_gemengd = (cardinality(gebruiksdoelen) > 1)),
  CHECK ((adres_count = 0 AND primair_adres IS NULL) OR (adres_count > 0 AND primair_adres IS NOT NULL)),
  CHECK (pand_geometrie IS NULL OR ST_SRID(pand_geometrie) = 28992),
  CHECK (pand_geometrie IS NULL OR ST_NDims(pand_geometrie) = 3),
  CHECK (centroid IS NULL OR ST_SRID(centroid) = 28992)
);

CREATE INDEX pand_search_index_scope_id_idx
  ON bag_search.pand_search_index (scope_code, pand_identificatie);

CREATE INDEX pand_search_index_scope_status_idx
  ON bag_search.pand_search_index (scope_code, pandstatus_huidig, pand_identificatie);

CREATE INDEX pand_search_index_scope_bouwjaar_idx
  ON bag_search.pand_search_index (scope_code, oorspronkelijk_bouwjaar, pand_identificatie);

CREATE INDEX pand_search_index_scope_vbo_som_idx
  ON bag_search.pand_search_index (scope_code, vbo_oppervlakte_som, pand_identificatie);

CREATE INDEX pand_search_index_scope_vbo_max_idx
  ON bag_search.pand_search_index (scope_code, vbo_oppervlakte_max, pand_identificatie);

CREATE INDEX pand_search_index_scope_vbo_aantal_idx
  ON bag_search.pand_search_index (scope_code, vbo_aantal, pand_identificatie);

CREATE INDEX pand_search_index_gebruiksdoelen_gin_idx
  ON bag_search.pand_search_index USING gin (gebruiksdoelen);

CREATE INDEX pand_search_index_centroid_gist_idx
  ON bag_search.pand_search_index USING gist (centroid);

CREATE INDEX pand_search_index_geometrie_gist_idx
  ON bag_search.pand_search_index USING gist (pand_geometrie);

CREATE INDEX pand_search_index_buurt_idx
  ON bag_search.pand_search_index (scope_code, buurt_code, pand_identificatie);

CREATE INDEX pand_search_index_wijk_idx
  ON bag_search.pand_search_index (scope_code, wijk_code, pand_identificatie);

ALTER TABLE bag_search.pand_search_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE bag_search.pand_search_index FORCE ROW LEVEL SECURITY;

REVOKE ALL ON SCHEMA bag_search FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE bag_search.pand_search_index FROM PUBLIC, anon, authenticated, service_role;

-- bag_reader krijgt in een latere BUILD uitsluitend toegang via begrensde
-- bag_service-queryfuncties. Geen directe SELECT op de index in 1A.2.
