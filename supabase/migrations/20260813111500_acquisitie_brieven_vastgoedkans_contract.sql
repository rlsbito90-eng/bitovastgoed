-- BUILD 2.0C.1 — dossierbreed brief-/eventcontract voor Vastgoedkansen.
-- Additief en idempotent. Niet uitvoeren op productie zonder afzonderlijk expliciet akkoord.

alter table public.off_market_brieven
  add column if not exists vastgoedkans_id uuid null;
alter table public.off_market_brieven
  alter column signaal_id drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.off_market_brieven'::regclass and conname='off_market_brieven_vastgoedkans_id_fkey') then
    alter table public.off_market_brieven
      add constraint off_market_brieven_vastgoedkans_id_fkey
      foreign key (vastgoedkans_id) references public.vastgoedkansen(id)
      on update cascade on delete set null not valid;
    alter table public.off_market_brieven validate constraint off_market_brieven_vastgoedkans_id_fkey;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.off_market_brieven'::regclass and conname='off_market_brieven_exact_een_dossier_check') then
    alter table public.off_market_brieven
      add constraint off_market_brieven_exact_een_dossier_check
      check (num_nonnulls(signaal_id, vastgoedkans_id) = 1) not valid;
    alter table public.off_market_brieven validate constraint off_market_brieven_exact_een_dossier_check;
  end if;
end $$;

create index if not exists off_market_brieven_vastgoedkans_created_idx
  on public.off_market_brieven (vastgoedkans_id, created_at desc)
  where vastgoedkans_id is not null;

comment on column public.off_market_brieven.vastgoedkans_id is
  'Vastgoedkans-dossierbron. Exact één van signaal_id of vastgoedkans_id moet gevuld zijn.';

-- Consolideert het oudere dossierbrede eventcontract dat nog niet op CRM-productie staat.
alter table public.off_market_brief_events
  add column if not exists vastgoedkans_id uuid null,
  add column if not exists dossier_type text null,
  add column if not exists relatie_id uuid null,
  add column if not exists brief_nummer smallint null,
  add column if not exists respons_status text null,
  add column if not exists respons_uitkomst text null,
  add column if not exists volgende_actie text null,
  add column if not exists volgende_actie_op date null;
alter table public.off_market_brief_events
  alter column signaal_id drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.off_market_brief_events'::regclass and conname='off_market_brief_events_vastgoedkans_id_fkey') then
    alter table public.off_market_brief_events
      add constraint off_market_brief_events_vastgoedkans_id_fkey
      foreign key (vastgoedkans_id) references public.vastgoedkansen(id)
      on update cascade on delete set null not valid;
    alter table public.off_market_brief_events validate constraint off_market_brief_events_vastgoedkans_id_fkey;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.off_market_brief_events'::regclass and conname='off_market_brief_events_relatie_id_fkey') then
    alter table public.off_market_brief_events
      add constraint off_market_brief_events_relatie_id_fkey
      foreign key (relatie_id) references public.relaties(id)
      on update cascade on delete set null not valid;
    alter table public.off_market_brief_events validate constraint off_market_brief_events_relatie_id_fkey;
  end if;
end $$;

update public.off_market_brief_events
set dossier_type='off_market_signaal'
where dossier_type is null and signaal_id is not null and vastgoedkans_id is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.off_market_brief_events'::regclass and conname='off_market_brief_events_exact_een_dossier_check') then
    alter table public.off_market_brief_events add constraint off_market_brief_events_exact_een_dossier_check
      check (num_nonnulls(signaal_id, vastgoedkans_id) = 1) not valid;
    alter table public.off_market_brief_events validate constraint off_market_brief_events_exact_een_dossier_check;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.off_market_brief_events'::regclass and conname='off_market_brief_events_dossier_type_check') then
    alter table public.off_market_brief_events add constraint off_market_brief_events_dossier_type_check
      check (dossier_type in ('off_market_signaal','vastgoedkans')) not valid;
    alter table public.off_market_brief_events validate constraint off_market_brief_events_dossier_type_check;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.off_market_brief_events'::regclass and conname='off_market_brief_events_dossier_type_consistent_check') then
    alter table public.off_market_brief_events add constraint off_market_brief_events_dossier_type_consistent_check
      check ((dossier_type='off_market_signaal' and signaal_id is not null and vastgoedkans_id is null)
          or (dossier_type='vastgoedkans' and vastgoedkans_id is not null and signaal_id is null)) not valid;
    alter table public.off_market_brief_events validate constraint off_market_brief_events_dossier_type_consistent_check;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.off_market_brief_events'::regclass and conname='off_market_brief_events_brief_nummer_check') then
    alter table public.off_market_brief_events add constraint off_market_brief_events_brief_nummer_check
      check (brief_nummer is null or brief_nummer between 1 and 3) not valid;
    alter table public.off_market_brief_events validate constraint off_market_brief_events_brief_nummer_check;
  end if;
end $$;

alter table public.off_market_brief_events alter column dossier_type set not null;

create index if not exists off_market_brief_events_vastgoedkans_event_date_idx
  on public.off_market_brief_events (vastgoedkans_id, event_date desc)
  where vastgoedkans_id is not null;
create index if not exists off_market_brief_events_relatie_id_idx
  on public.off_market_brief_events (relatie_id)
  where relatie_id is not null;

comment on column public.off_market_brief_events.dossier_type is 'Expliciete dossierbron: off_market_signaal of vastgoedkans.';
comment on column public.off_market_brief_events.relatie_id is 'Handmatig bevestigde CRM-relatie; nooit automatisch gevuld op basis van naamherkenning.';
comment on column public.off_market_brief_events.brief_nummer is 'Briefnummer binnen de geadresseerde opvolgreeks: 1, 2 of 3.';
