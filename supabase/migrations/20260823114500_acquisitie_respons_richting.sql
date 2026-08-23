alter table public.off_market_brieven
  add column if not exists respons_richting text null;

alter table public.off_market_brieven
  drop constraint if exists off_market_brieven_respons_richting_check;

alter table public.off_market_brieven
  add constraint off_market_brieven_respons_richting_check
  check (respons_richting is null or respons_richting in ('verkoper','koper','beide','overig_onbekend'));

comment on column public.off_market_brieven.respons_richting is
  'Commerciële richting van een geregistreerde respons: verkoper, koper, beide of overig/onbekend.';
