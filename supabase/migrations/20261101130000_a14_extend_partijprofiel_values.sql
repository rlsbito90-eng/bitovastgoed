-- A14: drie aanvullende partijprofielen; Ontwikkelende belegger bestaat al.
-- Alleen voorstel op featurebranch. Niet uitvoeren zonder afzonderlijke productie-goedkeuring.
-- Geen tabel/rijen/backfill/rollen/zoekprofielen wijzigen; bestaande A13 CHECK uitbreiden.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '25s';

DO $preflight$
BEGIN
  IF to_regclass('public.relaties') IS NULL THEN
    RAISE EXCEPTION 'A14: public.relaties ontbreekt';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.relaties'::regclass
      AND conname = 'relaties_partijprofiel_a13_allowed'
      AND contype = 'c'
  ) THEN
    RAISE EXCEPTION 'A14: A13 profielconstraint ontbreekt; eerst onderzoeken';
  END IF;
END $preflight$;

ALTER TABLE public.relaties
  DROP CONSTRAINT relaties_partijprofiel_a13_allowed,
  ADD CONSTRAINT relaties_partijprofiel_a13_allowed
    CHECK (
      partijprofiel IS NULL OR
      partijprofiel = ANY(
        ARRAY[
          'belegger','ontwikkelende_belegger','fonds','family_office',
          'buitenlandse_belegger','ontwikkelaar','vastgoedondernemer',
          'makelaar','bemiddelaar','vastgoedeigenaar','overig'
        ]::text[]
      )
    );
COMMIT;
