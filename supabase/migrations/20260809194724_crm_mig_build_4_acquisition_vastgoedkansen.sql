CREATE TABLE IF NOT EXISTS public.acquisitie_campagnes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naam text NOT NULL,
  kanaal public.campagne_kanaal NOT NULL DEFAULT 'anders',
  gebied text,
  startdatum date,
  status public.campagne_status NOT NULL DEFAULT 'concept',
  notities text,
  aangemaakt_door uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.acquisitie_campagnes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Intern leest acquisitie_campagnes" ON public.acquisitie_campagnes;
CREATE POLICY "Intern leest acquisitie_campagnes" ON public.acquisitie_campagnes FOR SELECT TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
DROP POLICY IF EXISTS "Intern voegt acquisitie_campagnes toe" ON public.acquisitie_campagnes;
CREATE POLICY "Intern voegt acquisitie_campagnes toe" ON public.acquisitie_campagnes FOR INSERT TO authenticated WITH CHECK (public.is_intern_gebruiker(auth.uid()));
DROP POLICY IF EXISTS "Intern wijzigt acquisitie_campagnes" ON public.acquisitie_campagnes;
CREATE POLICY "Intern wijzigt acquisitie_campagnes" ON public.acquisitie_campagnes FOR UPDATE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
DROP POLICY IF EXISTS "Intern verwijdert acquisitie_campagnes" ON public.acquisitie_campagnes;
CREATE POLICY "Intern verwijdert acquisitie_campagnes" ON public.acquisitie_campagnes FOR DELETE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
DO $$ BEGIN CREATE TRIGGER trg_acquisitie_campagnes_updated BEFORE UPDATE ON public.acquisitie_campagnes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.acquisitie_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adres text,
  postcode text,
  plaats text,
  wijk text,
  type_vastgoed text,
  reden_interessant text,
  bron text,
  campagne_id uuid REFERENCES public.acquisitie_campagnes(id) ON DELETE SET NULL,
  eigenaar_bekend public.eigenaar_bekend NOT NULL DEFAULT 'onbekend',
  eigenaar_woont_op_adres public.eigenaar_bekend NOT NULL DEFAULT 'onbekend',
  relatie_id uuid,
  status public.acquisitie_status NOT NULL DEFAULT 'target_gevonden',
  prioriteit smallint NOT NULL DEFAULT 3,
  laatste_actie_datum date,
  volgende_actie_datum date,
  volgende_actie_omschrijving text,
  notities text,
  object_id uuid,
  aangemaakt_door uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.acquisitie_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Intern leest acquisitie_targets" ON public.acquisitie_targets;
CREATE POLICY "Intern leest acquisitie_targets" ON public.acquisitie_targets FOR SELECT TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
DROP POLICY IF EXISTS "Intern voegt acquisitie_targets toe" ON public.acquisitie_targets;
CREATE POLICY "Intern voegt acquisitie_targets toe" ON public.acquisitie_targets FOR INSERT TO authenticated WITH CHECK (public.is_intern_gebruiker(auth.uid()));
DROP POLICY IF EXISTS "Intern wijzigt acquisitie_targets" ON public.acquisitie_targets;
CREATE POLICY "Intern wijzigt acquisitie_targets" ON public.acquisitie_targets FOR UPDATE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
DROP POLICY IF EXISTS "Intern verwijdert acquisitie_targets" ON public.acquisitie_targets;
CREATE POLICY "Intern verwijdert acquisitie_targets" ON public.acquisitie_targets FOR DELETE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
DO $$ BEGIN CREATE TRIGGER trg_acquisitie_targets_updated BEFORE UPDATE ON public.acquisitie_targets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_acquisitie_targets_campagne ON public.acquisitie_targets(campagne_id);
CREATE INDEX IF NOT EXISTS idx_acquisitie_targets_status ON public.acquisitie_targets(status);
CREATE INDEX IF NOT EXISTS idx_acquisitie_targets_relatie ON public.acquisitie_targets(relatie_id);

