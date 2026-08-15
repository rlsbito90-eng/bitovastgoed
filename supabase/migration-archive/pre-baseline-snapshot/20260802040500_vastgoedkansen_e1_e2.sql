create table if not exists public.vastgoedkansen (
 id uuid primary key default gen_random_uuid(), kansnummer text unique, adres text, postcode text, plaats text, provincie text, type_vastgoed text,
 herkomst text not null default 'handmatig' check (herkomst in ('handmatig','csv_import','bag_selectie','kaart_selectie','externe_bron')),
 herkomst_referentie text, selectieprofiel_id uuid, selectierun_id uuid, bag_pand_id text, bag_verblijfsobject_id text,
 algoritme_score integer check (algoritme_score between 0 and 100), score_uitleg text,
 status text not null default 'te_beoordelen' check (status in ('te_beoordelen','onderzoek','brief_voorbereiden','opvolgen','wachten','positieve_reactie','afgevallen','gepromoveerd')),
 prioriteit integer not null default 3 check (prioriteit between 1 and 5),
 eigenaar_status text not null default 'niet_gestart' check (eigenaar_status in ('niet_gestart','bezig','bekend','niet_gevonden')),
 brief_status text not null default 'niet_gestart' check (brief_status in ('niet_gestart','voorbereiden','klaar','verzonden','reactie_ontvangen')),
 volgende_actie_datum date, volgende_actie_omschrijving text, reden_interessant text, notities text,
 object_id uuid references public.objecten(id) on delete set null, aangemaakt_door uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create sequence if not exists public.vastgoedkans_nummer_seq start 1;
create or replace function public.vastgoedkans_nummer_toekennen() returns trigger language plpgsql as $$ begin if new.kansnummer is null then new.kansnummer := 'VK-'||lpad(nextval('public.vastgoedkans_nummer_seq')::text,6,'0'); end if; new.updated_at:=now(); return new; end $$;
drop trigger if exists trg_vastgoedkans_nummer on public.vastgoedkansen; create trigger trg_vastgoedkans_nummer before insert or update on public.vastgoedkansen for each row execute function public.vastgoedkans_nummer_toekennen();
alter table public.vastgoedkansen enable row level security;
drop policy if exists vastgoedkansen_authenticated_all on public.vastgoedkansen; create policy vastgoedkansen_authenticated_all on public.vastgoedkansen for all to authenticated using (true) with check (true);
create index if not exists idx_vastgoedkansen_status on public.vastgoedkansen(status); create index if not exists idx_vastgoedkansen_adres on public.vastgoedkansen(postcode,plaats,adres);
