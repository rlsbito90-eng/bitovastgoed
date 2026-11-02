-- A15.12 releasereadiness — ALLEEN SELECT, GEEN DDL/DML.
-- Herhaal direct voor een eventuele release. Een groen resultaat is GEEN vrijgave.
-- Bron: public.relaties, public.objecten, public.object_pipeline.
-- Onjuist ontbrekend object is niet automatisch gearchiveerd.
WITH
 constraint_check AS (
  SELECT pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
  WHERE conrelid='public.relaties'::regclass
    AND conname='relaties_partijprofiel_a13_allowed'
 ),
 relaties_check AS (
  SELECT count(*) FILTER (WHERE soft_deleted_at IS NULL) AS actieve_relaties,
    count(*) FILTER (WHERE soft_deleted_at IS NULL AND partijprofiel IS NULL) AS zonder_partijprofiel,
    count(*) FILTER (WHERE soft_deleted_at IS NULL AND partijprofiel IS NOT NULL) AS met_partijprofiel
  FROM public.relaties
 ),
 pipeline_check AS (
  SELECT count(*) FILTER(WHERE p.soft_deleted_at IS NULL
       AND p.pipeline_fase NOT IN ('afgevallen','afgerond')) AS lopende_kandidaten,
    count(*) FILTER(WHERE p.soft_deleted_at IS NULL
       AND p.pipeline_fase NOT IN ('afgevallen','afgerond')
       AND o.soft_deleted_at IS NOT NULL) AS kandidaten_object_gearchiveerd,
    count(*) FILTER(WHERE p.soft_deleted_at IS NULL
       AND p.pipeline_fase NOT IN ('afgevallen','afgerond')
       AND o.id IS NULL) AS kandidaten_object_ontbreekt,
    count(*) FILTER(WHERE p.soft_deleted_at IS NULL
       AND p.pipeline_fase NOT IN ('afgevallen','afgerond')
       AND (r.id IS NULL OR r.soft_deleted_at IS NOT NULL)) AS kandidaten_relatie_ontbreekt_of_gearchiveerd
  FROM public.object_pipeline p
  LEFT JOIN public.objecten o ON o.id=p.object_id
  LEFT JOIN public.relaties r ON r.id=p.relatie_id
 )
SELECT current_timestamp AS controledatum,
  c.definition IS NOT NULL AS profielconstraint_bestaand,
  c.definition LIKE '%family_office%' AND c.definition LIKE '%fonds%'
    AND c.definition LIKE '%buitenlandse_belegger%' AS a14_extra_profielen_toegestaan,
  (SELECT count(*)>0 FROM supabase_migrations.schema_migrations
   WHERE version='20261102213507') AS a14_migratiegeregistreerd,
  (SELECT cls.relrowsecurity FROM pg_class cls
   WHERE cls.oid='public.relaties'::regclass) AS relaties_rls_actief,
  rc.*,pc.*
FROM relaties_check rc CROSS JOIN pipeline_check pc
LEFT JOIN constraint_check c ON true;
