-- Pandenverkenner 2.0 — BUILD 1D.3 kandidaat
-- NIET automatisch uitvoeren.
-- Doelproject uitsluitend BAG shadow xfygspvpeugxowxbcvnm.
-- Verrijkt alleen actieve Amsterdam-index build 3 vanuit gevalideerde CBS 2025 staging.
-- De spatial mapping wordt één keer gematerialiseerd; de brede indexupdate gebeurt
-- daarna in 16 afzonderlijke statements binnen één transactie om statement_timeout
-- te respecteren zonder de atomische rollbackgrens te verliezen.

BEGIN;

ALTER TABLE bag_search.pand_search_index
  ADD COLUMN IF NOT EXISTS cbs_gebiedsjaar integer;

ALTER TABLE bag_search.index_builds
  ADD COLUMN IF NOT EXISTS cbs_gebiedsjaar integer,
  ADD COLUMN IF NOT EXISTS cbs_buurten_sha256 text,
  ADD COLUMN IF NOT EXISTS cbs_wijken_sha256 text,
  ADD COLUMN IF NOT EXISTS cbs_verrijkt_op timestamptz,
  ADD COLUMN IF NOT EXISTS cbs_verrijkte_panden integer,
  ADD COLUMN IF NOT EXISTS cbs_ongekoppelde_panden integer;

DO $$
BEGIN
  IF (SELECT status FROM bag_search.index_builds WHERE id=3 AND scope_code='0363') <> 'actief' THEN RAISE EXCEPTION 'build 3 / scope 0363 is niet actief'; END IF;
  IF (SELECT count(*) FROM bag_search.pand_search_index WHERE index_build_id=3 AND scope_code='0363') <> 211112 THEN RAISE EXCEPTION 'onverwacht aantal Amsterdam-indexrijen'; END IF;
  IF (SELECT count(*) FROM bag_search.cbs_buurten_staging WHERE bronjaar=2025 AND gemeentecode='GM0363') <> 519 THEN RAISE EXCEPTION 'CBS buurten staging niet volledig'; END IF;
  IF (SELECT count(*) FROM bag_search.cbs_wijken_staging WHERE bronjaar=2025 AND gemeentecode='GM0363') <> 111 THEN RAISE EXCEPTION 'CBS wijken staging niet volledig'; END IF;
END $$;

CREATE TEMP TABLE cbs_unieke_match ON COMMIT DROP AS
SELECT i.pand_identificatie,b.buurtcode,b.buurtnaam,b.wijkcode,w.wijknaam,(hashtextextended(i.pand_identificatie,0) & 15)::smallint AS batch_nr
FROM bag_search.pand_search_index i
JOIN bag_search.cbs_buurten_staging b ON ST_Covers(b.geometrie,i.centroid)
JOIN bag_search.cbs_wijken_staging w ON w.wijkcode=b.wijkcode AND w.bronjaar=2025 AND w.gemeentecode='GM0363'
WHERE i.index_build_id=3 AND i.scope_code='0363' AND b.bronjaar=2025 AND b.gemeentecode='GM0363';
CREATE UNIQUE INDEX cbs_unieke_match_pand_idx ON cbs_unieke_match(pand_identificatie);
CREATE INDEX cbs_unieke_match_batch_idx ON cbs_unieke_match(batch_nr,pand_identificatie);

DO $$
BEGIN
  IF (SELECT count(*) FROM cbs_unieke_match) <> 211082 THEN RAISE EXCEPTION 'onverwacht aantal unieke CBS-matches'; END IF;
  IF (SELECT count(DISTINCT pand_identificatie) FROM cbs_unieke_match) <> 211082 THEN RAISE EXCEPTION 'ambigue CBS-buurtmatches'; END IF;
END $$;

