-- BUILD A — ACQUISITIEPRODUCTIEKERN
-- NIET AUTOMATISCH TOEPASSEN.
-- Dit bestand staat bewust buiten supabase/migrations en is uitsluitend een
-- reviewbaar migratieconcept. Productietoepassing, backfill en activatie
-- vereisen afzonderlijk expliciet akkoord en een groene geïsoleerde proef.

begin;

-- ---------------------------------------------------------------------------
-- 1. Nummerreeksen
-- ---------------------------------------------------------------------------

create table if not exists public.off_market_productie_nummerreeksen (
  reeks_type text not null,
  reeks_sleutel text not null,
  laatste_nummer integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint off_market_productie_nummerreeksen_pk
    primary key (reeks_type, reeks_sleutel),
  constraint off_market_productie_nummerreeksen_type_chk
    check (reeks_type in ('brief', 'batch')),
  constraint off_market_productie_nummerreeksen_nummer_chk
    check (laatste_nummer >= 0)
);

comment on table public.off_market_productie_nummerreeksen is
  'Interne, uitsluitend via beveiligde functies muteerbare nummerreeksen voor brieven en printbatches.';

-- ---------------------------------------------------------------------------
-- 2. Briefversies
-- ---------------------------------------------------------------------------

create table if not exists public.off_market_brief_versies (
  id uuid primary key,
  brief_id uuid not null,
  versienummer integer not null,
  status text not null default 'actief',
  inhoud_snapshot jsonb not null,
  geadresseerde_snapshot jsonb not null,
  template_id text null,
  template_versie text null,
  bestand_referentie text null,
  aangemaakt_door uuid null,
  created_at timestamptz not null default now(),
  vervallen_op timestamptz null,
  verzonden_op timestamptz null,
  constraint off_market_brief_versies_versienummer_chk
    check (versienummer >= 1),
  constraint off_market_brief_versies_status_chk
    check (status in ('actief', 'vervallen', 'verzonden')),
  constraint off_market_brief_versies_status_datums_chk
    check (
      (status = 'actief' and vervallen_op is null and verzonden_op is null)
      or (status = 'vervallen' and vervallen_op is not null and verzonden_op is null)
      or (status = 'verzonden' and verzonden_op is not null)
    ),
  constraint off_market_brief_versies_brief_versie_uq
    unique (brief_id, versienummer)
);

create unique index if not exists off_market_brief_versies_een_actieve_uq
  on public.off_market_brief_versies (brief_id)
  where status = 'actief';

comment on table public.off_market_brief_versies is
  'Immutabele inhouds- en geadresseerdesnapshots per briefversie.';

-- ---------------------------------------------------------------------------
-- 3. Printbatches
-- ---------------------------------------------------------------------------

create table if not exists public.off_market_printbatches (
  id uuid primary key,
  batchnummer text not null,
  status text not null default 'concept',
  documentversie integer not null default 1,
  aanvulling_op_batch_id uuid null,
  aangemaakt_door uuid null,
  created_at timestamptz not null default now(),
  heropend_op timestamptz null,
  printdatum timestamptz null,
  verzenddatum timestamptz null,
  geannuleerd_op timestamptz null,
  annuleringsreden text null,
  constraint off_market_printbatches_batchnummer_uq unique (batchnummer),
  constraint off_market_printbatches_batchnummer_chk
    check (batchnummer ~ '^BAT[0-9]{10}$'),
  constraint off_market_printbatches_documentversie_chk
    check (documentversie >= 1),
  constraint off_market_printbatches_status_chk
    check (status in (
      'concept',
      'documenten_gegenereerd',
      'geprint',
      'gedeeltelijk_gepost',
      'gepost',
      'geannuleerd'
    )),
  constraint off_market_printbatches_status_datums_chk
    check (
      (status in ('concept', 'documenten_gegenereerd')
        and printdatum is null and verzenddatum is null and geannuleerd_op is null)
      or (status = 'geprint'
        and printdatum is not null and verzenddatum is null and geannuleerd_op is null)
      or (status = 'gedeeltelijk_gepost'
        and printdatum is not null and verzenddatum is not null and geannuleerd_op is null)
      or (status = 'gepost'
        and printdatum is not null and verzenddatum is not null and geannuleerd_op is null)
      or (status = 'geannuleerd'
        and geannuleerd_op is not null and nullif(trim(annuleringsreden), '') is not null)
    ),
  constraint off_market_printbatches_aanvulling_fk
    foreign key (aanvulling_op_batch_id)
    references public.off_market_printbatches (id)
    on delete restrict
);

