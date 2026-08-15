alter table public.vastgoedkansen
  add column if not exists eigenaar_naam text,
  add column if not exists eigenaar_bron text,
  add column if not exists eigenaar_laatst_gecontroleerd_op date,
  add column if not exists kadaster_status text not null default 'niet_gestart',
  add column if not exists kadastrale_aanduiding text,
  add column if not exists kadaster_laatst_gecontroleerd_op date,
  add column if not exists onderzoeksnotities text;

alter table public.vastgoedkansen
  drop constraint if exists vastgoedkansen_kadaster_status_check;

alter table public.vastgoedkansen
  add constraint vastgoedkansen_kadaster_status_check
  check (kadaster_status in ('niet_gestart','handmatig_onderzoek','gegevens_bekend','niet_gevonden'));