CREATE TABLE IF NOT EXISTS public.vastgoedkansen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kansnummer text UNIQUE,
  adres text,
  postcode text,
  plaats text,
  provincie text,
  type_vastgoed text,
  herkomst text NOT NULL DEFAULT 'handmatig' CHECK (herkomst IN ('handmatig','csv_import','bag_selectie','kaart_selectie','externe_bron')),
  herkomst_referentie text,
  selectieprofiel_id uuid,
  selectierun_id uuid,
  bag_pand_id text,
  bag_verblijfsobject_id text,
  algoritme_score integer CHECK (algoritme_score BETWEEN 0 AND 100),
  score_uitleg text,
  status text NOT NULL DEFAULT 'te_beoordelen' CHECK (status IN ('te_beoordelen','onderzoek','brief_voorbereiden','opvolgen','wachten','positieve_reactie','afgevallen','gepromoveerd')),
  prioriteit integer NOT NULL DEFAULT 3 CHECK (prioriteit BETWEEN 1 AND 5),
  eigenaar_status text NOT NULL DEFAULT 'niet_gestart' CHECK (eigenaar_status IN ('niet_gestart','bezig','bekend','niet_gevonden')),
  brief_status text NOT NULL DEFAULT 'niet_gestart' CHECK (brief_status IN ('niet_gestart','voorbereiden','klaar','verzonden','reactie_ontvangen')),
  volgende_actie_datum date,
  volgende_actie_omschrijving text,
  reden_interessant text,
  notities text,
  object_id uuid REFERENCES public.objecten(id) ON DELETE SET NULL,
  aangemaakt_door uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  korte_omschrijving text,
  eigenaar_naam text,
  eigenaar_bron text,
  eigenaar_laatst_gecontroleerd_op date,
  kadaster_status text NOT NULL DEFAULT 'niet_gestart',
  kadastrale_aanduiding text,
  kadaster_laatst_gecontroleerd_op date,
  onderzoeksnotities text,
  brief_geadresseerde text,
  brief_verzendwijze text,
  brief_verzonden_op date,
  brief_kenmerk text,
  opvolgdatum date,
  opvolgactie text,
  reactie_status text NOT NULL DEFAULT 'geen_reactie',
  reactie_ontvangen_op date,
  reactie_kanaal text,
  reactie_samenvatting text,
  reactie_uitkomst text,
  eigenaar_relatie_id uuid REFERENCES public.relaties(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  CONSTRAINT vastgoedkansen_kadaster_status_check CHECK (kadaster_status IN ('niet_gestart','handmatig_onderzoek','gegevens_bekend','niet_gevonden')),
  CONSTRAINT vastgoedkansen_reactie_status_check CHECK (reactie_status IN ('geen_reactie','reactie_ontvangen','interesse','geen_interesse','later_contact','onbereikbaar'))
);
CREATE SEQUENCE IF NOT EXISTS public.vastgoedkans_nummer_seq START 1;
CREATE OR REPLACE FUNCTION public.vastgoedkans_nummer_toekennen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kansnummer IS NULL THEN NEW.kansnummer := 'VK-' || lpad(nextval('public.vastgoedkans_nummer_seq')::text,6,'0'); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_vastgoedkans_nummer ON public.vastgoedkansen;
CREATE TRIGGER trg_vastgoedkans_nummer BEFORE INSERT OR UPDATE ON public.vastgoedkansen FOR EACH ROW EXECUTE FUNCTION public.vastgoedkans_nummer_toekennen();
ALTER TABLE public.vastgoedkansen ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vastgoedkansen_authenticated_all" ON public.vastgoedkansen;
DROP POLICY IF EXISTS "vastgoedkansen_intern_all" ON public.vastgoedkansen;
CREATE POLICY "vastgoedkansen_intern_all" ON public.vastgoedkansen FOR ALL TO authenticated USING (public.is_intern_gebruiker(auth.uid())) WITH CHECK (public.is_intern_gebruiker(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_vastgoedkansen_status ON public.vastgoedkansen(status);
CREATE INDEX IF NOT EXISTS idx_vastgoedkansen_adres ON public.vastgoedkansen(postcode,plaats,adres);
CREATE INDEX IF NOT EXISTS vastgoedkansen_eigenaar_relatie_id_idx ON public.vastgoedkansen(eigenaar_relatie_id) WHERE eigenaar_relatie_id IS NOT NULL;