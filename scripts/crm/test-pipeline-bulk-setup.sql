-- Alleen de wegwerp-database van de CRM GitHub Actions job.
-- Bestaande auth-stubs en public.objecten uit test-objectadressen-postgres.sql.
DO $types$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='pipeline_fase' AND typnamespace='public'::regnamespace) THEN
    CREATE TYPE public.pipeline_fase AS ENUM (
      'match_gevonden','teaser_verstuurd','interesse_ontvangen','nda_verstuurd',
      'nda_getekend','informatie_gedeeld','bezichtiging_gepland',
      'bezichtiging_geweest','indicatieve_bieding','onderhandeling',
      'loi_ontvangen','due_diligence','koopovereenkomst_concept',
      'koopovereenkomst_getekend','transport_closing','afgerond','afgevallen');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='interesse_niveau' AND typnamespace='public'::regnamespace) THEN
    CREATE TYPE public.interesse_niveau AS ENUM ('koud','lauw','warm','zeer_warm');
  END IF;
END $types$;

CREATE TABLE IF NOT EXISTS public.object_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id uuid NOT NULL REFERENCES public.objecten(id),
  relatie_id uuid NOT NULL,
  pipeline_fase public.pipeline_fase NOT NULL DEFAULT 'match_gevonden',
  interesse_niveau public.interesse_niveau NOT NULL DEFAULT 'lauw',
  reden_afgevallen text,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  soft_deleted_at timestamptz
);
ALTER TABLE public.object_pipeline ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.object_pipeline FROM PUBLIC,anon,authenticated;
GRANT SELECT, UPDATE ON public.object_pipeline TO authenticated;
CREATE POLICY crm_bulk_pipeline_select ON public.object_pipeline
  FOR SELECT TO authenticated USING (public.is_intern_gebruiker((SELECT auth.uid())));
CREATE POLICY crm_bulk_pipeline_update ON public.object_pipeline
  FOR UPDATE TO authenticated
  USING (public.is_intern_gebruiker((SELECT auth.uid())))
  WITH CHECK (public.is_intern_gebruiker((SELECT auth.uid())));

-- Alleen om te bewijzen dat bulkbewerkingen géén inkomende reacties vastleggen.
CREATE TABLE public.crm_bulk_test_contact_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kandidaat_id uuid NOT NULL,
  richting text NOT NULL
);
