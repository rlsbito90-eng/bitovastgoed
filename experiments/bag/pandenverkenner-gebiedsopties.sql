-- BUILD 1D.4 kandidaat — read-only gebiedsopties van de actieve index.
CREATE OR REPLACE FUNCTION bag_service.cbs_gebiedsopties(p_scope_code text)
RETURNS TABLE(
  cbs_gebiedsjaar integer,
  wijk_code text,
  wijk_naam text,
  buurt_code text,
  buurt_naam text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'bag_control', 'bag_search'
AS $function$
  WITH actieve AS MATERIALIZED (
    SELECT b.id AS build_id, b.datasetversie_id, b.cbs_gebiedsjaar
    FROM bag_search.index_builds b
    JOIN bag_control.datasetversies d
      ON d.id=b.datasetversie_id AND d.scope_code=b.scope_code AND d.status='actief' AND d.is_actief
    WHERE b.scope_code=p_scope_code
      AND b.status='actief'
      AND b.validatie_fouten=0
      AND b.gebouwd_panden=b.verwacht_panden
      AND b.cbs_gebiedsjaar IS NOT NULL
  )
  SELECT DISTINCT
    a.cbs_gebiedsjaar,
    i.wijk_code,
    i.wijk_naam,
    i.buurt_code,
    i.buurt_naam
  FROM bag_search.pand_search_index i
  JOIN actieve a ON a.build_id=i.index_build_id AND a.datasetversie_id=i.datasetversie_id
  WHERE i.scope_code=p_scope_code
    AND i.wijk_code IS NOT NULL
    AND i.wijk_naam IS NOT NULL
    AND i.buurt_code IS NOT NULL
    AND i.buurt_naam IS NOT NULL
  ORDER BY i.wijk_naam, i.buurt_naam, i.buurt_code;
$function$;
