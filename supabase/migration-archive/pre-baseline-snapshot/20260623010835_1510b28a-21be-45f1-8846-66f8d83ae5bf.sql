CREATE TABLE public.off_market_acquisitie_selectie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signaal_id uuid NOT NULL REFERENCES public.off_market_signalen(id) ON DELETE CASCADE,
  toegevoegd_door uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  toegevoegd_op timestamptz NOT NULL DEFAULT now(),
  notitie text,
  archived_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.off_market_acquisitie_selectie TO authenticated;
GRANT ALL ON public.off_market_acquisitie_selectie TO service_role;

ALTER TABLE public.off_market_acquisitie_selectie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intern leest acquisitieselectie"
  ON public.off_market_acquisitie_selectie
  FOR SELECT TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Intern voegt acquisitieselectie toe"
  ON public.off_market_acquisitie_selectie
  FOR INSERT TO authenticated
  WITH CHECK (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Intern wijzigt acquisitieselectie"
  ON public.off_market_acquisitie_selectie
  FOR UPDATE TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()))
  WITH CHECK (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Intern verwijdert acquisitieselectie"
  ON public.off_market_acquisitie_selectie
  FOR DELETE TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE UNIQUE INDEX off_market_acquisitie_selectie_actief_uniek
  ON public.off_market_acquisitie_selectie (signaal_id)
  WHERE archived_at IS NULL;

CREATE INDEX off_market_acquisitie_selectie_signaal_idx
  ON public.off_market_acquisitie_selectie (signaal_id);