comment on table public.off_market_printbatches is
  'Versiebeheerde productie-eenheid voor brieven, labels, controlelijst en batchvoorblad.';

-- ---------------------------------------------------------------------------
-- 4. Batch ↔ briefversie
-- ---------------------------------------------------------------------------

create table if not exists public.off_market_printbatch_brieven (
  id uuid primary key,
  batch_id uuid not null,
  brief_id uuid not null,
  brief_versie_id uuid not null,
  toegevoegd_door uuid null,
  created_at timestamptz not null default now(),
  verwijderd_op timestamptz null,
  afwijkingsstatus text null,
  afwijkingsreden text null,
  constraint off_market_printbatch_brieven_batch_fk
    foreign key (batch_id)
    references public.off_market_printbatches (id)
    on delete restrict,
  constraint off_market_printbatch_brieven_versie_fk
    foreign key (brief_versie_id)
    references public.off_market_brief_versies (id)
    on delete restrict,
  constraint off_market_printbatch_brieven_afwijking_chk
    check (
      afwijkingsstatus is null
      or afwijkingsstatus in ('herdruk', 'niet_geprint', 'niet_gepost', 'retour', 'anders')
    ),
  constraint off_market_printbatch_brieven_afwijkingsreden_chk
    check (
      afwijkingsstatus is null
      or nullif(trim(afwijkingsreden), '') is not null
    )
);

create unique index if not exists off_market_printbatch_brieven_actieve_versie_uq
  on public.off_market_printbatch_brieven (brief_versie_id)
  where verwijderd_op is null;

create unique index if not exists off_market_printbatch_brieven_batch_versie_uq
  on public.off_market_printbatch_brieven (batch_id, brief_versie_id)
  where verwijderd_op is null;

comment on table public.off_market_printbatch_brieven is
  'Logische, historiseerbare koppeling van één specifieke briefversie aan één actieve batch.';

-- ---------------------------------------------------------------------------
-- 5. Batchdocumenten
-- ---------------------------------------------------------------------------

create table if not exists public.off_market_batchdocumenten (
  id uuid primary key,
  batch_id uuid not null,
  documentversie integer not null,
  documenttype text not null,
  bestand_referentie text not null,
  status text not null default 'actief',
  metadata jsonb not null default '{}'::jsonb,
  aangemaakt_door uuid null,
  created_at timestamptz not null default now(),
  vervallen_op timestamptz null,
  constraint off_market_batchdocumenten_batch_fk
    foreign key (batch_id)
    references public.off_market_printbatches (id)
    on delete restrict,
  constraint off_market_batchdocumenten_documentversie_chk
    check (documentversie >= 1),
  constraint off_market_batchdocumenten_type_chk
    check (documenttype in ('brieven_pdf', 'adreslabels', 'controlelijst', 'batchvoorblad')),
  constraint off_market_batchdocumenten_status_chk
    check (status in ('actief', 'vervallen')),
  constraint off_market_batchdocumenten_status_datum_chk
    check (
      (status = 'actief' and vervallen_op is null)
      or (status = 'vervallen' and vervallen_op is not null)
    ),
  constraint off_market_batchdocumenten_batch_type_versie_uq
    unique (batch_id, documenttype, documentversie)
);

create unique index if not exists off_market_batchdocumenten_een_actief_type_uq
  on public.off_market_batchdocumenten (batch_id, documenttype)
  where status = 'actief';

comment on table public.off_market_batchdocumenten is
  'Versiebeheerde verwijzingen naar gegenereerde batchdocumenten; bevat geen bestandbytes.';

-- ---------------------------------------------------------------------------
-- 6. Kritieke productieaudit
-- ---------------------------------------------------------------------------

