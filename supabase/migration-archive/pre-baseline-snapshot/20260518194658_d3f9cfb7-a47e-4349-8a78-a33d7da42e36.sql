-- Enums
DO $$ BEGIN
  CREATE TYPE public.contact_moment_type AS ENUM (
    'telefoon','email','whatsapp','linkedin','afspraak','bezichtiging','notitie',
    'document_gedeeld','teaser_verstuurd','nda_verstuurd','nda_ontvangen','informatie_gedeeld',
    'bod_ontvangen','bod_uitgebracht','status_gewijzigd','taak_aangemaakt','taak_afgerond',
    'kandidaat_toegevoegd','archief','algemeen'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.contact_moment_direction AS ENUM ('inkomend','uitgaand','intern','n_v_t');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.contact_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  moment_date date NOT NULL DEFAULT CURRENT_DATE,
  moment_time time without time zone,
  type public.contact_moment_type NOT NULL DEFAULT 'algemeen',
  direction public.contact_moment_direction NOT NULL DEFAULT 'n_v_t',
  title text NOT NULL,
  description text,
  outcome text,
  follow_up_required boolean NOT NULL DEFAULT false,
  follow_up_date date,
  relatie_id uuid,
  object_id uuid,
  deal_id uuid,
  acquisitie_target_id uuid,
  taak_id uuid,
  is_system boolean NOT NULL DEFAULT false,
  system_key text,
  aangemaakt_door uuid
);

CREATE INDEX IF NOT EXISTS idx_contact_moments_relatie    ON public.contact_moments(relatie_id) WHERE relatie_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contact_moments_object     ON public.contact_moments(object_id) WHERE object_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contact_moments_deal       ON public.contact_moments(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contact_moments_acq        ON public.contact_moments(acquisitie_target_id) WHERE acquisitie_target_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contact_moments_taak       ON public.contact_moments(taak_id) WHERE taak_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contact_moments_date_desc  ON public.contact_moments(moment_date DESC, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_moments_system_key ON public.contact_moments(system_key) WHERE system_key IS NOT NULL;

ALTER TABLE public.contact_moments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Intern leest contact_moments"      ON public.contact_moments;
DROP POLICY IF EXISTS "Intern voegt contact_moments toe"  ON public.contact_moments;
DROP POLICY IF EXISTS "Intern wijzigt contact_moments"    ON public.contact_moments;
DROP POLICY IF EXISTS "Intern verwijdert contact_moments" ON public.contact_moments;

CREATE POLICY "Intern leest contact_moments"
  ON public.contact_moments FOR SELECT TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Intern voegt contact_moments toe"
  ON public.contact_moments FOR INSERT TO authenticated
  WITH CHECK (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Intern wijzigt contact_moments"
  ON public.contact_moments FOR UPDATE TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Intern verwijdert contact_moments"
  ON public.contact_moments FOR DELETE TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

DROP TRIGGER IF EXISTS trg_contact_moments_updated_at ON public.contact_moments;
CREATE TRIGGER trg_contact_moments_updated_at
  BEFORE UPDATE ON public.contact_moments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
