ALTER TABLE public.off_market_bronnen
  ADD COLUMN IF NOT EXISTS auto_start_op date NULL;

COMMENT ON COLUMN public.off_market_bronnen.auto_start_op IS
  'Datum vanaf wanneer de scheduler automatische runs mag uitvoeren. Leeg = vandaag bij activatie van auto_import.';
