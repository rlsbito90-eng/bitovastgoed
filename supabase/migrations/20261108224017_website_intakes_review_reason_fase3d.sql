-- Bestaande website-intakes: leg reviewreden en interne reviewer vast.
-- Geen automatische wijziging van Relaties of de originele formulierantwoorden.
ALTER TABLE public.website_investor_intakes
 ADD COLUMN IF NOT EXISTS review_reason text,
 ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.website_investor_intakes.review_reason IS
 'Reden voor een afgeronde beoordeling of afwijzing.';
COMMENT ON COLUMN public.website_investor_intakes.reviewed_by IS
 'Interne reviewer; NULL bij automatisch verwerkte formulieren.';
