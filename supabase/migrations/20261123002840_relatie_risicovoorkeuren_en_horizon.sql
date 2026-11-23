-- CRM: per belegger vastleggen welke risico's besproken of uitgesloten zijn.
-- Optioneel en additief. Ontbrekende rij betekent "niet besproken", NOOIT "accepteert".
-- Bestaande rendementseisen, financieringsstructuur en strategieen blijven leidend.
ALTER TABLE public.relaties
  ADD COLUMN IF NOT EXISTS beleggingshorizon text
    CHECK (beleggingshorizon IS NULL OR beleggingshorizon IN ('kort','middellang','lang','flexibel')),
  ADD COLUMN IF NOT EXISTS investeringsdoel text
    CHECK (investeringsdoel IS NULL OR investeringsdoel IN ('cashflow','waardecreatie','beide','per_object'));

CREATE TABLE IF NOT EXISTS public.relatie_risicovoorkeuren (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relatie_id uuid NOT NULL REFERENCES public.relaties(id) ON DELETE CASCADE,
  risicotype text NOT NULL
    CHECK (risicotype IN ('leegstand','renovatie','huurachterstand',
      'vergunning','transformatie','korte_huur','verduurzaming')),
  bereidheid text NOT NULL
    CHECK (bereidheid IN ('accepteert','onder_voorwaarden','sluit_uit')),
  -- Onbevestigde notities zijn signalen, geen harde koopvoorwaarden.
  bevestigd boolean NOT NULL DEFAULT false,
  bron text,
  bron_datum date,
  toelichting text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (relatie_id, risicotype),
  CONSTRAINT risico_bevestiging_heeft_bron CHECK (NOT bevestigd OR coalesce(length(btrim(bron)),0) > 0)
);
CREATE INDEX IF NOT EXISTS idx_relatie_risicovoorkeuren_relatie
  ON public.relatie_risicovoorkeuren(relatie_id);

ALTER TABLE public.relatie_risicovoorkeuren ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.relatie_risicovoorkeuren FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relatie_risicovoorkeuren TO authenticated;
CREATE POLICY "Intern leest risicovoorkeuren" ON public.relatie_risicovoorkeuren
  FOR SELECT TO authenticated USING (public.is_intern_gebruiker((select auth.uid())));
CREATE POLICY "Intern voegt risicovoorkeuren toe" ON public.relatie_risicovoorkeuren
  FOR INSERT TO authenticated WITH CHECK (public.is_intern_gebruiker((select auth.uid())));
CREATE POLICY "Intern wijzigt risicovoorkeuren" ON public.relatie_risicovoorkeuren
  FOR UPDATE TO authenticated USING (public.is_intern_gebruiker((select auth.uid())))
  WITH CHECK (public.is_intern_gebruiker((select auth.uid())));
CREATE POLICY "Intern verwijdert risicovoorkeuren" ON public.relatie_risicovoorkeuren
  FOR DELETE TO authenticated USING (public.is_intern_gebruiker((select auth.uid())));
COMMENT ON TABLE public.relatie_risicovoorkeuren IS
  'Per relatie besproken vastgoedrisicos. Niet automatisch als knock-out gebruiken zonder geverifieerd objectrisico en expliciet bevestigde uitsluiting.';
