do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='pipeline_fase') then
    create type public.pipeline_fase as enum ('match_gevonden','teaser_verstuurd','interesse_ontvangen','nda_verstuurd','nda_getekend','informatie_gedeeld','bezichtiging_gepland','bezichtiging_geweest','indicatieve_bieding','onderhandeling','loi_ontvangen','due_diligence','koopovereenkomst_concept','koopovereenkomst_getekend','transport_closing','afgerond','afgevallen');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='interesse_niveau') then
    create type public.interesse_niveau as enum ('koud','lauw','warm','zeer_warm');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='volgende_actie_type') then
    create type public.volgende_actie_type as enum ('bellen','mailen','whatsapp','nda_sturen','stukken_delen','bezichtiging_plannen','bieding_opvolgen','onderhandelen','overig');
  end if;
end $$;

create table if not exists public.object_pipeline (
  id uuid not null default gen_random_uuid() primary key,
  object_id uuid not null,
  relatie_id uuid not null,
  zoekprofiel_id uuid,
  pipeline_fase public.pipeline_fase not null default 'match_gevonden',
  interesse_niveau public.interesse_niveau not null default 'lauw',
  matchscore smallint,
  teaser_verstuurd boolean not null default false,
  teaser_verstuurd_op date,
  nda_verstuurd boolean not null default false,
  nda_verstuurd_op date,
  nda_getekend boolean not null default false,
  nda_getekend_op date,
  informatie_gedeeld boolean not null default false,
  informatie_gedeeld_op date,
  bezichtiging_datum date,
  bieding_bedrag bigint,
  bieding_voorwaarden text,
  financieringsvoorbehoud boolean,
  gewenste_levering date,
  fee_akkoord boolean not null default false,
  laatste_contactdatum date,
  volgende_actie public.volgende_actie_type,
  volgende_actie_omschrijving text,
  volgende_actie_datum date,
  notities text,
  reden_afgevallen text,
  aangemaakt_door uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  soft_deleted_at timestamptz,
  unique (object_id, relatie_id)
);
create index if not exists idx_object_pipeline_object on public.object_pipeline(object_id) where soft_deleted_at is null;
create index if not exists idx_object_pipeline_relatie on public.object_pipeline(relatie_id) where soft_deleted_at is null;
create index if not exists idx_object_pipeline_fase on public.object_pipeline(pipeline_fase) where soft_deleted_at is null;
create index if not exists idx_object_pipeline_volgende_actie on public.object_pipeline(volgende_actie_datum) where soft_deleted_at is null;
alter table public.object_pipeline enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='object_pipeline' and policyname='Intern leest object_pipeline') then create policy "Intern leest object_pipeline" on public.object_pipeline for select to authenticated using (public.is_intern_gebruiker(auth.uid())); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='object_pipeline' and policyname='Intern voegt object_pipeline toe') then create policy "Intern voegt object_pipeline toe" on public.object_pipeline for insert to authenticated with check (public.is_intern_gebruiker(auth.uid())); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='object_pipeline' and policyname='Intern wijzigt object_pipeline') then create policy "Intern wijzigt object_pipeline" on public.object_pipeline for update to authenticated using (public.is_intern_gebruiker(auth.uid())); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='object_pipeline' and policyname='Intern verwijdert object_pipeline') then create policy "Intern verwijdert object_pipeline" on public.object_pipeline for delete to authenticated using (public.is_intern_gebruiker(auth.uid())); end if;
  if not exists (select 1 from pg_trigger where tgname='trg_object_pipeline_updated' and not tgisinternal) then create trigger trg_object_pipeline_updated before update on public.object_pipeline for each row execute function public.update_updated_at_column(); end if;
end $$;

create table if not exists public.pipelines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  entity_type text not null default 'object',
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pipelines enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pipelines' and policyname='Intern leest pipelines') then create policy "Intern leest pipelines" on public.pipelines for select to authenticated using (public.is_intern_gebruiker(auth.uid())); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pipelines' and policyname='Admin beheert pipelines ins') then create policy "Admin beheert pipelines ins" on public.pipelines for insert to authenticated with check (public.has_role(auth.uid(),'admin'::app_role)); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pipelines' and policyname='Admin beheert pipelines upd') then create policy "Admin beheert pipelines upd" on public.pipelines for update to authenticated using (public.has_role(auth.uid(),'admin'::app_role)); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pipelines' and policyname='Admin beheert pipelines del') then create policy "Admin beheert pipelines del" on public.pipelines for delete to authenticated using (public.has_role(auth.uid(),'admin'::app_role)); end if;
  if not exists (select 1 from pg_trigger where tgname='pipelines_updated_at' and not tgisinternal) then create trigger pipelines_updated_at before update on public.pipelines for each row execute function public.update_updated_at_column(); end if;
