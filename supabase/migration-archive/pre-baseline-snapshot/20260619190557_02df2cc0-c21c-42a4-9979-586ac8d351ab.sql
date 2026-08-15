ALTER TABLE public.off_market_signalen
  ADD COLUMN IF NOT EXISTS bag_pandcontext_incompleet boolean;