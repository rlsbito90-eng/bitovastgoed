CREATE TABLE IF NOT EXISTS public.kadaster_producten (
  code text PRIMARY KEY,
  naam text NOT NULL,
  categorie text NOT NULL CHECK (categorie IN ('gratis','betaald')),
  tarief_per_eenheid numeric(12,4),
  valuta text NOT NULL DEFAULT 'EUR',
  actief boolean NOT NULL DEFAULT false,
  bevestiging_verplicht boolean NOT NULL DEFAULT true,
  tarief_geldig_vanaf date,
  bron_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
CREATE TABLE IF NOT EXISTS public.kadaster_budgetten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL CHECK (scope_type IN ('bedrijf','gebruiker','campagne','module')),
  scope_id text NOT NULL,
  daglimiet numeric(12,2),
  maandlimiet numeric(12,2),
  bevestiging_vanaf numeric(12,2),
  harde_blokkade boolean NOT NULL DEFAULT false,
  beheerder_override boolean NOT NULL DEFAULT true,
  waarschuwing_percentages integer[] NOT NULL DEFAULT ARRAY[70,85,100],
  geldig_vanaf date NOT NULL DEFAULT current_date,
  geldig_tot date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE(scope_type, scope_id, geldig_vanaf)
);
CREATE TABLE IF NOT EXISTS public.kadaster_kosten_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code text NOT NULL REFERENCES public.kadaster_producten(code),
  status text NOT NULL CHECK (status IN ('geraamd','bevestigd','geleverd','gedeeltelijk_geleverd','mislukt','geannuleerd','hergebruikt')),
  bron_module text NOT NULL CHECK (bron_module IN ('vastgoedkansen','off_market_radar','objecten','acquisitie','deals','pandenverkenner','snelle_pandcheck','referentieobjecten','vastgoedrekenen','overig')),
  bron_record_type text,
  bron_record_id text,
  aantal_eenheden integer NOT NULL DEFAULT 1 CHECK (aantal_eenheden > 0),
  geraamde_kosten numeric(12,2) NOT NULL DEFAULT 0,
  werkelijke_kosten numeric(12,2),
  valuta text NOT NULL DEFAULT 'EUR',
  gebruiker_id uuid NOT NULL REFERENCES auth.users(id),
  crm_objectregistratie_id uuid REFERENCES public.crm_objectregistraties(id),
  vastgoedkans_id uuid,
  object_id uuid,
  campagne_id uuid,
  adres_label text,
  externe_request_id text,
  hergebruikt_van_event_id uuid REFERENCES public.kadaster_kosten_events(id),
  aangevraagd_op timestamptz NOT NULL DEFAULT now(),
  geleverd_op timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kadaster_kosten_events_periode_idx ON public.kadaster_kosten_events(aangevraagd_op DESC);
CREATE INDEX IF NOT EXISTS kadaster_kosten_events_product_idx ON public.kadaster_kosten_events(product_code, aangevraagd_op DESC);
CREATE INDEX IF NOT EXISTS kadaster_kosten_events_module_idx ON public.kadaster_kosten_events(bron_module, aangevraagd_op DESC);
CREATE INDEX IF NOT EXISTS kadaster_kosten_events_gebruiker_idx ON public.kadaster_kosten_events(gebruiker_id, aangevraagd_op DESC);
CREATE INDEX IF NOT EXISTS kadaster_kosten_events_object_idx ON public.kadaster_kosten_events(crm_objectregistratie_id, aangevraagd_op DESC);
CREATE INDEX IF NOT EXISTS kadaster_producten_updated_by_idx ON public.kadaster_producten(updated_by) WHERE updated_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS kadaster_budgetten_updated_by_idx ON public.kadaster_budgetten(updated_by) WHERE updated_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS kadaster_kosten_events_hergebruik_idx ON public.kadaster_kosten_events(hergebruikt_van_event_id) WHERE hergebruikt_van_event_id IS NOT NULL;
ALTER TABLE public.kadaster_producten ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kadaster_budgetten ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kadaster_kosten_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated leest kadasterproducten" ON public.kadaster_producten;
CREATE POLICY "authenticated leest kadasterproducten" ON public.kadaster_producten FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated leest kadasterbudgetten" ON public.kadaster_budgetten;
CREATE POLICY "authenticated leest kadasterbudgetten" ON public.kadaster_budgetten FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated leest kadasterkosten" ON public.kadaster_kosten_events;
CREATE POLICY "authenticated leest kadasterkosten" ON public.kadaster_kosten_events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin beheert kadasterproducten" ON public.kadaster_producten;
DROP POLICY IF EXISTS "admin voegt kadasterproducten toe" ON public.kadaster_producten;
DROP POLICY IF EXISTS "admin wijzigt kadasterproducten" ON public.kadaster_producten;
DROP POLICY IF EXISTS "admin verwijdert kadasterproducten" ON public.kadaster_producten;
CREATE POLICY "admin voegt kadasterproducten toe" ON public.kadaster_producten FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_app_admin()));
CREATE POLICY "admin wijzigt kadasterproducten" ON public.kadaster_producten FOR UPDATE TO authenticated USING ((SELECT public.is_app_admin())) WITH CHECK ((SELECT public.is_app_admin()));
CREATE POLICY "admin verwijdert kadasterproducten" ON public.kadaster_producten FOR DELETE TO authenticated USING ((SELECT public.is_app_admin()));
DROP POLICY IF EXISTS "admin beheert kadasterbudgetten" ON public.kadaster_budgetten;
DROP POLICY IF EXISTS "admin voegt kadasterbudgetten toe" ON public.kadaster_budgetten;
DROP POLICY IF EXISTS "admin wijzigt kadasterbudgetten" ON public.kadaster_budgetten;
DROP POLICY IF EXISTS "admin verwijdert kadasterbudgetten" ON public.kadaster_budgetten;
CREATE POLICY "admin voegt kadasterbudgetten toe" ON public.kadaster_budgetten FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_app_admin()));
CREATE POLICY "admin wijzigt kadasterbudgetten" ON public.kadaster_budgetten FOR UPDATE TO authenticated USING ((SELECT public.is_app_admin())) WITH CHECK ((SELECT public.is_app_admin()));
CREATE POLICY "admin verwijdert kadasterbudgetten" ON public.kadaster_budgetten FOR DELETE TO authenticated USING ((SELECT public.is_app_admin()));
INSERT INTO public.kadaster_producten(code, naam, categorie, actief, bevestiging_verplicht)
VALUES
  ('objectinformatie_algemeen','Objectinformatie algemeen','gratis',false,false),
  ('contractloos','Contractloos','betaald',false,true),
  ('rechten','Rechteninformatie','betaald',false,true),
  ('koopsom','Koopsom','betaald',false,true),
  ('omgeving','Omgevingsinformatie','betaald',false,true),
  ('woz','WOZ-informatie','betaald',false,true)
ON CONFLICT (code) DO NOTHING;