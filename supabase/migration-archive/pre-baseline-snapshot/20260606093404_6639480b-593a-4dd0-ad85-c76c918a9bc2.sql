
-- Nieuwe enums voor acquisitie-grid
CREATE TYPE public.off_market_vergunningtype AS ENUM (
  'splitsing', 'woonvorming', 'omzetting', 'onttrekking',
  'functiewijziging', 'transformatie', 'ontwikkeling', 'overig'
);

CREATE TYPE public.off_market_aanvraag_besluit AS ENUM (
  'aanvraag', 'besluit', 'melding', 'onbekend'
);

ALTER TABLE public.off_market_signalen
  ADD COLUMN vergunningtype public.off_market_vergunningtype,
  ADD COLUMN aanvraag_of_besluit public.off_market_aanvraag_besluit;

CREATE INDEX idx_off_market_signalen_vergunningtype
  ON public.off_market_signalen (vergunningtype)
  WHERE vergunningtype IS NOT NULL;
