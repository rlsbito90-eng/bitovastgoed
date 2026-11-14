-- Aanbiedgolven: uitsluitend selectie- en faseringmetadata.
-- Bestaande object_pipeline blijft de enige kandidaatstatus en
-- contact_moments blijft de enige aanbieder-/reactiehistorie.

create table public.object_aanbiedgolven (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objecten(id) on delete cascade,
  volgnummer integer not null check (volgnummer between 1 and 100),
  toelichting text,
  aangemaakt_op timestamptz not null default now(),
  aangemaakt_door uuid default auth.uid(),
  unique (object_id,volgnummer),
  unique (id,object_id),
  check (length(coalesce(toelichting,''))<=1000)
);

-- Composite reference makes it impossible to select a candidate belonging to
-- another object, even through direct API calls.
create unique index if not exists object_pipeline_id_object_idx
  on public.object_pipeline(id,object_id);

create table public.object_aanbiedgolf_selecties (
  id uuid primary key default gen_random_uuid(),
  golf_id uuid not null,
  object_id uuid not null,
  kandidaat_id uuid not null,
  geselecteerd_op timestamptz not null default now(),
  unique(kandidaat_id),
  unique(golf_id,kandidaat_id),
  foreign key (golf_id,object_id)
    references public.object_aanbiedgolven(id,object_id) on delete cascade,
  foreign key (kandidaat_id,object_id)
    references public.object_pipeline(id,object_id) on delete cascade
);
create index object_aanbiedgolf_selecties_object_idx
  on public.object_aanbiedgolf_selecties(object_id);

alter table public.object_aanbiedgolven enable row level security;
alter table public.object_aanbiedgolf_selecties enable row level security;
revoke all on table public.object_aanbiedgolven, public.object_aanbiedgolf_selecties
  from public,anon;
grant select,insert on public.object_aanbiedgolven,public.object_aanbiedgolf_selecties
  to authenticated;

create policy "Intern leest aanbiedgolven"
  on public.object_aanbiedgolven for select to authenticated
  using ((select public.is_intern_gebruiker((select auth.uid()))));
create policy "Intern maakt aanbiedgolven"
  on public.object_aanbiedgolven for insert to authenticated
  with check ((select public.is_intern_gebruiker((select auth.uid()))));
create policy "Intern leest golfselecties"
  on public.object_aanbiedgolf_selecties for select to authenticated
  using ((select public.is_intern_gebruiker((select auth.uid()))));
create policy "Intern maakt golfselecties"
  on public.object_aanbiedgolf_selecties for insert to authenticated
  with check ((select public.is_intern_gebruiker((select auth.uid()))));

-- One atomic operation. Never sends teasers or mutates candidate stage.
create or replace function public.maak_aanbiedgolf(
  p_object_id uuid, p_kandidaat_ids uuid[], p_toelichting text default null
) returns uuid
language plpgsql security invoker set search_path=''
as $$
declare
  v_num integer;
  v_golf_id uuid;
  v_aantal integer;
  v_uniek integer;
begin
  if not (select public.is_intern_gebruiker((select auth.uid()))) then
    raise exception 'Geen toegang tot interne aanbiedgolven';
  end if;
  v_aantal := coalesce(cardinality(p_kandidaat_ids),0);
  if v_aantal < 1 or v_aantal > 3 or
    length(coalesce(p_toelichting,''))>1000 then
    raise exception 'Selecteer 1 tot 3 kandidaten en maximaal 1000 tekens toelichting';
  end if;
  select count(distinct id) into v_uniek
    from unnest(p_kandidaat_ids) id;
  if v_uniek<>v_aantal then
    raise exception 'Een kandidaat mag slechts eenmaal per golf voorkomen';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_object_id::text));
  select count(*) into v_uniek
    from public.object_pipeline
   where id=any(p_kandidaat_ids) and object_id=p_object_id
     and soft_deleted_at is null;
  if v_uniek<>v_aantal then
    raise exception 'Niet alle kandidaten zijn actief aan dit object gekoppeld';
  end if;
  if exists (
    select 1 from public.object_aanbiedgolf_selecties
     where kandidaat_id=any(p_kandidaat_ids)
  ) then
    raise exception 'Een of meer kandidaten zijn al aan een eerdere golf toegewezen';
  end if;
  select coalesce(max(volgnummer),0)+1 into v_num
    from public.object_aanbiedgolven where object_id=p_object_id;
  if v_num>100 then raise exception 'Maximum aantal golven bereikt'; end if;
  insert into public.object_aanbiedgolven(object_id,volgnummer,toelichting)
  values(p_object_id,v_num,nullif(btrim(p_toelichting),''))
  returning id into v_golf_id;

  insert into public.object_aanbiedgolf_selecties(golf_id,object_id,kandidaat_id)
  select v_golf_id,p_object_id,ids.id from unnest(p_kandidaat_ids) ids(id);
  return v_golf_id;
end $$;

revoke all on function public.maak_aanbiedgolf(uuid,uuid[],text) from public,anon;
grant execute on function public.maak_aanbiedgolf(uuid,uuid[],text) to authenticated;

comment on table public.object_aanbiedgolven is
  'Interne selectierondes per object; geen verzending, geen pipelinefase en geen bron van marktfeedback.';
comment on table public.object_aanbiedgolf_selecties is
  'Koppelingen naar bestaande kandidaatposities; status uit object_pipeline en contactmomenten afleiden.';
