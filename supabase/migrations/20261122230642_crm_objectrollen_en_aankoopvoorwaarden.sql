-- Additive CRMschema: object-specific roles and buyer requirements.
-- Historical eigenaar_relatie_id is intentionally NOT reclassified or backfilled.
ALTER TABLE public.objecten
  ADD COLUMN IF NOT EXISTS verkoper_relatie_id uuid REFERENCES public.relaties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aanbieder_relatie_id uuid REFERENCES public.relaties(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.objecten.verkoper_relatie_id IS
 'Explicit seller relation, separate from historical owner/seller reference.';
COMMENT ON COLUMN public.objecten.aanbieder_relatie_id IS
 'Explicit offering broker/intermediary; never a candidate for its own object.';

ALTER TABLE public.relaties
  ADD COLUMN IF NOT EXISTS harde_aankoopvoorwaarden text,
  ADD COLUMN IF NOT EXISTS aankoopvoorkeuren text;

COMMENT ON COLUMN public.relaties.harde_aankoopvoorwaarden IS
 'Literal mandatory buyer requirements, not automatically executable as SQL/matching exclusions.';
COMMENT ON COLUMN public.relaties.aankoopvoorkeuren IS
 'Literal nonbinding buyer preferences, never automatic knockout.';

CREATE INDEX IF NOT EXISTS idx_objecten_verkoper_relatie_id
  ON public.objecten(verkoper_relatie_id) WHERE verkoper_relatie_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_objecten_aanbieder_relatie_id
  ON public.objecten(aanbieder_relatie_id) WHERE aanbieder_relatie_id IS NOT NULL;
