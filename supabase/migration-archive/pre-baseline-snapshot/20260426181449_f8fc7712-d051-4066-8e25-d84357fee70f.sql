-- Nieuwe tabel: object_referenties
CREATE TABLE public.object_referenties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  object_id UUID NOT NULL,
  referentie_object_id UUID NOT NULL,
  notities TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (object_id, referentie_object_id)
);

CREATE INDEX idx_object_referenties_object ON public.object_referenties(object_id);
CREATE INDEX idx_object_referenties_referentie ON public.object_referenties(referentie_object_id);

ALTER TABLE public.object_referenties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intern leest object_referenties"
  ON public.object_referenties FOR SELECT
  TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Intern voegt object_referenties toe"
  ON public.object_referenties FOR INSERT
  TO authenticated
  WITH CHECK (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Intern wijzigt object_referenties"
  ON public.object_referenties FOR UPDATE
  TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Intern verwijdert object_referenties"
  ON public.object_referenties FOR DELETE
  TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

-- Veld toevoegen aan objecten voor zichtbaarheid sectie
ALTER TABLE public.objecten
  ADD COLUMN IF NOT EXISTS referentieanalyse_zichtbaar BOOLEAN NOT NULL DEFAULT true;