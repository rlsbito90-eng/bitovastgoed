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

-- De testgebruiker mag alleen tellen of er fictieve reacties zijn aangemaakt.
GRANT SELECT ON public.crm_bulk_test_contact_moments TO authenticated;


-- Fictieve objectpipeline: dezelfde kolommen/slug-volgorde als de bestaande CRM.
-- Uitsluitend de wegwerp-database; de oorspronkelijke objecten-stub blijft intact.
CREATE TABLE public.pipelines (
  id uuid PRIMARY KEY,
  entity_type text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.pipeline_stages (
  id uuid PRIMARY KEY,
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id),
  slug text NOT NULL,
  sort_order integer NOT NULL,
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true
);
ALTER TABLE public.objecten
  ADD COLUMN pipeline_id uuid REFERENCES public.pipelines(id),
  ADD COLUMN pipeline_stage_id uuid REFERENCES public.pipeline_stages(id),
  ADD COLUMN pipeline_stage_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN pipeline_updated_at timestamptz;

INSERT INTO public.pipelines(id,entity_type,is_default) VALUES (
  'b5000000-0000-4000-8000-000000000001','object',true
);
INSERT INTO public.pipeline_stages(id,pipeline_id,slug,sort_order,is_won,is_lost)
VALUES
('b6000000-0000-4000-8000-000000000040','b5000000-0000-4000-8000-000000000001','in_verkoop',40,false,false),
('b6000000-0000-4000-8000-000000000050','b5000000-0000-4000-8000-000000000001','kandidaten_benaderd',50,false,false),
('b6000000-0000-4000-8000-000000000060','b5000000-0000-4000-8000-000000000001','nda_dataroom',60,false,false),
('b6000000-0000-4000-8000-000000000070','b5000000-0000-4000-8000-000000000001','bezichtigingen',70,false,false),
('b6000000-0000-4000-8000-000000000080','b5000000-0000-4000-8000-000000000001','biedingen_ontvangen',80,false,false),
('b6000000-0000-4000-8000-000000000090','b5000000-0000-4000-8000-000000000001','onderhandeling',90,false,false),
('b6000000-0000-4000-8000-000000000100','b5000000-0000-4000-8000-000000000001','loi',100,false,false),
('b6000000-0000-4000-8000-000000000110','b5000000-0000-4000-8000-000000000001','due_diligence',110,false,false),
('b6000000-0000-4000-8000-000000000120','b5000000-0000-4000-8000-000000000001','koopovereenkomst',120,false,false),
('b6000000-0000-4000-8000-000000000130','b5000000-0000-4000-8000-000000000001','closing',130,false,false),
('b6000000-0000-4000-8000-000000000140','b5000000-0000-4000-8000-000000000001','afgerond',140,true,false),
('b6000000-0000-4000-8000-000000000999','b5000000-0000-4000-8000-000000000001','afgevallen',999,false,true);
