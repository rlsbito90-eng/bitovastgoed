
CREATE TABLE public.off_market_brieven (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signaal_id uuid NOT NULL REFERENCES public.off_market_signalen(id) ON DELETE CASCADE,
  eigenaar_naam text,
  eigenaar_bedrijfsnaam text,
  verzendadres text,
  objectadres text,
  aanhef text,
  onderwerp text,
  brieftekst text NOT NULL,
  status text NOT NULL DEFAULT 'concept',
  verzonden_op timestamptz,
  aangemaakt_door uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT off_market_brieven_status_check CHECK (status IN ('concept','verstuurd'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.off_market_brieven TO authenticated;
GRANT ALL ON public.off_market_brieven TO service_role;

ALTER TABLE public.off_market_brieven ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Interne gebruikers kunnen brieven lezen"
ON public.off_market_brieven FOR SELECT
TO authenticated
USING (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Interne gebruikers kunnen brieven aanmaken"
ON public.off_market_brieven FOR INSERT
TO authenticated
WITH CHECK (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Interne gebruikers kunnen brieven bijwerken"
ON public.off_market_brieven FOR UPDATE
TO authenticated
USING (public.is_intern_gebruiker(auth.uid()))
WITH CHECK (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Interne gebruikers kunnen brieven verwijderen"
ON public.off_market_brieven FOR DELETE
TO authenticated
USING (public.is_intern_gebruiker(auth.uid()));

CREATE INDEX idx_off_market_brieven_signaal ON public.off_market_brieven(signaal_id);

CREATE TRIGGER trg_off_market_brieven_updated_at
BEFORE UPDATE ON public.off_market_brieven
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
