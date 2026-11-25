ALTER TABLE public.relatie_rendementscriteria
  DROP CONSTRAINT relatie_rendementscriteria_methode_check,
  DROP CONSTRAINT relatie_rendementscriteria_criterium_type_check,
  ADD CONSTRAINT relatie_rendementscriteria_methode_check
    CHECK (methode IN ('bar','nar','factor','gdv_marge','projectkosten','eigen_vermogen','irr','netto_onbekend','overig','onbekend')),
  ADD CONSTRAINT relatie_rendementscriteria_criterium_type_check
    CHECK (criterium_type IN ('minimum','maximum','doel','gemiddeld','historisch')),
  ADD CONSTRAINT relatie_rendementscriteria_factor_check
    CHECK (CASE WHEN methode='factor' THEN percentage>0 AND strategie='belegging' AND criterium_type IN ('maximum','doel') ELSE criterium_type<>'maximum' END);
COMMENT ON COLUMN public.relatie_rendementscriteria.percentage IS 'Numerieke criteriumwaarde: percentage voor rendementsmethoden, brutojaarhuurmultiple voor factor.';
