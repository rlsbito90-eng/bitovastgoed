do $$ begin create type public.off_market_assettype as enum ('kantoor','winkelpand','woon_winkelpand','bedrijfscomplex','light_industrial','logistiek','zorgvastgoed','transformatieobject','ontwikkellocatie','vastgoedportefeuille','overig'); exception when duplicate_object then null; end $$;
do $$ begin create type public.off_market_bron_type as enum ('handmatig','bekendmaking','vergunning','bag','kvk','nieuws','rss','csv','overig'); exception when duplicate_object then null; end $$;
do $$ begin create type public.off_market_signaaltype as enum ('vergunning_bekendmaking','functiewijziging','transformatiepotentie','leegstand','bedrijfsbeeindiging','lang_bezit','onderbenutte_locatie','vastgoednieuws','netwerk','handmatige_research','overig'); exception when duplicate_object then null; end $$;
do $$ begin create type public.off_market_prioriteit as enum ('laag','midden','hoog','urgent'); exception when duplicate_object then null; end $$;
do $$ begin create type public.off_market_status as enum ('nieuw_signaal','te_onderzoeken','eigenaar_achterhalen','benaderen','in_gesprek','object_ontvangen','dealtraject','niet_interessant','archief'); exception when duplicate_object then null; end $$;

create table if not exists public.off_market_bronnen (
 id uuid primary key default gen_random_uuid(), naam text not null, type public.off_market_bron_type not null default 'handmatig', endpoint_url text, auth_secret_naam text,
 actief boolean not null default true, config jsonb not null default '{}'::jsonb, laatste_run_op timestamptz, laatste_run_status text, laatste_fout text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select,insert,update,delete on public.off_market_bronnen to authenticated; grant all on public.off_market_bronnen to service_role;
alter table public.off_market_bronnen enable row level security;

do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_bronnen' and policyname='Intern leest off_market_bronnen') then create policy "Intern leest off_market_bronnen" on public.off_market_bronnen for select to authenticated using(public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_bronnen' and policyname='Intern voegt off_market_bronnen toe') then create policy "Intern voegt off_market_bronnen toe" on public.off_market_bronnen for insert to authenticated with check(public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_bronnen' and policyname='Intern wijzigt off_market_bronnen') then create policy "Intern wijzigt off_market_bronnen" on public.off_market_bronnen for update to authenticated using(public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_bronnen' and policyname='Intern verwijdert off_market_bronnen') then create policy "Intern verwijdert off_market_bronnen" on public.off_market_bronnen for delete to authenticated using(public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_trigger where tgname='trg_off_market_bronnen_updated' and not tgisinternal) then create trigger trg_off_market_bronnen_updated before update on public.off_market_bronnen for each row execute function public.update_updated_at_column(); end if;
end $$;

create table if not exists public.off_market_signalen (
 id uuid primary key default gen_random_uuid(), titel text not null, adres text, postcode text, plaats text, provincie text, regio text, lat numeric(10,7), lng numeric(10,7),
 assettype public.off_market_assettype not null default 'overig', bron_id uuid references public.off_market_bronnen(id) on delete set null,
 bron_type public.off_market_bron_type not null default 'handmatig', type_signaal public.off_market_signaaltype not null default 'handmatige_research', omschrijving text,
 eigenaar_bekend boolean not null default false, eigenaar_relatie_id uuid references public.relaties(id) on delete set null, potentiele_strategie text,
 indicatieve_waarde numeric(14,2), mogelijke_fee numeric(14,2), prioriteit public.off_market_prioriteit not null default 'midden', status public.off_market_status not null default 'nieuw_signaal',
 volgende_actie_datum date, volgende_actie_omschrijving text, notities text, bron_url text, bron_referentie text, bron_datum date,
 gekoppeld_object_id uuid references public.objecten(id) on delete set null, gekoppelde_deal_id uuid references public.deals(id) on delete set null,
 gearchiveerd_op timestamptz, archief_reden text, ai_score integer check(ai_score is null or ai_score between 0 and 100), ai_samenvatting text, ai_aanbevolen_actie text,
 ai_classificatie_assettype public.off_market_assettype, ai_strategie_suggestie text, ai_verkoopkans numeric(4,3) check(ai_verkoopkans is null or ai_verkoopkans between 0 and 1),
 ai_dedupe_groep_id uuid, ai_laatst_verrijkt_op timestamptz, ai_model text, ai_prompt_versie text,
 created_by uuid references auth.users(id) on delete set null, updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 search_tsv tsvector generated always as (setweight(to_tsvector('simple',coalesce(titel,'')),'A') || setweight(to_tsvector('simple',coalesce(adres,'')||' '||coalesce(plaats,'')),'B') || setweight(to_tsvector('simple',coalesce(omschrijving,'')),'C') || setweight(to_tsvector('simple',coalesce(notities,'')),'D')) stored
);
create index if not exists idx_off_market_signalen_status on public.off_market_signalen(status);
create index if not exists idx_off_market_signalen_prioriteit on public.off_market_signalen(prioriteit);
create index if not exists idx_off_market_signalen_assettype on public.off_market_signalen(assettype);
create index if not exists idx_off_market_signalen_provincie on public.off_market_signalen(provincie);
create index if not exists idx_off_market_signalen_vol_actie on public.off_market_signalen(volgende_actie_datum) where volgende_actie_datum is not null;
create index if not exists idx_off_market_signalen_ai_score on public.off_market_signalen(ai_score desc nulls last);
create index if not exists idx_off_market_signalen_search on public.off_market_signalen using gin(search_tsv);
grant select,insert,update,delete on public.off_market_signalen to authenticated; grant all on public.off_market_signalen to service_role;
alter table public.off_market_signalen enable row level security;