create table if not exists public.off_market_productie_events (
  id uuid primary key,
  operation_key text not null,
  event_type text not null,
  signaal_id uuid null,
  selectie_id uuid null,
  brief_id uuid null,
  brief_versie_id uuid null,
  batch_id uuid null,
  batchdocument_id uuid null,
  actor_id uuid null,
  event_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint off_market_productie_events_operation_key_uq unique (operation_key),
  constraint off_market_productie_events_type_chk
    check (event_type in (
      'verwerking_gestart',
      'briefnummer_uitgegeven',
      'briefversie_aangemaakt',
      'briefversie_vervallen',
      'brief_geannuleerd',
      'batchnummer_uitgegeven',
      'brief_aan_batch_toegevoegd',
      'brief_uit_batch_verwijderd',
      'batch_heropend',
      'documenten_gegenereerd',
      'batch_geprint',
      'brief_gepost',
      'batch_gepost',
      'afwijking_geregistreerd',
      'herdruk_geregistreerd'
    ))
);

comment on table public.off_market_productie_events is
  'Append-only audittrail voor kritieke, transactionele productiehandelingen.';

-- ---------------------------------------------------------------------------
-- 7. Atomische nummerfuncties
-- ---------------------------------------------------------------------------

create or replace function public.reserveer_off_market_briefnummer(p_jaar integer)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_volgnummer integer;
begin
  if p_jaar < 2000 or p_jaar > 9999 then
    raise exception 'Ongeldig jaar voor briefnummer: %', p_jaar
      using errcode = '22023';
  end if;

  insert into public.off_market_productie_nummerreeksen (
    reeks_type,
    reeks_sleutel,
    laatste_nummer
  ) values (
    'brief',
    p_jaar::text,
    1
  )
  on conflict (reeks_type, reeks_sleutel)
  do update set
    laatste_nummer = public.off_market_productie_nummerreeksen.laatste_nummer + 1,
    updated_at = now()
  returning laatste_nummer into v_volgnummer;

  if v_volgnummer > 999999 then
    raise exception 'Briefnummerreeks voor % is uitgeput', p_jaar
      using errcode = '22003';
  end if;

  return 'BR' || p_jaar::text || lpad(v_volgnummer::text, 6, '0');
end;
$$;

create or replace function public.reserveer_off_market_batchnummer(p_datum date)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sleutel text;
  v_volgnummer integer;
begin
  if p_datum is null then
    raise exception 'Batchdatum is verplicht'
      using errcode = '22004';
  end if;

  v_sleutel := to_char(p_datum, 'YYYYMMDD');

  insert into public.off_market_productie_nummerreeksen (
    reeks_type,
    reeks_sleutel,
    laatste_nummer
  ) values (
    'batch',
    v_sleutel,
    1
  )
  on conflict (reeks_type, reeks_sleutel)
  do update set
    laatste_nummer = public.off_market_productie_nummerreeksen.laatste_nummer + 1,
    updated_at = now()
  returning laatste_nummer into v_volgnummer;

  if v_volgnummer > 99 then
    raise exception 'Batchnummerreeks voor % is uitgeput', p_datum
      using errcode = '22003';
  end if;

  return 'BAT' || v_sleutel || lpad(v_volgnummer::text, 2, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Standaard gesloten beveiligingshouding
-- ---------------------------------------------------------------------------

alter table public.off_market_productie_nummerreeksen enable row level security;
alter table public.off_market_brief_versies enable row level security;
alter table public.off_market_printbatches enable row level security;
alter table public.off_market_printbatch_brieven enable row level security;
alter table public.off_market_batchdocumenten enable row level security;
alter table public.off_market_productie_events enable row level security;

revoke all on table public.off_market_productie_nummerreeksen from anon, authenticated;
revoke all on table public.off_market_brief_versies from anon, authenticated;
revoke all on table public.off_market_printbatches from anon, authenticated;
revoke all on table public.off_market_printbatch_brieven from anon, authenticated;
revoke all on table public.off_market_batchdocumenten from anon, authenticated;
revoke all on table public.off_market_productie_events from anon, authenticated;

revoke all on function public.reserveer_off_market_briefnummer(integer) from public, anon, authenticated;
revoke all on function public.reserveer_off_market_batchnummer(date) from public, anon, authenticated;

-- Policies en gerichte execute-grants worden pas toegevoegd nadat actuele
-- productie-RLS, rollen en autorisatiehelpers read-only zijn geverifieerd.

rollback;

-- Het expliciete ROLLBACK onderstreept dat dit bestand een review- en
-- proefcontract is. Voor een echte migratie moet een afzonderlijk, beoordeeld
-- bestand worden gemaakt zonder rollback en uitsluitend na expliciet akkoord.
