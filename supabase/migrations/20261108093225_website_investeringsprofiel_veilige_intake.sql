-- Verwerkt als live Supabase-migratie op 2026-11-08 09:32:25 UTC (exact remote version).
-- Intake-buffertabel: nieuwe inzendingen wijzigen Relaties NOOIT rechtstreeks.
CREATE TABLE IF NOT EXISTS public.website_investor_intakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'cf7_investor_profile' CHECK(source='cf7_investor_profile'),
  source_event_id uuid NOT NULL,
  form_id text,
  form_title text NOT NULL,
  applicant_name text NOT NULL,
  applicant_email text NOT NULL,
  applicant_phone text,
  raw_payload jsonb NOT NULL CHECK (jsonb_typeof(raw_payload)='object'),
  status text NOT NULL DEFAULT 'ontvangen' CHECK (status IN
   ('ontvangen','nieuw_te_controleren','bestaande_relatie','dubbelzinnig','verwerkt','afgewezen')),
  suggested_relatie_id uuid REFERENCES public.relaties(id) ON DELETE SET NULL,
  processed_relatie_id uuid REFERENCES public.relaties(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT website_investor_intakes_source_event_unique UNIQUE (source,source_event_id)
);
CREATE INDEX IF NOT EXISTS website_investor_intakes_email_idx
 ON public.website_investor_intakes (lower(applicant_email));
CREATE INDEX IF NOT EXISTS website_investor_intakes_status_created_idx
 ON public.website_investor_intakes (status,created_at DESC);
COMMENT ON TABLE public.website_investor_intakes IS
'Alleen server-tot-server websiteinzendingen. Geen directe overschrijving van Relaties; bron volledig behouden.';
CREATE TABLE IF NOT EXISTS public.website_intake_credentials (
  source text PRIMARY KEY,
  token_sha256 text NOT NULL CHECK (token_sha256 ~ '^[a-f0-9]{64}$'),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.website_intake_credentials IS
'Gehasht WordPress webhooksleutel; alleen server service_role.';
ALTER TABLE public.website_investor_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_intake_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.website_investor_intakes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.website_intake_credentials FROM PUBLIC, anon, authenticated;
GRANT SELECT,UPDATE ON public.website_investor_intakes TO authenticated;
GRANT ALL ON public.website_investor_intakes TO service_role;
GRANT ALL ON public.website_intake_credentials TO service_role;
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
  AND tablename='website_investor_intakes' AND policyname='Intern leest websiteintakes') THEN
  EXECUTE 'CREATE POLICY "Intern leest websiteintakes" ON public.website_investor_intakes FOR SELECT TO authenticated USING (is_intern_gebruiker(auth.uid()))';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
  AND tablename='website_investor_intakes' AND policyname='Intern beoordeelt websiteintakes') THEN
  EXECUTE 'CREATE POLICY "Intern beoordeelt websiteintakes" ON public.website_investor_intakes FOR UPDATE TO authenticated USING (is_intern_gebruiker(auth.uid())) WITH CHECK (is_intern_gebruiker(auth.uid()))';
 END IF;
END $$;
