-- Deals archive/closing fields
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_reason text,
  ADD COLUMN IF NOT EXISTS archived_note text,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_deals_is_archived ON public.deals (is_archived);

-- Jaar-doelen provenance
ALTER TABLE public.jaar_doelen
  ADD COLUMN IF NOT EXISTS aangemaakt_door uuid;

-- Contactpersoon mobile phone
ALTER TABLE public.relatie_contactpersonen
  ADD COLUMN IF NOT EXISTS telefoon_mobiel text;

-- Object photos: plattegrond + focal point
ALTER TABLE public.object_fotos
  ADD COLUMN IF NOT EXISTS is_plattegrond boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS focus_x smallint NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS focus_y smallint NOT NULL DEFAULT 50;
ALTER TABLE public.object_fotos
  DROP CONSTRAINT IF EXISTS object_fotos_focus_x_range,
  DROP CONSTRAINT IF EXISTS object_fotos_focus_y_range;
ALTER TABLE public.object_fotos
  ADD CONSTRAINT object_fotos_focus_x_range CHECK (focus_x BETWEEN 0 AND 100),
  ADD CONSTRAINT object_fotos_focus_y_range CHECK (focus_y BETWEEN 0 AND 100);

-- Legacy subcategory timestamps expected by current application contract
ALTER TABLE public.object_subcategorieen
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
DO $$ BEGIN
  CREATE TRIGGER trg_object_subcategorieen_updated
    BEFORE UPDATE ON public.object_subcategorieen
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Comparative valuation provenance on reference objects
ALTER TABLE public.referentie_objecten
  ADD COLUMN IF NOT EXISTS price_type text NOT NULL DEFAULT 'asking_price',
  ADD COLUMN IF NOT EXISTS transaction_date date,
  ADD COLUMN IF NOT EXISTS valuation_date date,
  ADD COLUMN IF NOT EXISTS source_reference text,
  ADD COLUMN IF NOT EXISTS source_reliability text,
  ADD COLUMN IF NOT EXISTS aangemaakt_door uuid;
DO $$ BEGIN
  ALTER TABLE public.referentie_objecten
    ADD CONSTRAINT referentie_objecten_price_type_check
    CHECK (price_type IN ('asking_price','transaction_price','valuation','other'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.referentie_objecten
    ADD CONSTRAINT referentie_objecten_source_reliability_check
    CHECK (source_reliability IS NULL OR source_reliability IN ('high','medium','low','unknown'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;