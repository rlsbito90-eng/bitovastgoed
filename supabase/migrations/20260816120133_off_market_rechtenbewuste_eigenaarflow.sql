alter table public.off_market_signalen
  add column if not exists eigenaar_straat_huisnummer text,
  add column if not exists eigenaar_postcode text,
  add column if not exists eigenaar_plaats text,
  add column if not exists eigenaar_verzendadres text,
  add column if not exists eigenaar_rechtstype text,
  add column if not exists eigenaar_aandeel text,
  add column if not exists eigenaar_rechtssituatie text,
  add column if not exists bloot_eigenaar jsonb,
  add column if not exists eigenaar_controle_nodig boolean not null default false,
  add column if not exists eigenaar_controle_reden text;

comment on column public.off_market_signalen.eigenaar_verzendadres is
  'Samengesteld correspondentieadres van de primaire acquisitierechthebbende; afgeleid uit bronvelden en handmatig corrigeerbaar.';
comment on column public.off_market_signalen.eigenaar_rechtssituatie is
  'Afgeleide rechtssituatie: volle_eigendom, erfpacht, opstal, appartementsrecht, meerdere_rechten of onbekend.';
comment on column public.off_market_signalen.bloot_eigenaar is
  'Secundaire bloot-eigenaarinformatie wanneer een beperkt recht zoals erfpacht/opstal de primaire acquisitiegeadresseerde bepaalt.';
comment on column public.off_market_signalen.eigenaar_controle_nodig is
  'Exception-vlag voor dossiers die na automatische Kadasterinterpretatie nog handmatige eigenaarcontrole vereisen.';

create index if not exists idx_off_market_signalen_eigenaar_controle
  on public.off_market_signalen (eigenaar_controle_nodig)
  where eigenaar_controle_nodig = true;
