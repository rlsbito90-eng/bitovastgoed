ALTER TABLE public.off_market_signalen
  ADD COLUMN IF NOT EXISTS bag_match_kandidaten jsonb,
  ADD COLUMN IF NOT EXISTS bag_geselecteerd_vbo_id text,
  ADD COLUMN IF NOT EXISTS bag_geselecteerd_nummeraanduiding_id text,
  ADD COLUMN IF NOT EXISTS bag_geselecteerd_adres text,
  ADD COLUMN IF NOT EXISTS bag_geselecteerd_opp_m2 int,
  ADD COLUMN IF NOT EXISTS bag_geselecteerd_gebruiksdoel text[],
  ADD COLUMN IF NOT EXISTS bag_pandcontext_aantal_vbo int,
  ADD COLUMN IF NOT EXISTS bag_pandcontext_totaal_opp_m2 int;