do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_signalen' and policyname='Intern leest off_market_signalen') then create policy "Intern leest off_market_signalen" on public.off_market_signalen for select to authenticated using(public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_signalen' and policyname='Intern voegt off_market_signalen toe') then create policy "Intern voegt off_market_signalen toe" on public.off_market_signalen for insert to authenticated with check(public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_signalen' and policyname='Intern wijzigt off_market_signalen') then create policy "Intern wijzigt off_market_signalen" on public.off_market_signalen for update to authenticated using(public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_signalen' and policyname='Intern verwijdert off_market_signalen') then create policy "Intern verwijdert off_market_signalen" on public.off_market_signalen for delete to authenticated using(public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_trigger where tgname='trg_off_market_signalen_updated' and not tgisinternal) then create trigger trg_off_market_signalen_updated before update on public.off_market_signalen for each row execute function public.update_updated_at_column(); end if;
end $$;

create table if not exists public.off_market_signalen_ruw (
 id uuid primary key default gen_random_uuid(), bron_id uuid not null references public.off_market_bronnen(id) on delete cascade, extern_id text not null,
 payload jsonb not null default '{}'::jsonb, dedupe_hash text, binnengekomen_op timestamptz not null default now(), verwerkt boolean not null default false,
 signaal_id uuid references public.off_market_signalen(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint uq_off_market_ruw_bron_extern unique(bron_id,extern_id)
);
create index if not exists idx_off_market_ruw_verwerkt on public.off_market_signalen_ruw(verwerkt,binnengekomen_op desc);
create index if not exists idx_off_market_ruw_dedupe on public.off_market_signalen_ruw(dedupe_hash) where dedupe_hash is not null;
grant select,insert,update,delete on public.off_market_signalen_ruw to authenticated; grant all on public.off_market_signalen_ruw to service_role;
alter table public.off_market_signalen_ruw enable row level security;

do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_signalen_ruw' and policyname='Intern leest off_market_ruw') then create policy "Intern leest off_market_ruw" on public.off_market_signalen_ruw for select to authenticated using(public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_signalen_ruw' and policyname='Intern voegt off_market_ruw toe') then create policy "Intern voegt off_market_ruw toe" on public.off_market_signalen_ruw for insert to authenticated with check(public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_signalen_ruw' and policyname='Intern wijzigt off_market_ruw') then create policy "Intern wijzigt off_market_ruw" on public.off_market_signalen_ruw for update to authenticated using(public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_signalen_ruw' and policyname='Intern verwijdert off_market_ruw') then create policy "Intern verwijdert off_market_ruw" on public.off_market_signalen_ruw for delete to authenticated using(public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_trigger where tgname='trg_off_market_ruw_updated' and not tgisinternal) then create trigger trg_off_market_ruw_updated before update on public.off_market_signalen_ruw for each row execute function public.update_updated_at_column(); end if;
end $$;

create table if not exists public.off_market_ai_runs (
 id uuid primary key default gen_random_uuid(), signaal_id uuid not null references public.off_market_signalen(id) on delete cascade, model text not null, prompt_versie text,
 input_hash text, output jsonb, kosten numeric(10,4), latentie_ms integer, run_op timestamptz not null default now(), succes boolean not null default true, fout text, created_at timestamptz not null default now()
);
create index if not exists idx_off_market_ai_runs_signaal on public.off_market_ai_runs(signaal_id,run_op desc);
grant select,insert,update,delete on public.off_market_ai_runs to authenticated; grant all on public.off_market_ai_runs to service_role;
alter table public.off_market_ai_runs enable row level security;

do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_ai_runs' and policyname='Intern leest off_market_ai_runs') then create policy "Intern leest off_market_ai_runs" on public.off_market_ai_runs for select to authenticated using(public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_ai_runs' and policyname='Intern voegt off_market_ai_runs toe') then create policy "Intern voegt off_market_ai_runs toe" on public.off_market_ai_runs for insert to authenticated with check(public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_ai_runs' and policyname='Intern wijzigt off_market_ai_runs') then create policy "Intern wijzigt off_market_ai_runs" on public.off_market_ai_runs for update to authenticated using(public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_ai_runs' and policyname='Intern verwijdert off_market_ai_runs') then create policy "Intern verwijdert off_market_ai_runs" on public.off_market_ai_runs for delete to authenticated using(public.is_intern_gebruiker(auth.uid())); end if;
end $$;

alter table public.contact_moments add column if not exists off_market_signaal_id uuid references public.off_market_signalen(id) on delete set null;
create index if not exists idx_contact_moments_off_market on public.contact_moments(off_market_signaal_id) where off_market_signaal_id is not null;
alter table public.taken add column if not exists off_market_signaal_id uuid references public.off_market_signalen(id) on delete set null;
create index if not exists idx_taken_off_market on public.taken(off_market_signaal_id) where off_market_signaal_id is not null;

create or replace view public.view_off_market_kpi with (security_invoker=true) as
select count(*) filter(where created_at>=date_trunc('week',now())) as nieuwe_deze_week,
 count(*) filter(where prioriteit in ('hoog','urgent') and status not in ('archief','niet_interessant')) as hoge_prioriteit,
 count(*) filter(where status='te_onderzoeken') as te_onderzoeken,
 count(*) filter(where status in ('eigenaar_achterhalen','benaderen')) as eigenaren_te_benaderen,
 count(*) filter(where status='in_gesprek') as in_gesprek,
 count(*) filter(where status='object_ontvangen') as objecten_ontvangen,
 coalesce(sum(mogelijke_fee) filter(where status not in ('archief','niet_interessant')),0)::numeric(14,2) as fee_pipeline
from public.off_market_signalen;
grant select on public.view_off_market_kpi to authenticated,service_role;