WITH bijgewerkt AS (UPDATE bag_search.pand_search_index i SET wijk_code=m.wijkcode,wijk_naam=m.wijknaam,buurt_code=m.buurtcode,buurt_naam=m.buurtnaam,cbs_gebiedsjaar=2025 FROM cbs_unieke_match m WHERE m.batch_nr=0 AND i.index_build_id=3 AND i.scope_code='0363' AND i.pand_identificatie=m.pand_identificatie RETURNING i.pand_identificatie) SELECT 0 AS batch_nr,count(*) AS verrijkte_panden FROM bijgewerkt;
WITH bijgewerkt AS (UPDATE bag_search.pand_search_index i SET wijk_code=m.wijkcode,wijk_naam=m.wijknaam,buurt_code=m.buurtcode,buurt_naam=m.buurtnaam,cbs_gebiedsjaar=2025 FROM cbs_unieke_match m WHERE m.batch_nr=1 AND i.index_build_id=3 AND i.scope_code='0363' AND i.pand_identificatie=m.pand_identificatie RETURNING i.pand_identificatie) SELECT 1 AS batch_nr,count(*) AS verrijkte_panden FROM bijgewerkt;
WITH bijgewerkt AS (UPDATE bag_search.pand_search_index i SET wijk_code=m.wijkcode,wijk_naam=m.wijknaam,buurt_code=m.buurtcode,buurt_naam=m.buurtnaam,cbs_gebiedsjaar=2025 FROM cbs_unieke_match m WHERE m.batch_nr=2 AND i.index_build_id=3 AND i.scope_code='0363' AND i.pand_identificatie=m.pand_identificatie RETURNING i.pand_identificatie) SELECT 2 AS batch_nr,count(*) AS verrijkte_panden FROM bijgewerkt;
WITH bijgewerkt AS (UPDATE bag_search.pand_search_index i SET wijk_code=m.wijkcode,wijk_naam=m.wijknaam,buurt_code=m.buurtcode,buurt_naam=m.buurtnaam,cbs_gebiedsjaar=2025 FROM cbs_unieke_match m WHERE m.batch_nr=3 AND i.index_build_id=3 AND i.scope_code='0363' AND i.pand_identificatie=m.pand_identificatie RETURNING i.pand_identificatie) SELECT 3 AS batch_nr,count(*) AS verrijkte_panden FROM bijgewerkt;
WITH bijgewerkt AS (UPDATE bag_search.pand_search_index i SET wijk_code=m.wijkcode,wijk_naam=m.wijknaam,buurt_code=m.buurtcode,buurt_naam=m.buurtnaam,cbs_gebiedsjaar=2025 FROM cbs_unieke_match m WHERE m.batch_nr=4 AND i.index_build_id=3 AND i.scope_code='0363' AND i.pand_identificatie=m.pand_identificatie RETURNING i.pand_identificatie) SELECT 4 AS batch_nr,count(*) AS verrijkte_panden FROM bijgewerkt;
WITH bijgewerkt AS (UPDATE bag_search.pand_search_index i SET wijk_code=m.wijkcode,wijk_naam=m.wijknaam,buurt_code=m.buurtcode,buurt_naam=m.buurtnaam,cbs_gebiedsjaar=2025 FROM cbs_unieke_match m WHERE m.batch_nr=5 AND i.index_build_id=3 AND i.scope_code='0363' AND i.pand_identificatie=m.pand_identificatie RETURNING i.pand_identificatie) SELECT 5 AS batch_nr,count(*) AS verrijkte_panden FROM bijgewerkt;
WITH bijgewerkt AS (UPDATE bag_search.pand_search_index i SET wijk_code=m.wijkcode,wijk_naam=m.wijknaam,buurt_code=m.buurtcode,buurt_naam=m.buurtnaam,cbs_gebiedsjaar=2025 FROM cbs_unieke_match m WHERE m.batch_nr=6 AND i.index_build_id=3 AND i.scope_code='0363' AND i.pand_identificatie=m.pand_identificatie RETURNING i.pand_identificatie) SELECT 6 AS batch_nr,count(*) AS verrijkte_panden FROM bijgewerkt;
WITH bijgewerkt AS (UPDATE bag_search.pand_search_index i SET wijk_code=m.wijkcode,wijk_naam=m.wijknaam,buurt_code=m.buurtcode,buurt_naam=m.buurtnaam,cbs_gebiedsjaar=2025 FROM cbs_unieke_match m WHERE m.batch_nr=7 AND i.index_build_id=3 AND i.scope_code='0363' AND i.pand_identificatie=m.pand_identificatie RETURNING i.pand_identificatie) SELECT 7 AS batch_nr,count(*) AS verrijkte_panden FROM bijgewerkt;
WITH bijgewerkt AS (UPDATE bag_search.pand_search_index i SET wijk_code=m.wijkcode,wijk_naam=m.wijknaam,buurt_code=m.buurtcode,buurt_naam=m.buurtnaam,cbs_gebiedsjaar=2025 FROM cbs_unieke_match m WHERE m.batch_nr=8 AND i.index_build_id=3 AND i.scope_code='0363' AND i.pand_identificatie=m.pand_identificatie RETURNING i.pand_identificatie) SELECT 8 AS batch_nr,count(*) AS verrijkte_panden FROM bijgewerkt;
WITH bijgewerkt AS (UPDATE bag_search.pand_search_index i SET wijk_code=m.wijkcode,wijk_naam=m.wijknaam,buurt_code=m.buurtcode,buurt_naam=m.buurtnaam,cbs_gebiedsjaar=2025 FROM cbs_unieke_match m WHERE m.batch_nr=9 AND i.index_build_id=3 AND i.scope_code='0363' AND i.pand_identificatie=m.pand_identificatie RETURNING i.pand_identificatie) SELECT 9 AS batch_nr,count(*) AS verrijkte_panden FROM bijgewerkt;
WITH bijgewerkt AS (UPDATE bag_search.pand_search_index i SET wijk_code=m.wijkcode,wijk_naam=m.wijknaam,buurt_code=m.buurtcode,buurt_naam=m.buurtnaam,cbs_gebiedsjaar=2025 FROM cbs_unieke_match m WHERE m.batch_nr=10 AND i.index_build_id=3 AND i.scope_code='0363' AND i.pand_identificatie=m.pand_identificatie RETURNING i.pand_identificatie) SELECT 10 AS batch_nr,count(*) AS verrijkte_panden FROM bijgewerkt;
WITH bijgewerkt AS (UPDATE bag_search.pand_search_index i SET wijk_code=m.wijkcode,wijk_naam=m.wijknaam,buurt_code=m.buurtcode,buurt_naam=m.buurtnaam,cbs_gebiedsjaar=2025 FROM cbs_unieke_match m WHERE m.batch_nr=11 AND i.index_build_id=3 AND i.scope_code='0363' AND i.pand_identificatie=m.pand_identificatie RETURNING i.pand_identificatie) SELECT 11 AS batch_nr,count(*) AS verrijkte_panden FROM bijgewerkt;
WITH bijgewerkt AS (UPDATE bag_search.pand_search_index i SET wijk_code=m.wijkcode,wijk_naam=m.wijknaam,buurt_code=m.buurtcode,buurt_naam=m.buurtnaam,cbs_gebiedsjaar=2025 FROM cbs_unieke_match m WHERE m.batch_nr=12 AND i.index_build_id=3 AND i.scope_code='0363' AND i.pand_identificatie=m.pand_identificatie RETURNING i.pand_identificatie) SELECT 12 AS batch_nr,count(*) AS verrijkte_panden FROM bijgewerkt;
WITH bijgewerkt AS (UPDATE bag_search.pand_search_index i SET wijk_code=m.wijkcode,wijk_naam=m.wijknaam,buurt_code=m.buurtcode,buurt_naam=m.buurtnaam,cbs_gebiedsjaar=2025 FROM cbs_unieke_match m WHERE m.batch_nr=13 AND i.index_build_id=3 AND i.scope_code='0363' AND i.pand_identificatie=m.pand_identificatie RETURNING i.pand_identificatie) SELECT 13 AS batch_nr,count(*) AS verrijkte_panden FROM bijgewerkt;
WITH bijgewerkt AS (UPDATE bag_search.pand_search_index i SET wijk_code=m.wijkcode,wijk_naam=m.wijknaam,buurt_code=m.buurtcode,buurt_naam=m.buurtnaam,cbs_gebiedsjaar=2025 FROM cbs_unieke_match m WHERE m.batch_nr=14 AND i.index_build_id=3 AND i.scope_code='0363' AND i.pand_identificatie=m.pand_identificatie RETURNING i.pand_identificatie) SELECT 14 AS batch_nr,count(*) AS verrijkte_panden FROM bijgewerkt;
WITH bijgewerkt AS (UPDATE bag_search.pand_search_index i SET wijk_code=m.wijkcode,wijk_naam=m.wijknaam,buurt_code=m.buurtcode,buurt_naam=m.buurtnaam,cbs_gebiedsjaar=2025 FROM cbs_unieke_match m WHERE m.batch_nr=15 AND i.index_build_id=3 AND i.scope_code='0363' AND i.pand_identificatie=m.pand_identificatie RETURNING i.pand_identificatie) SELECT 15 AS batch_nr,count(*) AS verrijkte_panden FROM bijgewerkt;

