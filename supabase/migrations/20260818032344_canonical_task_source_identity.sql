-- Canonieke bronidentiteit voor taken die een domeinactie representeren.
--
-- Doel:
-- - één actuele taak per logische bronactie;
-- - datum/omschrijving wijzigen => dezelfde actieve taak bijwerken;
-- - afgeronde/geannuleerde taken blijven historie en blokkeren geen nieuwe cyclus;
-- - handmatig aangemaakte taken blijven source_* = null.

alter table public.taken
  add column if not exists source_kind text,
  add column if not exists source_id uuid,
  add column if not exists source_slot text;

comment on column public.taken.source_kind is
  'Semantische bron van een automatisch/gesynchroniseerd taakslot, bv deal, object_pipeline, vastgoedkans, off_market_signaal, contactmoment.';
comment on column public.taken.source_id is
  'ID van het bronrecord waarvoor deze taak de canonieke actuele actie representeert.';
comment on column public.taken.source_slot is
  'Stabiel actietype binnen de bron, bv follow_up, volgende_actie, post_opvolging. Niet gebruiken voor vrije omschrijving.';

create index if not exists idx_taken_source_identity
  on public.taken (source_kind, source_id, source_slot)
  where source_kind is not null
    and source_id is not null
    and source_slot is not null
    and soft_deleted_at is null;

-- Eén actieve taak per gebruiker × bron × actieslot.
-- Zodra een taak afgerond/geannuleerd is, mag een nieuwe taak voor een latere cyclus
-- met dezelfde bronidentiteit ontstaan zonder de audit-/taakhistorie te overschrijven.
create unique index if not exists uq_taken_active_source_slot_per_user
  on public.taken (owner_user_id, source_kind, source_id, source_slot)
  where owner_user_id is not null
    and source_kind is not null
    and source_id is not null
    and source_slot is not null
    and soft_deleted_at is null
    and status in ('open', 'in_uitvoering', 'wacht_op_reactie');

-- Guardrail: source-identiteit is alles-of-niets. Handmatige taken mogen alle drie null zijn.
alter table public.taken
  drop constraint if exists taken_source_identity_complete;

alter table public.taken
  add constraint taken_source_identity_complete check (
    (source_kind is null and source_id is null and source_slot is null)
    or
    (source_kind is not null and source_id is not null and source_slot is not null)
  );
