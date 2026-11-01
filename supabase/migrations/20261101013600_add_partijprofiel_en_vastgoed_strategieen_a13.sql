-- A13: onafhankelijk partijprofiel + vastgoedstrategieën voor public.relaties.
-- Op productie toegepast op 2026-11-01, versie 20261101013600.
-- Voorwaarden voor uitvoering: geverifieerde Vercel/Supabase-projectidentiteit,
-- actuele herstelbare back-up en afzonderlijke schriftelijke productie-goedkeuring.
-- Additief: geen herclassificatie, geen backfill, geen mutatie van zoekprofielen of rollen.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '25s';
DO $preflight$
BEGIN
  IF to_regclass('public.relaties') IS NULL THEN
    RAISE EXCEPTION 'A13 preflight: public.relaties ontbreekt';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'relaties' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'A13 preflight: RLS is niet ingeschakeld voor public.relaties';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'relaties'
      AND column_name IN ('partijprofiel', 'vastgoed_strategieen')
  ) THEN
    RAISE EXCEPTION 'A13 preflight: één of beide kolommen bestaan al, eerst reconciliëren';
  END IF;
END $preflight$;

ALTER TABLE public.relaties
  ADD COLUMN partijprofiel text NULL,
  ADD COLUMN vastgoed_strategieen text[] NULL;

ALTER TABLE public.relaties
  ADD CONSTRAINT relaties_partijprofiel_a13_allowed
    CHECK (
      partijprofiel IS NULL OR
      partijprofiel = ANY (
        ARRAY['belegger','ontwikkelende_belegger','ontwikkelaar',
          'vastgoedondernemer','makelaar','bemiddelaar','vastgoedeigenaar','overig']::text[]
      )
    ),
  ADD CONSTRAINT relaties_vastgoed_strategieen_a13_allowed
    CHECK (
      vastgoed_strategieen IS NULL OR (
        vastgoed_strategieen <@ ARRAY[
          'langetermijnbelegging','value_add','transformatie',
          'uitponden','projectontwikkeling','handel'
        ]::text[]
        AND array_position(vastgoed_strategieen, NULL) IS NULL
      )
    );
COMMIT;
