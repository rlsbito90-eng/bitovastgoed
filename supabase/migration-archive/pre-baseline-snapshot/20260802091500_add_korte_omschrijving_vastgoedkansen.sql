alter table public.vastgoedkansen
  add column if not exists korte_omschrijving text;

comment on column public.vastgoedkansen.korte_omschrijving is
  'Korte herkenbare omschrijving van het pand of de locatie; los van reden_interessant en volgende_actie_omschrijving.';
