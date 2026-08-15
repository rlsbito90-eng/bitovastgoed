DO $$ BEGIN
  CREATE TYPE public.kandidaat_status AS ENUM ('geinteresseerd','bezichtiging','bod','afgevallen','gewonnen');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.deal_objecten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  object_id uuid NOT NULL REFERENCES public.objecten(id) ON DELETE CASCADE,
  is_primair boolean NOT NULL DEFAULT false,
  notities text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, object_id)
);
CREATE INDEX IF NOT EXISTS idx_deal_objecten_deal ON public.deal_objecten(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_objecten_object ON public.deal_objecten(object_id);
ALTER TABLE public.deal_objecten ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Intern leest deal_objecten" ON public.deal_objecten;
CREATE POLICY "Intern leest deal_objecten" ON public.deal_objecten
FOR SELECT TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
DROP POLICY IF EXISTS "Intern voegt deal_objecten toe" ON public.deal_objecten;
CREATE POLICY "Intern voegt deal_objecten toe" ON public.deal_objecten
FOR INSERT TO authenticated WITH CHECK (public.is_intern_gebruiker(auth.uid()));
DROP POLICY IF EXISTS "Intern wijzigt deal_objecten" ON public.deal_objecten;
CREATE POLICY "Intern wijzigt deal_objecten" ON public.deal_objecten
FOR UPDATE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
DROP POLICY IF EXISTS "Intern verwijdert deal_objecten" ON public.deal_objecten;
CREATE POLICY "Intern verwijdert deal_objecten" ON public.deal_objecten
FOR DELETE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));

CREATE TABLE IF NOT EXISTS public.deal_kandidaten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  relatie_id uuid NOT NULL REFERENCES public.relaties(id) ON DELETE CASCADE,
  status public.kandidaat_status NOT NULL DEFAULT 'geinteresseerd',
  notities text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, relatie_id)
);
CREATE INDEX IF NOT EXISTS idx_deal_kandidaten_deal ON public.deal_kandidaten(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_kandidaten_relatie ON public.deal_kandidaten(relatie_id);
ALTER TABLE public.deal_kandidaten ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Intern leest deal_kandidaten" ON public.deal_kandidaten;
CREATE POLICY "Intern leest deal_kandidaten" ON public.deal_kandidaten
FOR SELECT TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
DROP POLICY IF EXISTS "Intern voegt deal_kandidaten toe" ON public.deal_kandidaten;
CREATE POLICY "Intern voegt deal_kandidaten toe" ON public.deal_kandidaten
FOR INSERT TO authenticated WITH CHECK (public.is_intern_gebruiker(auth.uid()));
DROP POLICY IF EXISTS "Intern wijzigt deal_kandidaten" ON public.deal_kandidaten;
CREATE POLICY "Intern wijzigt deal_kandidaten" ON public.deal_kandidaten
FOR UPDATE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));
DROP POLICY IF EXISTS "Intern verwijdert deal_kandidaten" ON public.deal_kandidaten;
CREATE POLICY "Intern verwijdert deal_kandidaten" ON public.deal_kandidaten
FOR DELETE TO authenticated USING (public.is_intern_gebruiker(auth.uid()));

DROP TRIGGER IF EXISTS trg_deal_kandidaten_updated ON public.deal_kandidaten;
CREATE TRIGGER trg_deal_kandidaten_updated
BEFORE UPDATE ON public.deal_kandidaten
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.deal_objecten (deal_id, object_id, is_primair)
SELECT d.id, d.object_id, true FROM public.deals d
WHERE d.object_id IS NOT NULL
ON CONFLICT (deal_id, object_id) DO NOTHING;

INSERT INTO public.deal_kandidaten (deal_id, relatie_id, status)
SELECT d.id, d.relatie_id, 'geinteresseerd'::public.kandidaat_status FROM public.deals d
WHERE d.relatie_id IS NOT NULL
ON CONFLICT (deal_id, relatie_id) DO NOTHING;

ALTER TABLE public.objecten
  ADD COLUMN IF NOT EXISTS intern_referentienummer text,
  ADD COLUMN IF NOT EXISTS adres text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS subcategorie text,
  ADD COLUMN IF NOT EXISTS prijsindicatie text,
  ADD COLUMN IF NOT EXISTS huur_per_m2 numeric,
  ADD COLUMN IF NOT EXISTS bruto_aanvangsrendement numeric,
  ADD COLUMN IF NOT EXISTS leegstand_pct numeric,
  ADD COLUMN IF NOT EXISTS oppervlakte_vvo integer,
  ADD COLUMN IF NOT EXISTS oppervlakte_bvo integer,
  ADD COLUMN IF NOT EXISTS perceel_oppervlakte integer,
  ADD COLUMN IF NOT EXISTS energielabel text,
  ADD COLUMN IF NOT EXISTS eigendomssituatie text,
  ADD COLUMN IF NOT EXISTS erfpachtinformatie text,
  ADD COLUMN IF NOT EXISTS bestemmingsinformatie text,
  ADD COLUMN IF NOT EXISTS beschikbaar_vanaf date,
  ADD COLUMN IF NOT EXISTS opmerkingen text;

ALTER TABLE public.taken
  ADD COLUMN IF NOT EXISTS deadline_tijd time without time zone;