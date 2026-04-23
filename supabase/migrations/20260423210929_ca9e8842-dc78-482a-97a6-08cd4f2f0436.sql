-- Tabel referentie_objecten
CREATE TABLE public.referentie_objecten (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adres TEXT NOT NULL,
  postcode TEXT NOT NULL,
  plaats TEXT NOT NULL,
  asset_class public.asset_class NOT NULL,
  m2 INTEGER NOT NULL CHECK (m2 > 0),
  vraagprijs BIGINT NOT NULL CHECK (vraagprijs >= 0),
  prijs_per_m2 NUMERIC GENERATED ALWAYS AS (
    CASE WHEN m2 > 0 THEN (vraagprijs::NUMERIC / m2::NUMERIC) ELSE NULL END
  ) STORED,
  bouwjaar INTEGER NOT NULL CHECK (bouwjaar BETWEEN 1700 AND 2100),
  energielabel public.energielabel_v2,
  huurstatus public.verhuur_status,
  bron TEXT,
  notities TEXT,
  aangemaakt_door UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  soft_deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_referentie_objecten_asset_class ON public.referentie_objecten(asset_class);
CREATE INDEX idx_referentie_objecten_plaats ON public.referentie_objecten(plaats);
CREATE INDEX idx_referentie_objecten_postcode ON public.referentie_objecten(postcode);

ALTER TABLE public.referentie_objecten ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intern leest referentie_objecten"
  ON public.referentie_objecten FOR SELECT TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Intern voegt referentie_objecten toe"
  ON public.referentie_objecten FOR INSERT TO authenticated
  WITH CHECK (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Intern wijzigt referentie_objecten"
  ON public.referentie_objecten FOR UPDATE TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Intern verwijdert referentie_objecten"
  ON public.referentie_objecten FOR DELETE TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE TRIGGER trg_referentie_objecten_updated_at
  BEFORE UPDATE ON public.referentie_objecten
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Koppeltabel deal_referenties
CREATE TABLE public.deal_referenties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  referentie_object_id UUID NOT NULL REFERENCES public.referentie_objecten(id) ON DELETE CASCADE,
  notities TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, referentie_object_id)
);

CREATE INDEX idx_deal_referenties_deal ON public.deal_referenties(deal_id);
CREATE INDEX idx_deal_referenties_ref ON public.deal_referenties(referentie_object_id);

ALTER TABLE public.deal_referenties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intern leest deal_referenties"
  ON public.deal_referenties FOR SELECT TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Intern voegt deal_referenties toe"
  ON public.deal_referenties FOR INSERT TO authenticated
  WITH CHECK (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Intern wijzigt deal_referenties"
  ON public.deal_referenties FOR UPDATE TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Intern verwijdert deal_referenties"
  ON public.deal_referenties FOR DELETE TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));