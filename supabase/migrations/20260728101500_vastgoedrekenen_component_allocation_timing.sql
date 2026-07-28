-- Vastgoedrekenen Fase 4A — additieve componentallocatie en timing.
--
-- Veiligheidsregels:
-- - geen defaults of backfill op bestaande 57 sell_off_units;
-- - bestaande expected_sale_period_months wordt hergebruikt als verkoop-/ontvangstmaand;
-- - geen triggers en geen wijziging aan huidige rekenuitkomsten;
-- - alle nieuwe velden blijven nullable totdat de gebruiker ze expliciet vastlegt.

alter table public.sell_off_units
  add column if not exists allocation_percentage numeric(7,4),
  add column if not exists development_start_month integer,
  add column if not exists development_end_month integer,
  add column if not exists rent_start_month integer,
  add column if not exists hold_exit_month integer,
  add column if not exists allocation_timing_schema_version integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sell_off_units'::regclass
      and conname = 'sell_off_units_allocation_percentage_check'
  ) then
    alter table public.sell_off_units
      add constraint sell_off_units_allocation_percentage_check
      check (allocation_percentage is null or (allocation_percentage > 0 and allocation_percentage <= 100));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sell_off_units'::regclass
      and conname = 'sell_off_units_development_start_month_check'
  ) then
    alter table public.sell_off_units
      add constraint sell_off_units_development_start_month_check
      check (development_start_month is null or development_start_month between 0 and 1200);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sell_off_units'::regclass
      and conname = 'sell_off_units_development_end_month_check'
  ) then
    alter table public.sell_off_units
      add constraint sell_off_units_development_end_month_check
      check (development_end_month is null or development_end_month between 0 and 1200);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sell_off_units'::regclass
      and conname = 'sell_off_units_rent_start_month_check'
  ) then
    alter table public.sell_off_units
      add constraint sell_off_units_rent_start_month_check
      check (rent_start_month is null or rent_start_month between 0 and 1200);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sell_off_units'::regclass
      and conname = 'sell_off_units_expected_sale_period_months_check'
  ) then
    alter table public.sell_off_units
      add constraint sell_off_units_expected_sale_period_months_check
      check (expected_sale_period_months is null or expected_sale_period_months between 0 and 1200);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sell_off_units'::regclass
      and conname = 'sell_off_units_hold_exit_month_check'
  ) then
    alter table public.sell_off_units
      add constraint sell_off_units_hold_exit_month_check
      check (hold_exit_month is null or hold_exit_month between 0 and 1200);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sell_off_units'::regclass
      and conname = 'sell_off_units_development_period_order_check'
  ) then
    alter table public.sell_off_units
      add constraint sell_off_units_development_period_order_check
      check (
        development_start_month is null
        or development_end_month is null
        or development_end_month >= development_start_month
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sell_off_units'::regclass
      and conname = 'sell_off_units_rent_after_development_check'
  ) then
    alter table public.sell_off_units
      add constraint sell_off_units_rent_after_development_check
      check (
        development_end_month is null
        or rent_start_month is null
        or rent_start_month >= development_end_month
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sell_off_units'::regclass
      and conname = 'sell_off_units_sale_after_development_check'
  ) then
    alter table public.sell_off_units
      add constraint sell_off_units_sale_after_development_check
      check (
        development_end_month is null
        or expected_sale_period_months is null
        or expected_sale_period_months >= development_end_month
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sell_off_units'::regclass
      and conname = 'sell_off_units_hold_exit_after_rent_check'
  ) then
    alter table public.sell_off_units
      add constraint sell_off_units_hold_exit_after_rent_check
      check (
        rent_start_month is null
        or hold_exit_month is null
        or hold_exit_month >= rent_start_month
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sell_off_units'::regclass
      and conname = 'sell_off_units_allocation_timing_version_check'
  ) then
    alter table public.sell_off_units
      add constraint sell_off_units_allocation_timing_version_check
      check (
        allocation_timing_schema_version is null
        or (
          allocation_timing_schema_version > 0
          and allocation_percentage is not null
        )
      );
  end if;
end $$;

comment on column public.sell_off_units.allocation_percentage is
  'Aandeel van het gekoppelde component dat deze strategieregel vertegenwoordigt; legacy null wordt read-only als 100% geïnterpreteerd.';
comment on column public.sell_off_units.development_start_month is
  'Geheel aantal maanden na de Quickscan-peildatum waarop de fysieke ingreep start.';
comment on column public.sell_off_units.development_end_month is
  'Geheel aantal maanden na de Quickscan-peildatum waarop de fysieke ingreep eindigt/oplevert.';
comment on column public.sell_off_units.rent_start_month is
  'Geheel aantal maanden na de Quickscan-peildatum waarop exploitatiehuur start.';
comment on column public.sell_off_units.expected_sale_period_months is
  'Geheel aantal maanden na de Quickscan-peildatum waarop verkoopopbrengst wordt ontvangen.';
comment on column public.sell_off_units.hold_exit_month is
  'Optionele terminale exitmaand van een aangehouden component; null betekent aanhouden voorbij de horizon.';
comment on column public.sell_off_units.allocation_timing_schema_version is
  'Versie van het canonieke allocatie- en timingcontract; null betekent legacy/onbevestigd.';
