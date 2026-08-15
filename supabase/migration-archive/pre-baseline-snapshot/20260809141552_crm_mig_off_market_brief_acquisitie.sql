create table if not exists public.off_market_brieven (
 id uuid primary key default gen_random_uuid(), signaal_id uuid not null references public.off_market_signalen(id) on delete cascade,
 eigenaar_naam text, eigenaar_bedrijfsnaam text, verzendadres text, objectadres text, objectomschrijving text, aanhef text, onderwerp text,
 brieftekst text not null, status text not null default 'concept', verzonden_op timestamptz, aangemaakt_door uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz, archived_reason text,
 constraint off_market_brieven_status_check check(status in ('concept','verstuurd'))
);
grant select,insert,update,delete on public.off_market_brieven to authenticated; grant all on public.off_market_brieven to service_role;
alter table public.off_market_brieven enable row level security;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_brieven' and policyname='Interne gebruikers kunnen brieven lezen') then create policy "Interne gebruikers kunnen brieven lezen" on public.off_market_brieven for select to authenticated using(public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_brieven' and policyname='Interne gebruikers kunnen brieven aanmaken') then create policy "Interne gebruikers kunnen brieven aanmaken" on public.off_market_brieven for insert to authenticated with check(public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_brieven' and policyname='Interne gebruikers kunnen brieven bijwerken') then create policy "Interne gebruikers kunnen brieven bijwerken" on public.off_market_brieven for update to authenticated using(public.is_intern_gebruiker(auth.uid())) with check(public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_brieven' and policyname='Interne gebruikers kunnen brieven verwijderen') then create policy "Interne gebruikers kunnen brieven verwijderen" on public.off_market_brieven for delete to authenticated using(public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_trigger where tgname='trg_off_market_brieven_updated_at' and not tgisinternal) then create trigger trg_off_market_brieven_updated_at before update on public.off_market_brieven for each row execute function public.update_updated_at_column(); end if;
end $$;
create index if not exists idx_off_market_brieven_signaal on public.off_market_brieven(signaal_id);
create index if not exists off_market_brieven_signaal_active_idx on public.off_market_brieven(signaal_id) where archived_at is null;

alter table public.off_market_brieven
 add column if not exists kanaal text not null default 'post', add column if not exists campagne_stap text, add column if not exists geadresseerde_key text,
 add column if not exists printdatum date, add column if not exists postdatum date, add column if not exists verzendstatus text not null default 'concept',
 add column if not exists opvolgdatum date, add column if not exists gekoppelde_taak_id uuid references public.taken(id) on delete set null,
 add column if not exists responsstatus text, add column if not exists responsdatum date, add column if not exists respons_kanaal text, add column if not exists respons_samenvatting text;
create index if not exists idx_off_market_brieven_signaal_geadresseerde on public.off_market_brieven(signaal_id,geadresseerde_key);
create index if not exists idx_off_market_brieven_signaal_opvolgdatum on public.off_market_brieven(signaal_id,opvolgdatum);

create table if not exists public.off_market_brief_events (
 id uuid primary key default gen_random_uuid(), signaal_id uuid not null references public.off_market_signalen(id) on delete cascade,
 brief_id uuid references public.off_market_brieven(id) on delete cascade, geadresseerde_key text, campagne_stap text, kanaal text, event_type text not null,
 event_date timestamptz not null default now(), status text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), created_by uuid references auth.users(id) on delete set null
);
create index if not exists idx_off_market_brief_events_signaal on public.off_market_brief_events(signaal_id,event_date desc);
create index if not exists idx_off_market_brief_events_brief on public.off_market_brief_events(brief_id,event_date desc);
grant select,insert on public.off_market_brief_events to authenticated; grant all on public.off_market_brief_events to service_role;
alter table public.off_market_brief_events enable row level security;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_brief_events' and policyname='Interne gebruikers lezen briefevents') then create policy "Interne gebruikers lezen briefevents" on public.off_market_brief_events for select to authenticated using(public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_brief_events' and policyname='Interne gebruikers insert briefevents') then create policy "Interne gebruikers insert briefevents" on public.off_market_brief_events for insert to authenticated with check(public.is_intern_gebruiker(auth.uid())); end if;
end $$;

create table if not exists public.off_market_acquisitie_selectie (
 id uuid primary key default gen_random_uuid(), signaal_id uuid not null references public.off_market_signalen(id) on delete cascade,
 toegevoegd_door uuid references auth.users(id) on delete set null, toegevoegd_op timestamptz not null default now(), notitie text, archived_at timestamptz
);
grant select,insert,update,delete on public.off_market_acquisitie_selectie to authenticated; grant all on public.off_market_acquisitie_selectie to service_role;
alter table public.off_market_acquisitie_selectie enable row level security;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_acquisitie_selectie' and policyname='Intern leest acquisitieselectie') then create policy "Intern leest acquisitieselectie" on public.off_market_acquisitie_selectie for select to authenticated using(public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_acquisitie_selectie' and policyname='Intern voegt acquisitieselectie toe') then create policy "Intern voegt acquisitieselectie toe" on public.off_market_acquisitie_selectie for insert to authenticated with check(public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_acquisitie_selectie' and policyname='Intern wijzigt acquisitieselectie') then create policy "Intern wijzigt acquisitieselectie" on public.off_market_acquisitie_selectie for update to authenticated using(public.is_intern_gebruiker(auth.uid())) with check(public.is_intern_gebruiker(auth.uid())); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='off_market_acquisitie_selectie' and policyname='Intern verwijdert acquisitieselectie') then create policy "Intern verwijdert acquisitieselectie" on public.off_market_acquisitie_selectie for delete to authenticated using(public.is_intern_gebruiker(auth.uid())); end if;
end $$;
create unique index if not exists off_market_acquisitie_selectie_actief_uniek on public.off_market_acquisitie_selectie(signaal_id) where archived_at is null;
create index if not exists off_market_acquisitie_selectie_signaal_idx on public.off_market_acquisitie_selectie(signaal_id);