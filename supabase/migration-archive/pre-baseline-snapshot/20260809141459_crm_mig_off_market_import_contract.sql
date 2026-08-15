do $$ begin create type public.off_market_run_modus as enum ('test','sync','backfill','handmatig'); exception when duplicate_object then null; end $$;
do $$ begin create type public.off_market_run_status as enum ('bezig','ok','fout','afgebroken'); exception when duplicate_object then null; end $$;
alter table public.off_market_bronnen
 add column if not exists auto_import boolean not null default false,
 add column if not exists auto_verwerken boolean not null default false,
 add column if not exists frequentie text not null default 'handmatig',
 add column if not exists dag_van_week smallint,
 add column if not exists tijdstip_uur smallint not null default 6,
 add column if not exists tijdstip_minuut smallint not null default 0,
 add column if not exists max_records_per_run int not null default 500,
 add column if not exists normalize_batch_size int not null default 200,
 add column if not exists lookback_days_default int not null default 7,
 add column if not exists lookback_overlap_uren int not null default 24,
 add column if not exists volgende_run_op timestamptz,
 add column if not exists laatste_sync_op timestamptz,
 add column if not exists auto_start_op date,
 add column if not exists backfill_vanaf date,
 add column if not exists backfill_tot date,
 add column if not exists backfill_cursor integer not null default 0,
 add column if not exists backfill_server_total integer,
 add column if not exists backfill_status text not null default 'niet_gestart';

do $$ begin alter table public.off_market_bronnen add constraint off_market_bronnen_frequentie_check check(frequentie in ('handmatig','dagelijks','wekelijks','maandelijks')); exception when duplicate_object then null; end $$;
do $$ begin alter table public.off_market_bronnen add constraint off_market_bronnen_dag_van_week_chk check(dag_van_week is null or dag_van_week between 1 and 7); exception when duplicate_object then null; end $$;
do $$ begin alter table public.off_market_bronnen add constraint off_market_bronnen_tijdstip_uur_chk check(tijdstip_uur between 0 and 23); exception when duplicate_object then null; end $$;
do $$ begin alter table public.off_market_bronnen add constraint off_market_bronnen_tijdstip_minuut_chk check(tijdstip_minuut in (0,15,30,45)); exception when duplicate_object then null; end $$;
do $$ begin alter table public.off_market_bronnen add constraint off_market_bronnen_max_records_chk check(max_records_per_run between 1 and 5000); exception when duplicate_object then null; end $$;
do $$ begin alter table public.off_market_bronnen add constraint off_market_bronnen_normalize_batch_chk check(normalize_batch_size between 1 and 2000); exception when duplicate_object then null; end $$;
do $$ begin alter table public.off_market_bronnen add constraint off_market_bronnen_lookback_days_chk check(lookback_days_default between 1 and 365); exception when duplicate_object then null; end $$;
do $$ begin alter table public.off_market_bronnen add constraint off_market_bronnen_lookback_overlap_chk check(lookback_overlap_uren between 0 and 168); exception when duplicate_object then null; end $$;
do $$ begin alter table public.off_market_bronnen add constraint off_market_bronnen_backfill_status_chk check(backfill_status in ('niet_gestart','bezig','gepauzeerd','voltooid','fout')); exception when duplicate_object then null; end $$;
do $$ begin alter table public.off_market_bronnen add constraint off_market_bronnen_backfill_cursor_chk check(backfill_cursor>=0); exception when duplicate_object then null; end $$;

create table if not exists public.off_market_import_runs (
 id uuid not null default gen_random_uuid() primary key, bron_id uuid not null references public.off_market_bronnen(id) on delete cascade, modus public.off_market_run_modus not null,
 status public.off_market_run_status not null default 'bezig', gestart_op timestamptz not null default now(), afgerond_op timestamptz, query_vanaf timestamptz, query_tot timestamptz,
 query_url text, server_total int, opgehaald int not null default 0, nieuw int not null default 0, dubbel int not null default 0, verwerkt int not null default 0,
 gepromoveerd int not null default 0, merged int not null default 0, geskipt int not null default 0, cursor_start int, cursor_eind int, foutmelding text, duration_ms int,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists off_market_import_runs_bron_gestart_idx on public.off_market_import_runs(bron_id,gestart_op desc);
create index if not exists off_market_import_runs_modus_idx on public.off_market_import_runs(modus);
grant select on public.off_market_import_runs to authenticated; grant all on public.off_market_import_runs to service_role;
alter table public.off_market_import_runs enable row level security;
do $$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_import_runs' and policyname='Intern leest off_market_import_runs') then create policy "Intern leest off_market_import_runs" on public.off_market_import_runs for select to authenticated using(public.is_intern_gebruiker(auth.uid())); end if; if not exists(select 1 from pg_trigger where tgname='trg_off_market_import_runs_updated' and not tgisinternal) then create trigger trg_off_market_import_runs_updated before update on public.off_market_import_runs for each row execute function public.update_updated_at_column(); end if; end $$;