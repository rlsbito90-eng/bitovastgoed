-- Rendementscriteria per investeringsstrategie + blijvende beoordeling objectvoorstellen.
-- Additief: bestaande relatie- en zoekprofielvelden blijven behouden.
CREATE TABLE IF NOT EXISTS public.relatie_rendementscriteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relatie_id uuid NOT NULL REFERENCES public.relaties(id) ON DELETE CASCADE,
  zoekprofiel_id uuid REFERENCES public.zoekprofielen(id) ON DELETE SET NULL,
  strategie text NOT NULL DEFAULT 'onbekend'
    CHECK (strategie IN ('belegging','ontwikkeling','transformatie','handel','overig','onbekend')),
  methode text NOT NULL DEFAULT 'onbekend'
    CHECK (methode IN ('bar','nar','gdv_marge','projectkosten','eigen_vermogen','irr','netto_onbekend','overig','onbekend')),
  percentage numeric(8,3) NOT NULL CHECK (percentage >= 0 AND percentage <= 1000),
  criterium_type text NOT NULL DEFAULT 'doel'
    CHECK (criterium_type IN ('minimum','doel','gemiddeld','historisch')),
  methode_bevestigd boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'actief' CHECK (status IN ('actief','verouderd')),
  toelichting text,
  bron text,
  bron_datum date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_relatie_rendementscriteria_relatie
  ON public.relatie_rendementscriteria (relatie_id, status);
CREATE INDEX IF NOT EXISTS idx_relatie_rendementscriteria_zoekprofiel
  ON public.relatie_rendementscriteria (zoekprofiel_id)
  WHERE zoekprofiel_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.relatie_object_matchbesluiten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relatie_id uuid NOT NULL REFERENCES public.relaties(id) ON DELETE CASCADE,
  object_id uuid NOT NULL REFERENCES public.objecten(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('interessant','afgewezen')),
  reden_code text,
  toelichting text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (relatie_id, object_id)
);
CREATE INDEX IF NOT EXISTS idx_relatie_object_matchbesluiten_object
  ON public.relatie_object_matchbesluiten (object_id, status);

ALTER TABLE public.relatie_rendementscriteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatie_object_matchbesluiten ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.relatie_rendementscriteria FROM PUBLIC, anon;
REVOKE ALL ON public.relatie_object_matchbesluiten FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relatie_rendementscriteria TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relatie_object_matchbesluiten TO authenticated;

CREATE POLICY "Intern leest rendementscriteria" ON public.relatie_rendementscriteria
  FOR SELECT TO authenticated USING (public.is_intern_gebruiker((select auth.uid())));
CREATE POLICY "Intern voegt rendementscriteria toe" ON public.relatie_rendementscriteria
  FOR INSERT TO authenticated WITH CHECK (public.is_intern_gebruiker((select auth.uid())));
CREATE POLICY "Intern wijzigt rendementscriteria" ON public.relatie_rendementscriteria
  FOR UPDATE TO authenticated USING (public.is_intern_gebruiker((select auth.uid())))
  WITH CHECK (public.is_intern_gebruiker((select auth.uid())));
CREATE POLICY "Intern verwijdert rendementscriteria" ON public.relatie_rendementscriteria
  FOR DELETE TO authenticated USING (public.is_intern_gebruiker((select auth.uid())));
CREATE POLICY "Intern leest matchbesluiten" ON public.relatie_object_matchbesluiten
  FOR SELECT TO authenticated USING (public.is_intern_gebruiker((select auth.uid())));
CREATE POLICY "Intern voegt matchbesluiten toe" ON public.relatie_object_matchbesluiten
  FOR INSERT TO authenticated WITH CHECK (public.is_intern_gebruiker((select auth.uid())));
CREATE POLICY "Intern wijzigt matchbesluiten" ON public.relatie_object_matchbesluiten
  FOR UPDATE TO authenticated USING (public.is_intern_gebruiker((select auth.uid())))
  WITH CHECK (public.is_intern_gebruiker((select auth.uid())));
CREATE POLICY "Intern verwijdert matchbesluiten" ON public.relatie_object_matchbesluiten
  FOR DELETE TO authenticated USING (public.is_intern_gebruiker((select auth.uid())));

-- Oude cijfers blijven bestaan in hun oorspronkelijke kolommen. Nieuwe records
-- krijgen onbekende definitie en 'doel', dus nooit een impliciete harde uitsluiting.
INSERT INTO public.relatie_rendementscriteria
 (relatie_id, strategie, methode, percentage, criterium_type, methode_bevestigd, bron, toelichting)
SELECT id, 'onbekend', 'onbekend', rendementseis, 'doel', false,
       'Overgenomen uit relaties.rendementseis',
       'Historisch numeriek rendement; betekenis en methode nog te bevestigen'
FROM public.relaties
WHERE rendementseis IS NOT NULL;

INSERT INTO public.relatie_rendementscriteria
 (relatie_id, zoekprofiel_id, strategie, methode, percentage, criterium_type, methode_bevestigd, bron, toelichting)
SELECT relatie_id, id, 'onbekend', 'onbekend', rendementseis, 'doel', false,
       'Overgenomen uit zoekprofielen.rendementseis',
       'Historisch numeriek rendement; betekenis en methode nog te bevestigen'
FROM public.zoekprofielen
WHERE rendementseis IS NOT NULL;

-- Michael: bron is de ontvangen verklaring; ontwikkeling 20% gemiddeld,
-- belegging 8,5% minimum netto (exacte netto-definitie onbekend).
UPDATE public.relatie_rendementscriteria
SET status='verouderd', updated_at=now()
WHERE relatie_id IN (
  SELECT id FROM public.relaties WHERE lower(btrim(bedrijfsnaam))='maas developments'
) AND bron='Overgenomen uit relaties.rendementseis';

INSERT INTO public.relatie_rendementscriteria
 (relatie_id, strategie, methode, percentage, criterium_type, methode_bevestigd, bron, toelichting)
SELECT id, 'ontwikkeling', 'onbekend', 20, 'gemiddeld', false,
       'E-mail Michael Mittendorff over Laan van Meerdervoort',
       'Gemiddeld rendement op ontwikkelingen; berekeningsmethode en minimale ondergrens nog navragen.'
FROM public.relaties WHERE lower(btrim(bedrijfsnaam))='maas developments'
UNION ALL
SELECT id, 'belegging', 'netto_onbekend', 8.5, 'minimum', false,
       'E-mail Michael Mittendorff over Laan van Meerdervoort',
       'Minimaal 8,5% netto rendement; definitie van netto nog navragen.'
FROM public.relaties WHERE lower(btrim(bedrijfsnaam))='maas developments';
