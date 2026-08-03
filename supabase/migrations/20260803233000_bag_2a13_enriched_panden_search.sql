-- BAG BUILD 2A.13 — relationeel verrijkte, private Pandenverkennerzoeklaag.

CREATE OR REPLACE FUNCTION bag_service.zoek_panden(
  p_scope_code text,
  p_na_identificatie text DEFAULT NULL,
  p_limiet integer DEFAULT 100
)
RETURNS TABLE (
  datasetversie_id bigint,
  identificatie text,
  voorkomen_sleutel text,
  status text,
  velden jsonb,
  volgende_cursor text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, bag_control, bag_published
SET jit = off
AS $function$
BEGIN
  IF p_scope_code IS NULL OR NOT (p_scope_code ~ '^[A-Za-z0-9_-]{1,64}$') THEN
    RAISE EXCEPTION 'Ongeldige BAG-scopecode';
  END IF;
  IF p_limiet < 1 OR p_limiet > 250 THEN
    RAISE EXCEPTION 'Zoeklimiet moet tussen 1 en 250 liggen';
  END IF;

  RETURN QUERY
  WITH actieve_dataset AS MATERIALIZED (
    SELECT d.id
    FROM bag_control.datasetversies AS d
    WHERE d.scope_code = p_scope_code
      AND d.status = 'actief'
      AND d.is_actief
  ),
  pagina AS MATERIALIZED (
    SELECT
      o.datasetversie_id,
      o.identificatie,
      v.voorkomen_sleutel,
      v.status,
      v.velden
    FROM bag_published.objecten AS o
    JOIN actieve_dataset AS d ON d.id = o.datasetversie_id
    JOIN bag_published.voorkomens AS v
      ON v.datasetversie_id = o.datasetversie_id
     AND v.objecttype = o.objecttype
     AND v.identificatie = o.identificatie
     AND v.is_actueel
    WHERE o.objecttype = 'Pand'
      AND (p_na_identificatie IS NULL OR o.identificatie > p_na_identificatie)
    ORDER BY o.identificatie
    LIMIT p_limiet
  ),
  vbo_basis AS MATERIALIZED (
    SELECT
      p.datasetversie_id,
      p.identificatie AS pand_identificatie,
      vbo.identificatie AS vbo_identificatie,
      vbo.velden AS vbo_velden,
      na.velden AS nummer_velden,
      opr.velden ->> 'naam' AS straat,
      wp.velden ->> 'naam' AS woonplaats
    FROM pagina AS p
    JOIN bag_published.relaties AS pand_rel
      ON pand_rel.datasetversie_id = p.datasetversie_id
     AND pand_rel.bron_objecttype = 'Verblijfsobject'
     AND pand_rel.relatietype = 'pandIds'
     AND pand_rel.doel_identificatie = p.identificatie
    JOIN bag_published.voorkomens AS vbo
      ON vbo.datasetversie_id = pand_rel.datasetversie_id
     AND vbo.objecttype = 'Verblijfsobject'
     AND vbo.identificatie = pand_rel.bron_identificatie
     AND vbo.is_actueel
    LEFT JOIN LATERAL (
      SELECT adres_rel.doel_identificatie
      FROM bag_published.relaties AS adres_rel
      WHERE adres_rel.datasetversie_id = vbo.datasetversie_id
        AND adres_rel.bron_objecttype = 'Verblijfsobject'
        AND adres_rel.bron_identificatie = vbo.identificatie
        AND adres_rel.relatietype IN ('hoofdadresIds', 'nummeraanduidingIds')
      ORDER BY (adres_rel.relatietype = 'hoofdadresIds') DESC,
        adres_rel.doel_identificatie
      LIMIT 1
    ) AS hoofdadres ON true
    LEFT JOIN bag_published.voorkomens AS na
      ON na.datasetversie_id = vbo.datasetversie_id
     AND na.objecttype = 'Nummeraanduiding'
     AND na.identificatie = hoofdadres.doel_identificatie
     AND na.is_actueel
    LEFT JOIN LATERAL (
      SELECT ruimte_rel.doel_identificatie
      FROM bag_published.relaties AS ruimte_rel
      WHERE ruimte_rel.datasetversie_id = na.datasetversie_id
        AND ruimte_rel.bron_objecttype = 'Nummeraanduiding'
        AND ruimte_rel.bron_identificatie = na.identificatie
        AND ruimte_rel.relatietype = 'openbareRuimteIds'
      ORDER BY ruimte_rel.doel_identificatie
      LIMIT 1
    ) AS ruimte ON true
    LEFT JOIN bag_published.voorkomens AS opr
      ON opr.datasetversie_id = na.datasetversie_id
     AND opr.objecttype = 'OpenbareRuimte'
     AND opr.identificatie = ruimte.doel_identificatie
     AND opr.is_actueel
    LEFT JOIN LATERAL (
      SELECT woonplaats_rel.doel_identificatie
      FROM bag_published.relaties AS woonplaats_rel
      WHERE woonplaats_rel.datasetversie_id = opr.datasetversie_id
        AND woonplaats_rel.bron_objecttype = 'OpenbareRuimte'
        AND woonplaats_rel.bron_identificatie = opr.identificatie
        AND woonplaats_rel.relatietype = 'woonplaatsIds'
      ORDER BY woonplaats_rel.doel_identificatie
      LIMIT 1
    ) AS plaats_rel ON true
    LEFT JOIN bag_published.voorkomens AS wp
      ON wp.datasetversie_id = opr.datasetversie_id
     AND wp.objecttype = 'Woonplaats'
     AND wp.identificatie = plaats_rel.doel_identificatie
     AND wp.is_actueel
  ),
  vbo_aggregaat AS (
    SELECT
      b.datasetversie_id,
      b.pand_identificatie,
      count(*)::integer AS aantal_verblijfsobjecten,
      sum(CASE
        WHEN jsonb_typeof(b.vbo_velden -> 'oppervlakte') = 'number'
          THEN (b.vbo_velden ->> 'oppervlakte')::numeric
        ELSE 0
      END) AS oppervlakte
    FROM vbo_basis AS b
    GROUP BY b.datasetversie_id, b.pand_identificatie
  ),
  doelen_aggregaat AS (
    SELECT
      b.datasetversie_id,
      b.pand_identificatie,
      jsonb_agg(DISTINCT doel.gebruiksdoel ORDER BY doel.gebruiksdoel)
        AS gebruiksdoelen
    FROM vbo_basis AS b
    CROSS JOIN LATERAL jsonb_array_elements_text(CASE
      WHEN jsonb_typeof(b.vbo_velden -> 'gebruiksdoelen') = 'array'
        THEN b.vbo_velden -> 'gebruiksdoelen'
      ELSE '[]'::jsonb
    END) AS doel(gebruiksdoel)
    GROUP BY b.datasetversie_id, b.pand_identificatie
  ),
  hoofdadres_per_pand AS (
    SELECT DISTINCT ON (b.datasetversie_id, b.pand_identificatie)
      b.datasetversie_id,
      b.pand_identificatie,
      b.straat,
      b.nummer_velden -> 'huisnummer' AS huisnummer,
      b.nummer_velden ->> 'huisletter' AS huisletter,
      b.nummer_velden ->> 'huisnummertoevoeging' AS huisnummertoevoeging,
      b.nummer_velden ->> 'postcode' AS postcode,
      b.woonplaats
    FROM vbo_basis AS b
    WHERE b.straat IS NOT NULL
      AND b.nummer_velden -> 'huisnummer' IS NOT NULL
    ORDER BY b.datasetversie_id, b.pand_identificatie, b.vbo_identificatie
  )
  SELECT
    p.datasetversie_id,
    p.identificatie,
    p.voorkomen_sleutel,
    p.status,
    p.velden || jsonb_strip_nulls(jsonb_build_object(
      'straat', h.straat,
      'huisnummer', h.huisnummer,
      'huisletter', h.huisletter,
      'huisnummertoevoeging', h.huisnummertoevoeging,
      'postcode', h.postcode,
      'woonplaats', h.woonplaats,
      'adres', CASE WHEN h.straat IS NULL THEN NULL ELSE concat_ws(
        ' ', h.straat,
        concat(
          h.huisnummer #>> '{}',
          coalesce(h.huisletter, ''),
          CASE WHEN h.huisnummertoevoeging IS NULL THEN ''
            ELSE '-' || h.huisnummertoevoeging END
        )
      ) END,
      'gebruiksdoelen', coalesce(g.gebruiksdoelen, '[]'::jsonb),
      'oppervlakte', a.oppervlakte,
      'aantalVerblijfsobjecten', coalesce(a.aantal_verblijfsobjecten, 0)
    )),
    p.identificatie AS volgende_cursor
  FROM pagina AS p
  LEFT JOIN vbo_aggregaat AS a
    ON a.datasetversie_id = p.datasetversie_id
   AND a.pand_identificatie = p.identificatie
  LEFT JOIN doelen_aggregaat AS g
    ON g.datasetversie_id = p.datasetversie_id
   AND g.pand_identificatie = p.identificatie
  LEFT JOIN hoofdadres_per_pand AS h
    ON h.datasetversie_id = p.datasetversie_id
   AND h.pand_identificatie = p.identificatie
  ORDER BY p.identificatie;
END
$function$;

ALTER FUNCTION bag_service.zoek_panden(text, text, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION bag_service.zoek_panden(text, text, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION bag_service.zoek_panden(text, text, integer)
  TO bag_reader;

COMMENT ON FUNCTION bag_service.zoek_panden(text, text, integer) IS
  'Private Pandenverkennerquery met relationeel afgeleid hoofdadres, VBO-aantal, gebruiksdoelen en totale oppervlakte.';
