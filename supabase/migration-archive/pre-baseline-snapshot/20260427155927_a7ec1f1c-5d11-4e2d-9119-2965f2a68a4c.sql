-- ============================================================
-- OBJECT PIPELINE: flexibele pipeline + stages structuur
-- ============================================================
-- Niet-destructief: bestaande object_pipeline (kandidaattraject)
-- en deals-module blijven volledig intact.

-- 1. PIPELINES
CREATE TABLE IF NOT EXISTS public.pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  entity_type text NOT NULL DEFAULT 'object',
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intern leest pipelines"
  ON public.pipelines FOR SELECT TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Admin beheert pipelines ins"
  ON public.pipelines FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin beheert pipelines upd"
  ON public.pipelines FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin beheert pipelines del"
  ON public.pipelines FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER pipelines_updated_at
  BEFORE UPDATE ON public.pipelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. PIPELINE STAGES
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  color text,
  probability integer,
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pipeline_id, slug)
);

CREATE INDEX IF NOT EXISTS pipeline_stages_pipeline_idx ON public.pipeline_stages(pipeline_id, sort_order);

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Intern leest pipeline_stages"
  ON public.pipeline_stages FOR SELECT TO authenticated
  USING (public.is_intern_gebruiker(auth.uid()));

CREATE POLICY "Admin beheert pipeline_stages ins"
  ON public.pipeline_stages FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin beheert pipeline_stages upd"
  ON public.pipeline_stages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin beheert pipeline_stages del"
  ON public.pipeline_stages FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER pipeline_stages_updated_at
  BEFORE UPDATE ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. KOLOMMEN OP OBJECTEN
ALTER TABLE public.objecten
  ADD COLUMN IF NOT EXISTS pipeline_id uuid REFERENCES public.pipelines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pipeline_stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pipeline_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS pipeline_stage_locked boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS objecten_pipeline_stage_idx ON public.objecten(pipeline_stage_id);
CREATE INDEX IF NOT EXISTS objecten_pipeline_idx ON public.objecten(pipeline_id);

-- 4. SEED — Default Object Pipeline met 15 fases
DO $$
DECLARE
  v_pipeline_id uuid;
BEGIN
  -- Alleen aanmaken als er nog geen default object-pipeline bestaat
  SELECT id INTO v_pipeline_id
  FROM public.pipelines
  WHERE entity_type = 'object' AND is_default = true
  LIMIT 1;

  IF v_pipeline_id IS NULL THEN
    INSERT INTO public.pipelines (name, entity_type, is_active, is_default)
    VALUES ('Object Pipeline', 'object', true, true)
    RETURNING id INTO v_pipeline_id;

    INSERT INTO public.pipeline_stages
      (pipeline_id, name, slug, sort_order, color, probability, is_won, is_lost) VALUES
      (v_pipeline_id, 'Lead',                        'lead',                   10, '#94a3b8', 5,   false, false),
      (v_pipeline_id, 'Gekwalificeerd',              'gekwalificeerd',         20, '#94a3b8', 10,  false, false),
      (v_pipeline_id, 'In voorbereiding',            'in_voorbereiding',       30, '#64748b', 15,  false, false),
      (v_pipeline_id, 'In verkoop / matching',       'in_verkoop',             40, '#3b82f6', 25,  false, false),
      (v_pipeline_id, 'Kandidaten benaderd',         'kandidaten_benaderd',    50, '#3b82f6', 35,  false, false),
      (v_pipeline_id, 'NDA / dataroom',              'nda_dataroom',           60, '#6366f1', 45,  false, false),
      (v_pipeline_id, 'Bezichtigingen',              'bezichtigingen',         70, '#8b5cf6', 55,  false, false),
      (v_pipeline_id, 'Biedingen ontvangen',         'biedingen_ontvangen',    80, '#a855f7', 65,  false, false),
      (v_pipeline_id, 'Onderhandeling',              'onderhandeling',         90, '#d946ef', 70,  false, false),
      (v_pipeline_id, 'LOI / intentie',              'loi',                    100,'#ec4899', 75,  false, false),
      (v_pipeline_id, 'Due diligence',               'due_diligence',          110,'#f59e0b', 80,  false, false),
      (v_pipeline_id, 'Koopovereenkomst',            'koopovereenkomst',       120,'#f59e0b', 90,  false, false),
      (v_pipeline_id, 'Closing / notaris',           'closing',                130,'#10b981', 95,  false, false),
      (v_pipeline_id, 'Afgerond',                    'afgerond',               140,'#10b981', 100, true,  false),
      (v_pipeline_id, 'Afgevallen',                  'afgevallen',             999,'#ef4444', 0,   false, true);
  END IF;
END $$;

-- 5. Bestaande objecten zonder pipeline_id koppelen aan default pipeline + Lead-stage
UPDATE public.objecten o
SET pipeline_id = p.id
FROM public.pipelines p
WHERE o.pipeline_id IS NULL
  AND p.entity_type = 'object'
  AND p.is_default = true;
