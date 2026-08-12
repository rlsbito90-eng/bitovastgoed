-- BUILD 1D.1 kandidaat — NIET automatisch toepassen.
-- Doelproject uitsluitend: BAG shadow xfygspvpeugxowxbcvnm
-- Doel: verrijk uitsluitend de actieve Amsterdam search-index met CBS Wijk- en Buurtkaart 2025.
-- Randvoorwaarden:
--   * CBS-brondata is vooraf gevalideerd en staat in tijdelijke/staging tabellen;
--   * geometrie is EPSG:28992;
--   * bag_published en bag_control worden niet gewijzigd;
--   * geen nieuwe BAG-indexbuild en geen activatie.
--
-- Verwachte stagingcontracten:
--   cbs_stage.buurten_2025(gemeentecode text, buurtcode text, buurtnaam text, geometrie geometry(MultiPolygon,28992))
--   cbs_stage.wijken_2025(gemeentecode text, wijkcode text, wijknaam text)

WITH actieve_build AS MATERIALIZED (
  SELECT b.id AS index_build_id
  FROM bag_search.index_builds b
  JOIN bag_control.datasetversies d
    ON d.id = b.datasetversie_id
   AND d.scope_code = b.scope_code
   AND d.status = 'actief'
   AND d.is_actief
  WHERE b.scope_code = '0363'
    AND b.status = 'actief'
    AND b.validatie_fouten = 0
    AND b.gebouwd_panden = b.verwacht_panden
  ORDER BY b.id DESC
  LIMIT 1
),
bron_buurten AS MATERIALIZED (
  SELECT
    buurtcode,
    buurtnaam,
    'WK' || substring(buurtcode FROM 3 FOR 6) AS wijkcode,
    geometrie
  FROM cbs_stage.buurten_2025
  WHERE gemeentecode = 'GM0363'
    AND buurtcode ~ '^BU0363[0-9]{4}$'
),
bron_wijken AS MATERIALIZED (
  SELECT wijkcode, wijknaam
  FROM cbs_stage.wijken_2025
  WHERE gemeentecode = 'GM0363'
    AND wijkcode ~ '^WK0363[0-9]{2}$'
),
koppelingen AS MATERIALIZED (
  SELECT
    i.index_build_id,
    i.pand_identificatie,
    b.wijkcode,
    w.wijknaam,
    b.buurtcode,
    b.buurtnaam,
    count(*) OVER (PARTITION BY i.index_build_id, i.pand_identificatie) AS match_count
  FROM bag_search.pand_search_index i
  JOIN actieve_build a ON a.index_build_id = i.index_build_id
  JOIN bron_buurten b ON ST_Covers(b.geometrie, i.centroid)
  LEFT JOIN bron_wijken w ON w.wijkcode = b.wijkcode
  WHERE i.scope_code = '0363'
)
UPDATE bag_search.pand_search_index i
SET wijk_code = k.wijkcode,
    wijk_naam = k.wijknaam,
    buurt_code = k.buurtcode,
    buurt_naam = k.buurtnaam
FROM koppelingen k
WHERE i.index_build_id = k.index_build_id
  AND i.pand_identificatie = k.pand_identificatie
  AND i.scope_code = '0363'
  AND k.match_count = 1
  AND k.wijknaam IS NOT NULL;

-- Verplichte acceptatie vóór enige toepassing:
-- 1. actieve Amsterdam-build bestaat exact één keer;
-- 2. alle staginggeometrieën SRID 28992 en geometrisch geldig;
-- 3. 0 dubbele buurtcodes / wijkcodes binnen GM0363;
-- 4. 0 panden met >1 buurtmatch;
-- 5. onverklaarde 0-match panden afzonderlijk rapporteren;
-- 6. na proef: gemeente_code/gemeente_naam ongewijzigd;
-- 7. bag_published, bag_control, auth, storage en secrets ongewijzigd.
