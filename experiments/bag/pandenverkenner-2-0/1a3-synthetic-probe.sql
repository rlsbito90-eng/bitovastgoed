\set ON_ERROR_STOP on

-- Pandenverkenner 2.0 — BUILD 1A.3 kandidaat
-- Alleen uitvoeren in een geïsoleerde testdatabase NADAT 1a2-search-index-schema.sql
-- daar is toegepast. De gehele proef draait in één transactie en eindigt met ROLLBACK.
-- Geen bag_control, bag_published, CRM-schema of actieve dataset wordt gewijzigd.

BEGIN;

DO $probe$
BEGIN
  IF to_regclass('bag_search.index_builds') IS NULL
     OR to_regclass('bag_search.pand_search_index') IS NULL THEN
    RAISE EXCEPTION '1A.2 search-index schema ontbreekt';
  END IF;
END
$probe$;

INSERT INTO bag_search.index_builds (
  datasetversie_id, scope_code, index_versie, status, verwacht_panden
) VALUES
  (900001, '0363', 'pv2-synthetic-v1', 'actief', 2),
  (900002, '0363', 'pv2-synthetic-v2', 'opbouw', 2);

WITH builds AS (
  SELECT id, datasetversie_id, index_versie
  FROM bag_search.index_builds
  WHERE scope_code = '0363'
    AND datasetversie_id IN (900001, 900002)
)
INSERT INTO bag_search.pand_search_index (
  index_build_id,
  datasetversie_id,
  scope_code,
  pand_identificatie,
  voorkomen_sleutel,
  index_versie,
  pandstatus_huidig,
  oorspronkelijk_bouwjaar,
  heeft_vbo,
  vbo_aantal,
  vbo_oppervlakte_som,
  vbo_oppervlakte_max,
  gebruiksdoelen,
  is_gemengd,
  primair_adres,
  primair_straat,
  primair_huisnummer,
  primair_postcode,
  primair_plaats,
  adres_count,
  gemeente_code,
  gemeente_naam
)
SELECT
  b.id,
  b.datasetversie_id,
  '0363',
  CASE WHEN b.datasetversie_id = 900001 THEN '0363100000000001' ELSE '0363100000000003' END,
  CASE WHEN b.datasetversie_id = 900001 THEN 'Pand:0363100000000001:1' ELSE 'Pand:0363100000000003:1' END,
  b.index_versie,
  'Pand in gebruik',
  1928,
  true,
  2,
  180,
  100,
  ARRAY['kantoorfunctie', 'woonfunctie'],
  true,
  CASE WHEN b.datasetversie_id = 900001 THEN 'Teststraat 1' ELSE 'Teststraat 3' END,
  'Teststraat',
  CASE WHEN b.datasetversie_id = 900001 THEN '1' ELSE '3' END,
  '1000AA',
  'Amsterdam',
  2,
  'GM0363',
  'Amsterdam'
FROM builds AS b;

WITH actieve_build AS (
  SELECT id, datasetversie_id, index_versie
  FROM bag_search.index_builds
  WHERE scope_code = '0363' AND status = 'actief'
)
INSERT INTO bag_search.pand_search_index (
  index_build_id,
  datasetversie_id,
  scope_code,
  pand_identificatie,
  voorkomen_sleutel,
  index_versie,
  pandstatus_huidig,
  oorspronkelijk_bouwjaar,
  heeft_vbo,
  vbo_aantal,
  vbo_oppervlakte_som,
  vbo_oppervlakte_max,
  gebruiksdoelen,
  is_gemengd,
  primair_adres,
  primair_straat,
  primair_huisnummer,
  primair_postcode,
  primair_plaats,
  adres_count,
  gemeente_code,
  gemeente_naam
)
SELECT
  id,
  datasetversie_id,
  '0363',
  '0363100000000002',
  'Pand:0363100000000002:1',
  index_versie,
  'Bouw gestart',
  2026,
  false,
  0,
  NULL,
  NULL,
  ARRAY[]::text[],
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  0,
  'GM0363',
  'Amsterdam'
FROM actieve_build;

UPDATE bag_search.index_builds AS b
SET gebouwd_panden = x.aantal,
    gebouwd_zonder_vbo = x.zonder_vbo
FROM (
  SELECT index_build_id,
         count(*)::integer AS aantal,
         count(*) FILTER (WHERE NOT heeft_vbo)::integer AS zonder_vbo
  FROM bag_search.pand_search_index
  GROUP BY index_build_id
) AS x
WHERE b.id = x.index_build_id;

DO $assertions$
DECLARE
  actief_count integer;
  actieve_rijen integer;
  opbouw_rijen integer;
  zonder_vbo integer;
  nul_oppervlakte_fouten integer;
BEGIN
  SELECT count(*) INTO actief_count
  FROM bag_search.index_builds
  WHERE scope_code = '0363' AND status = 'actief';
  IF actief_count <> 1 THEN
    RAISE EXCEPTION 'verwacht exact één actieve build, vond %', actief_count;
  END IF;

  SELECT count(*) INTO actieve_rijen
  FROM bag_search.pand_search_index AS i
  JOIN bag_search.index_builds AS b ON b.id = i.index_build_id
  WHERE b.scope_code = '0363' AND b.status = 'actief';
  IF actieve_rijen <> 2 THEN
    RAISE EXCEPTION 'verwacht 2 zichtbare synthetische rijen, vond %', actieve_rijen;
  END IF;

  SELECT count(*) INTO opbouw_rijen
  FROM bag_search.pand_search_index AS i
  JOIN bag_search.index_builds AS b ON b.id = i.index_build_id
  WHERE b.scope_code = '0363' AND b.status = 'opbouw';
  IF opbouw_rijen <> 1 THEN
    RAISE EXCEPTION 'verwacht 1 niet-actieve opbouwrij, vond %', opbouw_rijen;
  END IF;

  SELECT count(*) INTO zonder_vbo
  FROM bag_search.pand_search_index AS i
  JOIN bag_search.index_builds AS b ON b.id = i.index_build_id
  WHERE b.scope_code = '0363' AND b.status = 'actief' AND NOT i.heeft_vbo;
  IF zonder_vbo <> 1 THEN
    RAISE EXCEPTION 'pand zonder VBO ontbreekt uit actieve synthetische build';
  END IF;

  SELECT count(*) INTO nul_oppervlakte_fouten
  FROM bag_search.pand_search_index
  WHERE NOT heeft_vbo
    AND (vbo_oppervlakte_som IS NOT NULL OR vbo_oppervlakte_max IS NOT NULL);
  IF nul_oppervlakte_fouten <> 0 THEN
    RAISE EXCEPTION 'NULL-semantiek voor panden zonder VBO is geschonden';
  END IF;
END
$assertions$;

-- Bewijs dat een tweede actieve build voor dezelfde scope door de unieke partiële
-- index wordt geweigerd. De subtransactie vangt uitsluitend de verwachte fout af.
DO $unique_active$
BEGIN
  BEGIN
    UPDATE bag_search.index_builds
    SET status = 'actief'
    WHERE datasetversie_id = 900002 AND scope_code = '0363';
    RAISE EXCEPTION 'tweede actieve build werd ten onrechte toegestaan';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;
END
$unique_active$;

ROLLBACK;
