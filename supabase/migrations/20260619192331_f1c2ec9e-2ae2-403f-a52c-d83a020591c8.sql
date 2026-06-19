ALTER TABLE public.off_market_signalen
  ADD COLUMN IF NOT EXISTS bag_pandcontext_bron text;

COMMENT ON COLUMN public.off_market_signalen.bag_pandcontext_bron IS
  'V2.4 BAG-pandcontextbron: pandid | huisnummer | gemengd | leeg';