
-- Enums
DO $$ BEGIN
  CREATE TYPE public.acquisitie_status AS ENUM (
    'target_gevonden','eigenaar_achterhalen','eerste_benadering','follow_up_gepland',
    'reactie_ontvangen','verkoopbereidheid_peilen','potentiele_verkooppositie',
    'object_aangemaakt','niet_interessant'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.campagne_kanaal AS ENUM ('brief','bellen','linkedin','email','netwerk','anders');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.campagne_status AS ENUM ('concept','actief','gepauzeerd','afgerond');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.eigenaar_bekend AS ENUM ('ja','nee','onbekend');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Campagnes
CREATE TABLE IF NOT EXISTS public.acquisitie_campagnes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  naam TEXT NOT NULL,
  kanaal public.campagne_kanaal NOT NULL DEFAULT 'anders',
  gebied TEXT,
  startdatum DATE,
  status public.campagne_status NOT NULL DEFAULT 'concept',
  notities TEXT,
  aangemaakt_door UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.acquisitie_campagnes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intern leest acquisitie_campagnes" ON public.acquisitie_campagnes
  FOR SELECT TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern voegt acquisitie_campagnes toe" ON public.acquisitie_campagnes
  FOR INSERT TO authenticated WITH CHECK (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern wijzigt acquisitie_campagnes" ON public.acquisitie_campagnes
  FOR UPDATE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern verwijdert acquisitie_campagnes" ON public.acquisitie_campagnes
  FOR DELETE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));

CREATE TRIGGER trg_acquisitie_campagnes_updated
  BEFORE UPDATE ON public.acquisitie_campagnes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Targets
CREATE TABLE IF NOT EXISTS public.acquisitie_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adres TEXT,
  postcode TEXT,
  plaats TEXT,
  wijk TEXT,
  type_vastgoed TEXT,
  reden_interessant TEXT,
  bron TEXT,
  campagne_id UUID REFERENCES public.acquisitie_campagnes(id) ON DELETE SET NULL,
  eigenaar_bekend public.eigenaar_bekend NOT NULL DEFAULT 'onbekend',
  eigenaar_woont_op_adres public.eigenaar_bekend NOT NULL DEFAULT 'onbekend',
  relatie_id UUID,
  status public.acquisitie_status NOT NULL DEFAULT 'target_gevonden',
  prioriteit SMALLINT NOT NULL DEFAULT 3,
  laatste_actie_datum DATE,
  volgende_actie_datum DATE,
  volgende_actie_omschrijving TEXT,
  notities TEXT,
  object_id UUID,
  aangemaakt_door UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.acquisitie_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intern leest acquisitie_targets" ON public.acquisitie_targets
  FOR SELECT TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern voegt acquisitie_targets toe" ON public.acquisitie_targets
  FOR INSERT TO authenticated WITH CHECK (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern wijzigt acquisitie_targets" ON public.acquisitie_targets
  FOR UPDATE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
CREATE POLICY "Intern verwijdert acquisitie_targets" ON public.acquisitie_targets
  FOR DELETE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));

CREATE TRIGGER trg_acquisitie_targets_updated
  BEFORE UPDATE ON public.acquisitie_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_acquisitie_targets_campagne ON public.acquisitie_targets(campagne_id);
CREATE INDEX IF NOT EXISTS idx_acquisitie_targets_status ON public.acquisitie_targets(status);
CREATE INDEX IF NOT EXISTS idx_acquisitie_targets_relatie ON public.acquisitie_targets(relatie_id);

-- Koppeling vanuit objecten naar acquisitie target (nullable, additief)
ALTER TABLE public.objecten ADD COLUMN IF NOT EXISTS acquisitie_target_id UUID;
