ALTER TABLE public.object_fotos
  ADD COLUMN IF NOT EXISTS focus_x smallint NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS focus_y smallint NOT NULL DEFAULT 50;

ALTER TABLE public.object_fotos
  DROP CONSTRAINT IF EXISTS object_fotos_focus_x_range,
  DROP CONSTRAINT IF EXISTS object_fotos_focus_y_range;

ALTER TABLE public.object_fotos
  ADD CONSTRAINT object_fotos_focus_x_range CHECK (focus_x BETWEEN 0 AND 100),
  ADD CONSTRAINT object_fotos_focus_y_range CHECK (focus_y BETWEEN 0 AND 100);