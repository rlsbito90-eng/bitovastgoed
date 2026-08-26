alter table if exists public.off_market_acquisitie_selectie
  add column if not exists werkvoorraad_status text not null default 'actief',
  add column if not exists werkvoorraad_reden text null,
  add column if not exists werkvoorraad_volgende_actie_op date null,
  add column if not exists werkvoorraad_bijgewerkt_op timestamptz null,
  add column if not exists werkvoorraad_bijgewerkt_door uuid null references auth.users(id) on delete set null;

alter table public.off_market_acquisitie_selectie
  drop constraint if exists off_market_acquisitie_selectie_werkvoorraad_status_chk;

alter table public.off_market_acquisitie_selectie
  add constraint off_market_acquisitie_selectie_werkvoorraad_status_chk
  check (werkvoorraad_status in (
    'actief',
    'gebundeld_bij_partij',
    'eerder_benaderd',
    'benadering_bepalen',
    'niet_benaderen'
  ));

create index if not exists off_market_acquisitie_selectie_werkvoorraad_status_idx
  on public.off_market_acquisitie_selectie (werkvoorraad_status, werkvoorraad_volgende_actie_op)
  where archived_at is null;

create index if not exists off_market_acquisitie_selectie_werkvoorraad_actor_idx
  on public.off_market_acquisitie_selectie (werkvoorraad_bijgewerkt_door)
  where werkvoorraad_bijgewerkt_door is not null;

comment on column public.off_market_acquisitie_selectie.werkvoorraad_status is
  'Handmatige werkvoorraadindeling. Niet-actieve dossiers blijven in de acquisitieselectie en historie bewaard.';
