-- Pandenverkenner 2.0 — BUILD 1A.5 Amsterdam v3
-- Doelproject uitsluitend: BAG shadow xfygspvpeugxowxbcvnm
-- Bouwt een NIET-ACTIEVE indexbuild voor datasetversie 3 / scope 0363.
-- Wijzigt bag_control en bag_published niet.

WITH nieuw AS (
  INSERT INTO bag_search.index_builds (
    datasetversie_id, scope_code, index_versie, status, verwacht_panden
  )
  VALUES (3, '0363', 'pv2-amsterdam-v3-1', 'opbouw', 211112)
  RETURNING id
),
pand_ranked AS MATERIALIZED (
  SELECT
    v.*,
    row_number() OVER (
      PARTITION BY v.identificatie
      ORDER BY
        v.begin_geldigheid DESC NULLS LAST,
        coalesce(v.velden ->> 'tijdstipRegistratie', '') DESC,
        v.voorkomen_sleutel DESC
    ) AS rn
  FROM bag_published.voorkomens v
  WHERE v.datasetversie_id = 3
    AND v.objecttype = 'Pand'
    AND v.is_actueel
),
panden AS MATERIALIZED (
  SELECT * FROM pand_ranked WHERE rn = 1
),
vbo_ranked AS MATERIALIZED (
  SELECT
    v.*,
    row_number() OVER (
      PARTITION BY v.identificatie
      ORDER BY
        v.begin_geldigheid DESC NULLS LAST,
        coalesce(v.velden ->> 'tijdstipRegistratie', '') DESC,
        v.voorkomen_sleutel DESC
    ) AS rn
  FROM bag_published.voorkomens v
  WHERE v.datasetversie_id = 3
    AND v.objecttype = 'Verblijfsobject'
    AND v.is_actueel
),
vbos AS MATERIALIZED (
  SELECT * FROM vbo_ranked WHERE rn = 1
),
nummer_ranked AS MATERIALIZED (
  SELECT
    v.*,
    row_number() OVER (
      PARTITION BY v.identificatie
      ORDER BY
        v.begin_geldigheid DESC NULLS LAST,
        coalesce(v.velden ->> 'tijdstipRegistratie', '') DESC,
        v.voorkomen_sleutel DESC
    ) AS rn
  FROM bag_published.voorkomens v
  WHERE v.datasetversie_id = 3
    AND v.objecttype = 'Nummeraanduiding'
    AND v.is_actueel
),
nummers AS MATERIALIZED (
  SELECT * FROM nummer_ranked WHERE rn = 1
),
opr_ranked AS MATERIALIZED (
  SELECT
    v.*,
    row_number() OVER (
      PARTITION BY v.identificatie
      ORDER BY
        v.begin_geldigheid DESC NULLS LAST,
        coalesce(v.velden ->> 'tijdstipRegistratie', '') DESC,
        v.voorkomen_sleutel DESC
    ) AS rn
  FROM bag_published.voorkomens v
  WHERE v.datasetversie_id = 3
    AND v.objecttype = 'OpenbareRuimte'
    AND v.is_actueel
),
openbare_ruimtes AS MATERIALIZED (
  SELECT * FROM opr_ranked WHERE rn = 1
),
woonplaats_ranked AS MATERIALIZED (
  SELECT
    v.*,
    row_number() OVER (
      PARTITION BY v.identificatie
      ORDER BY
        v.begin_geldigheid DESC NULLS LAST,
        coalesce(v.velden ->> 'tijdstipRegistratie', '') DESC,
        v.voorkomen_sleutel DESC
    ) AS rn
  FROM bag_published.voorkomens v
  WHERE v.datasetversie_id = 3
    AND v.objecttype = 'Woonplaats'
    AND v.is_actueel
),
woonplaatsen AS MATERIALIZED (
  SELECT * FROM woonplaats_ranked WHERE rn = 1
),
vbo_pand AS MATERIALIZED (
  SELECT DISTINCT
    r.bron_identificatie AS vbo_id,
    r.doel_identificatie AS pand_id
  FROM bag_published.relaties r
  JOIN vbos v ON v.identificatie = r.bron_identificatie
  WHERE r.datasetversie_id = 3
    AND r.bron_objecttype = 'Verblijfsobject'
    AND r.relatietype = 'pandIds'
),
vbo_agg AS MATERIALIZED (
  SELECT
    vp.pand_id,
    count(DISTINCT vp.vbo_id)::integer AS vbo_aantal,
    sum((v.velden ->> 'oppervlakte')::numeric) AS vbo_oppervlakte_som,
    max((v.velden ->> 'oppervlakte')::numeric) AS vbo_oppervlakte_max
  FROM vbo_pand vp
  JOIN vbos v ON v.identificatie = vp.vbo_id
  GROUP BY vp.pand_id
),
gebruiksdoel_agg AS MATERIALIZED (
  SELECT
    vp.pand_id,
    array_agg(DISTINCT doel ORDER BY doel) AS gebruiksdoelen
  FROM vbo_pand vp
  JOIN vbos v ON v.identificatie = vp.vbo_id
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(v.velden -> 'gebruiksdoelen') = 'array'
      THEN v.velden -> 'gebruiksdoelen'
      ELSE '[]'::jsonb END
  ) AS doelen(doel)
  GROUP BY vp.pand_id
),
adres_basis AS MATERIALIZED (
  SELECT DISTINCT
    vp.pand_id,
    na.identificatie AS nummer_id,
    opr.velden ->> 'naam' AS straat,
    na.velden ->> 'huisnummer' AS huisnummer,
    na.velden ->> 'huisletter' AS huisletter,
    na.velden ->> 'huisnummertoevoeging' AS huisnummertoevoeging,
    na.velden ->> 'postcode' AS postcode,
    wp.velden ->> 'naam' AS plaats
  FROM vbo_pand vp
  JOIN bag_published.relaties h
    ON h.datasetversie_id = 3
   AND h.bron_objecttype = 'Verblijfsobject'
   AND h.bron_identificatie = vp.vbo_id
   AND h.relatietype = 'hoofdadresIds'
  JOIN nummers na ON na.identificatie = h.doel_identificatie
  LEFT JOIN bag_published.relaties ro
    ON ro.datasetversie_id = 3
   AND ro.bron_objecttype = 'Nummeraanduiding'
   AND ro.bron_identificatie = na.identificatie
   AND ro.relatietype = 'openbareRuimteIds'
  LEFT JOIN openbare_ruimtes opr ON opr.identificatie = ro.doel_identificatie
  LEFT JOIN bag_published.relaties rw
    ON rw.datasetversie_id = 3
   AND rw.bron_objecttype = 'OpenbareRuimte'
   AND rw.bron_identificatie = opr.identificatie
   AND rw.relatietype = 'woonplaatsIds'
  LEFT JOIN woonplaatsen wp ON wp.identificatie = rw.doel_identificatie
),
adres_ranked AS MATERIALIZED (
  SELECT
    a.*,
    count(*) OVER (PARTITION BY a.pand_id)::integer AS adres_count,
    row_number() OVER (
      PARTITION BY a.pand_id
      ORDER BY
        lower(coalesce(a.straat, '')),
        CASE WHEN a.huisnummer ~ '^[0-9]+$' THEN a.huisnummer::integer ELSE 2147483647 END,
        coalesce(a.huisletter, ''),
        coalesce(a.huisnummertoevoeging, ''),
        coalesce(a.postcode, ''),
        a.nummer_id
    ) AS rn
  FROM adres_basis a
),
primair_adres AS MATERIALIZED (
  SELECT * FROM adres_ranked WHERE rn = 1
),
pand_geometrie AS MATERIALIZED (
  SELECT DISTINCT ON (g.identificatie)
    g.identificatie,
    g.geometrie
  FROM bag_published.geometrieen g
  JOIN panden p
    ON p.identificatie = g.identificatie
   AND p.voorkomen_sleutel = g.voorkomen_sleutel
  WHERE g.datasetversie_id = 3
    AND g.objecttype = 'Pand'
  ORDER BY g.identificatie, g.geometrie_volgnummer
)
INSERT INTO bag_search.pand_search_index (
  index_build_id, datasetversie_id, scope_code, pand_identificatie,
  voorkomen_sleutel, index_versie, pandstatus_huidig, oorspronkelijk_bouwjaar,
  pand_geometrie, centroid,
  heeft_vbo, vbo_aantal, vbo_oppervlakte_som, vbo_oppervlakte_max,
  gebruiksdoelen, is_gemengd,
  primair_adres, primair_straat, primair_huisnummer, primair_postcode,
  primair_plaats, adres_count,
  gemeente_code, gemeente_naam
)
SELECT
  nieuw.id,
  3,
  '0363',
  p.identificatie,
  p.voorkomen_sleutel,
  'pv2-amsterdam-v3-1',
  p.status,
  CASE
    WHEN (p.velden ->> 'oorspronkelijkBouwjaar') ~ '^[0-9]+$'
      AND (p.velden ->> 'oorspronkelijkBouwjaar')::integer BETWEEN 1000 AND 3000
    THEN (p.velden ->> 'oorspronkelijkBouwjaar')::integer
    ELSE NULL
  END,
  pg.geometrie,
  ST_Centroid(ST_Force2D(pg.geometrie)),
  (va.vbo_aantal IS NOT NULL),
  coalesce(va.vbo_aantal, 0),
  va.vbo_oppervlakte_som,
  va.vbo_oppervlakte_max,
  coalesce(ga.gebruiksdoelen, ARRAY[]::text[]),
  cardinality(coalesce(ga.gebruiksdoelen, ARRAY[]::text[])) > 1,
  CASE WHEN pa.nummer_id IS NULL THEN NULL ELSE concat_ws(
    ' ', pa.straat,
    concat(
      pa.huisnummer,
      coalesce(pa.huisletter, ''),
      CASE WHEN pa.huisnummertoevoeging IS NULL OR pa.huisnummertoevoeging = ''
        THEN '' ELSE '-' || pa.huisnummertoevoeging END
    )
  ) END,
  pa.straat,
  pa.huisnummer,
  pa.postcode,
  pa.plaats,
  coalesce(pa.adres_count, 0),
  'GM0363',
  'Amsterdam'
FROM panden p
CROSS JOIN nieuw
LEFT JOIN vbo_agg va ON va.pand_id = p.identificatie
LEFT JOIN gebruiksdoel_agg ga ON ga.pand_id = p.identificatie
LEFT JOIN primair_adres pa ON pa.pand_id = p.identificatie
JOIN pand_geometrie pg ON pg.identificatie = p.identificatie;

UPDATE bag_search.index_builds b
SET gebouwd_panden = x.aantal,
    gebouwd_zonder_vbo = x.zonder_vbo
FROM (
  SELECT
    index_build_id,
    count(*)::integer AS aantal,
    count(*) FILTER (WHERE NOT heeft_vbo)::integer AS zonder_vbo
  FROM bag_search.pand_search_index
  WHERE datasetversie_id = 3
    AND scope_code = '0363'
    AND index_versie = 'pv2-amsterdam-v3-1'
  GROUP BY index_build_id
) x
WHERE b.id = x.index_build_id;