end $$;

create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  name text not null,
  slug text not null,
  sort_order integer not null default 0,
  color text,
  probability integer,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pipeline_id, slug)
);
create index if not exists pipeline_stages_pipeline_idx on public.pipeline_stages(pipeline_id, sort_order);
alter table public.pipeline_stages enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pipeline_stages' and policyname='Intern leest pipeline_stages') then create policy "Intern leest pipeline_stages" on public.pipeline_stages for select to authenticated using (public.is_intern_gebruiker(auth.uid())); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pipeline_stages' and policyname='Admin beheert pipeline_stages ins') then create policy "Admin beheert pipeline_stages ins" on public.pipeline_stages for insert to authenticated with check (public.has_role(auth.uid(),'admin'::app_role)); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pipeline_stages' and policyname='Admin beheert pipeline_stages upd') then create policy "Admin beheert pipeline_stages upd" on public.pipeline_stages for update to authenticated using (public.has_role(auth.uid(),'admin'::app_role)); end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pipeline_stages' and policyname='Admin beheert pipeline_stages del') then create policy "Admin beheert pipeline_stages del" on public.pipeline_stages for delete to authenticated using (public.has_role(auth.uid(),'admin'::app_role)); end if;
  if not exists (select 1 from pg_trigger where tgname='pipeline_stages_updated_at' and not tgisinternal) then create trigger pipeline_stages_updated_at before update on public.pipeline_stages for each row execute function public.update_updated_at_column(); end if;
end $$;

alter table public.objecten
  add column if not exists pipeline_id uuid references public.pipelines(id) on delete set null,
  add column if not exists pipeline_stage_id uuid references public.pipeline_stages(id) on delete set null,
  add column if not exists pipeline_updated_at timestamptz,
  add column if not exists pipeline_stage_locked boolean not null default false;
create index if not exists objecten_pipeline_stage_idx on public.objecten(pipeline_stage_id);
create index if not exists objecten_pipeline_idx on public.objecten(pipeline_id);

do $$ declare v_pipeline_id uuid; begin
  select id into v_pipeline_id from public.pipelines where entity_type='object' and is_default=true limit 1;
  if v_pipeline_id is null then
    insert into public.pipelines(name,entity_type,is_active,is_default) values ('Object Pipeline','object',true,true) returning id into v_pipeline_id;
    insert into public.pipeline_stages(pipeline_id,name,slug,sort_order,color,probability,is_won,is_lost) values
      (v_pipeline_id,'Lead','lead',10,'#94a3b8',5,false,false),
      (v_pipeline_id,'Gekwalificeerd','gekwalificeerd',20,'#94a3b8',10,false,false),
      (v_pipeline_id,'In voorbereiding','in_voorbereiding',30,'#64748b',15,false,false),
      (v_pipeline_id,'In verkoop / matching','in_verkoop',40,'#3b82f6',25,false,false),
      (v_pipeline_id,'Kandidaten benaderd','kandidaten_benaderd',50,'#3b82f6',35,false,false),
      (v_pipeline_id,'NDA / dataroom','nda_dataroom',60,'#6366f1',45,false,false),
      (v_pipeline_id,'Bezichtigingen','bezichtigingen',70,'#8b5cf6',55,false,false),
      (v_pipeline_id,'Biedingen ontvangen','biedingen_ontvangen',80,'#a855f7',65,false,false),
      (v_pipeline_id,'Onderhandeling','onderhandeling',90,'#d946ef',70,false,false),
      (v_pipeline_id,'LOI / intentie','loi',100,'#ec4899',75,false,false),
      (v_pipeline_id,'Due diligence','due_diligence',110,'#f59e0b',80,false,false),
      (v_pipeline_id,'Koopovereenkomst','koopovereenkomst',120,'#f59e0b',90,false,false),
      (v_pipeline_id,'Closing / notaris','closing',130,'#10b981',95,false,false),
      (v_pipeline_id,'Afgerond','afgerond',140,'#10b981',100,true,false),
      (v_pipeline_id,'Afgevallen','afgevallen',999,'#ef4444',0,false,true);
  end if;
end $$;