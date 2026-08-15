-- TRACK-2 release 2 — reconciliatie van reeds toegepaste productiemigratie.

create table if not exists public.off_market_acquisitie_dossiers (
  id uuid primary key,
  selectie_id uuid not null,
  signaal_id uuid not null,
  object_id uuid null,
  verwerking_gestart_op timestamptz null,
  verwerking_gestart_door uuid null,
  primaire_werkbak text not null default 'nieuwe_selectie',
  volgende_actie_op timestamptz null,
  volgende_actie_omschrijving text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint off_market_acquisitie_dossiers_selectie_uq unique (selectie_id),
  constraint off_market_acquisitie_dossiers_werkbak_chk check (primaire_werkbak in ('nieuwe_selectie','eigenaar_achterhalen','brief_opstellen','printklaar','geprint_posten','opvolgen','wachten','afgehandeld')),
  constraint off_market_acquisitie_dossiers_verwerking_chk check (
    (primaire_werkbak='nieuwe_selectie' and verwerking_gestart_op is null)
    or (primaire_werkbak<>'nieuwe_selectie' and verwerking_gestart_op is not null)
  )
);
create index if not exists off_market_acquisitie_dossiers_signaal_idx on public.off_market_acquisitie_dossiers(signaal_id);
create index if not exists off_market_acquisitie_dossiers_werkbak_actie_idx on public.off_market_acquisitie_dossiers(primaire_werkbak, volgende_actie_op);

alter table if exists public.off_market_brieven
  add column if not exists briefnummer text null,
  add column if not exists selectie_id uuid null,
  add column if not exists object_id uuid null,
  add column if not exists relatie_id uuid null,
  add column if not exists actieve_versie integer null,
  add column if not exists vervanging_van_brief_id uuid null,
  add column if not exists definitief_op timestamptz null,
  add column if not exists vergrendeld_op timestamptz null,
  add column if not exists annuleringsreden text null;

do $$
declare v_status_constraint text;
begin
  select pg_get_constraintdef(c.oid) into v_status_constraint
  from pg_constraint c
  where c.conrelid='public.off_market_brieven'::regclass
    and c.conname='off_market_brieven_status_check'
    and c.contype='c';
  if v_status_constraint is not null then
    if position('concept' in lower(v_status_constraint))=0 or position('verstuurd' in lower(v_status_constraint))=0 then
      raise exception 'onverwachte_off_market_brieven_status_constraint';
    end if;
    alter table public.off_market_brieven drop constraint off_market_brieven_status_check;
  end if;
  alter table public.off_market_brieven add constraint off_market_brieven_status_check
    check (status in ('concept','verstuurd','definitief','geannuleerd')) not valid;
end; $$;

alter table if exists public.off_market_brieven
  add constraint off_market_brieven_briefnummer_chk check (briefnummer is null or briefnummer ~ '^BR[0-9]{10}$') not valid,
  add constraint off_market_brieven_actieve_versie_chk check (actieve_versie is null or actieve_versie >= 1) not valid,
  add constraint off_market_brieven_definitief_nummer_chk check (status <> 'definitief' or briefnummer is not null) not valid,
  add constraint off_market_brieven_geannuleerd_reden_chk check (status <> 'geannuleerd' or nullif(trim(annuleringsreden), '') is not null) not valid,
  add constraint off_market_brieven_vergrendeling_chk check (status <> 'concept' or vergrendeld_op is null) not valid;

create unique index if not exists off_market_brieven_briefnummer_uq on public.off_market_brieven(briefnummer) where briefnummer is not null;
create index if not exists off_market_brieven_selectie_idx on public.off_market_brieven(selectie_id);
create index if not exists off_market_brieven_object_idx on public.off_market_brieven(object_id);

alter table public.off_market_acquisitie_dossiers enable row level security;
revoke all on table public.off_market_acquisitie_dossiers from anon, authenticated;