UPDATE bag_search.index_builds SET cbs_gebiedsjaar=2025,cbs_buurten_sha256='bd5cd7fdc1d1f23a7b6ae2bf36e309872c1b7ab8243d127fbc989e3b869c77e0',cbs_wijken_sha256='b76c1ffa4a606994184fcf45462cae4127d0acb43802965f987d37994a82a725',cbs_verrijkt_op=now(),cbs_verrijkte_panden=211082,cbs_ongekoppelde_panden=30 WHERE id=3 AND scope_code='0363' AND status='actief';

DO $$
BEGIN
  IF (SELECT count(*) FROM bag_search.pand_search_index WHERE index_build_id=3 AND scope_code='0363' AND cbs_gebiedsjaar=2025) <> 211082 THEN RAISE EXCEPTION 'onverwacht aantal CBS-verrijkte panden'; END IF;
  IF (SELECT count(*) FROM bag_search.pand_search_index WHERE index_build_id=3 AND scope_code='0363' AND wijk_code IS NOT NULL AND buurt_code IS NOT NULL) <> 211082 THEN RAISE EXCEPTION 'wijk/buurtdekking wijkt af'; END IF;
  IF EXISTS (SELECT 1 FROM bag_search.pand_search_index WHERE index_build_id=3 AND scope_code='0363' AND ((wijk_code IS NULL) <> (wijk_naam IS NULL) OR (buurt_code IS NULL) <> (buurt_naam IS NULL) OR (cbs_gebiedsjaar IS NULL) <> (buurt_code IS NULL))) THEN RAISE EXCEPTION 'partiële CBS-verrijking gevonden'; END IF;
  IF (SELECT count(*) FROM bag_search.pand_search_index WHERE index_build_id=3 AND scope_code='0363' AND buurt_code IS NULL) <> 30 THEN RAISE EXCEPTION 'onverwacht aantal ongekoppelde CBS-panden'; END IF;
END $$;

COMMIT;
