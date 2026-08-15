-- IM/1-pager generator: extra inhoudsvelden + toggle per IM-sectie

-- 1) Tekstvelden voor IM-secties
ALTER TABLE public.objecten
  ADD COLUMN IF NOT EXISTS propositie text,
  ADD COLUMN IF NOT EXISTS objectomschrijving text,
  ADD COLUMN IF NOT EXISTS locatie_omschrijving text,
  ADD COLUMN IF NOT EXISTS technische_staat_omschrijving text,
  ADD COLUMN IF NOT EXISTS proces_voorwaarden text,
  ADD COLUMN IF NOT EXISTS dataroom_url text;

-- 2) Marktwaarde-indicatie (handmatig invulbaar, los van referentie-mediaan)
ALTER TABLE public.objecten
  ADD COLUMN IF NOT EXISTS marktwaarde_indicatie bigint,
  ADD COLUMN IF NOT EXISTS marktwaarde_bron text;

-- 3) Contactgegevens voor in IM/1-pager (los van verantwoordelijke profiel)
ALTER TABLE public.objecten
  ADD COLUMN IF NOT EXISTS contact_naam text,
  ADD COLUMN IF NOT EXISTS contact_functie text,
  ADD COLUMN IF NOT EXISTS contact_telefoon text,
  ADD COLUMN IF NOT EXISTS contact_email text;

-- 4) Gestructureerde JSON-velden
--    oppervlakten_per_verdieping: [{verdieping: "Begane grond", vvo: 320, bvo: 380, bestemming: "Retail"}]
--    financiele_scenarios: {huidig: {jaarhuur, bar, noi, opmerking}, marktconform: {...}, na_renovatie: {...}}
--    documentatie_status: {huurovereenkomst: "beschikbaar", taxatierapport: "op_aanvraag", ...}
--    im_secties_zichtbaar: {samenvatting: true, propositie: true, ...} (default alles true door fallback in code)
ALTER TABLE public.objecten
  ADD COLUMN IF NOT EXISTS oppervlakten_per_verdieping jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS financiele_scenarios jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS documentatie_status jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS im_secties_zichtbaar jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 5) Plattegronden onderscheiden van gewone foto's
ALTER TABLE public.object_fotos
  ADD COLUMN IF NOT EXISTS is_plattegrond boolean NOT NULL DEFAULT false;
