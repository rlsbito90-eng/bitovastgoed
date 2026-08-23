alter table public.off_market_brieven
  add column if not exists copy_profiel text,
  add column if not exists copy_variant_key text,
  add column if not exists copy_variant_code text,
  add column if not exists copy_hypothese text;

comment on column public.off_market_brieven.copy_profiel is
  'Genormaliseerd acquisitie-copyprofiel waarop de verzonden tekstvariant is gebaseerd.';
comment on column public.off_market_brieven.copy_variant_key is
  'Immutable meetidentiteit van de toegewezen copyvariant, bv woonvorming:post:brief_1:A.';
comment on column public.off_market_brieven.copy_variant_code is
  'Korte variantcode binnen een experiment, bv A/B/C/D.';
comment on column public.off_market_brieven.copy_hypothese is
  'Hypothese-snapshot van de variant op het moment van toewijzing.';

create index if not exists off_market_brieven_copy_variant_key_idx
  on public.off_market_brieven(copy_variant_key)
  where copy_variant_key is not null;

create index if not exists off_market_brieven_copy_profiel_idx
  on public.off_market_brieven(copy_profiel)
  where copy_profiel is not null;
