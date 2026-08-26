-- Off-Market Radar — partij- en campagnebewuste benadering.
-- Additief: bestaande signalen, brieven, batches en audit-events blijven onaangetast.
-- Canonieke partij = bestaand centraal `eigenaren`-register. Geen naam-only merge.

create table if not exists public.off_market_benadercampagnes (
  id uuid primary key default gen_random_uuid(),
  eigenaar_id uuid not null references public.eigenaren(id) on delete restrict,
  doelstelling text not null default 'radar_acquisitie',
  status text not null default 'actief'
    check (status in ('actief','gepauzeerd','afgerond_geen_reactie','warm','afgesloten')),
  contact_status text not null default 'cold'
    check (contact_status in ('cold','not_now','not_interested','do_not_contact','warm')),
  huidige_stap text
    check (huidige_stap is null or huidige_stap in ('brief_1','brief_2','brief_3','persoonlijk')),
  laatste_koude_contact_op timestamptz,
  herbenaderen_vanaf date,
  cooldown_maanden smallint not null default 6 check (cooldown_maanden between 1 and 60),
  routing_reden text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.off_market_benadercampagnes is
  'Een partijbewuste koude benadercampagne. Maximaal één actieve/gepauzeerde campagne per eigenaar en doelstelling.';

create unique index if not exists off_market_benadercampagnes_een_actief_per_partij_doel
  on public.off_market_benadercampagnes (eigenaar_id, doelstelling)
  where status in ('actief','gepauzeerd');
create index if not exists off_market_benadercampagnes_eigenaar_idx
  on public.off_market_benadercampagnes (eigenaar_id, created_at desc);
create index if not exists off_market_benadercampagnes_recontact_idx
  on public.off_market_benadercampagnes (herbenaderen_vanaf)
  where herbenaderen_vanaf is not null;

create table if not exists public.off_market_campagne_objecten (
  id uuid primary key default gen_random_uuid(),
  campagne_id uuid not null references public.off_market_benadercampagnes(id) on delete cascade,
  signaal_id uuid not null references public.off_market_signalen(id) on delete restrict,
  object_id uuid references public.objecten(id) on delete set null,
  rol text not null default 'context'
    check (rol in ('primary','context','archived')),
  eerste_signaal_op timestamptz,
  sterkste_signaalsoort text,
  relevantiescore numeric(6,2),
  score_uitleg jsonb not null default '{}'::jsonb,
  signaal_ids uuid[] not null default '{}'::uuid[],
  reden_toevoeging text,
  noemen_in_volgend_contact boolean not null default false,
  toegevoegd_op timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campagne_id, signaal_id)
);

create unique index if not exists off_market_campagne_objecten_een_primary
  on public.off_market_campagne_objecten (campagne_id)
  where rol = 'primary';
create index if not exists off_market_campagne_objecten_signaal_idx
  on public.off_market_campagne_objecten (signaal_id);

create table if not exists public.off_market_partij_match_besluiten (
  id uuid primary key default gen_random_uuid(),
  signaal_id uuid not null references public.off_market_signalen(id) on delete cascade,
  voorgestelde_eigenaar_id uuid references public.eigenaren(id) on delete restrict,
  bevestigde_eigenaar_id uuid references public.eigenaren(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending','confirmed','rejected')),
  reden text,
  bron text not null default 'radar_router',
  besloten_door uuid,
  besloten_op timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists off_market_partij_match_besluiten_signaal_idx
  on public.off_market_partij_match_besluiten (signaal_id, created_at desc);

create table if not exists public.off_market_campagne_events (
  id uuid primary key default gen_random_uuid(),
  campagne_id uuid references public.off_market_benadercampagnes(id) on delete set null,
  eigenaar_id uuid references public.eigenaren(id) on delete set null,
  signaal_id uuid references public.off_market_signalen(id) on delete set null,
  event_type text not null,
  reden text,
  metadata jsonb not null default '{}'::jsonb,
  aangemaakt_door uuid,
  created_at timestamptz not null default now()
);
create index if not exists off_market_campagne_events_campagne_idx
  on public.off_market_campagne_events (campagne_id, created_at desc);
create index if not exists off_market_campagne_events_signaal_idx
  on public.off_market_campagne_events (signaal_id, created_at desc);

create table if not exists public.off_market_campaign_config (
  sleutel text primary key,
  waarde jsonb not null,
  omschrijving text,
  updated_at timestamptz not null default now()
);
insert into public.off_market_campaign_config (sleutel, waarde, omschrijving)
values
  ('default_cooldown_months', '6'::jsonb, 'Standaard cooldown na een afgeronde koude campagne zonder reactie.'),
  ('primary_switch_threshold', '15'::jsonb, 'Minimale scoremarge voordat een sterker hoofdobject wordt voorgesteld.')
on conflict (sleutel) do nothing;

alter table public.off_market_benadercampagnes enable row level security;
alter table public.off_market_campagne_objecten enable row level security;
alter table public.off_market_partij_match_besluiten enable row level security;
alter table public.off_market_campagne_events enable row level security;
alter table public.off_market_campaign_config enable row level security;

create policy "Intern leest benadercampagnes" on public.off_market_benadercampagnes
  for select to authenticated using (public.is_intern_gebruiker(auth.uid()));
create policy "Intern maakt benadercampagnes" on public.off_market_benadercampagnes
  for insert to authenticated with check (public.is_intern_gebruiker(auth.uid()));
create policy "Intern wijzigt benadercampagnes" on public.off_market_benadercampagnes
  for update to authenticated using (public.is_intern_gebruiker(auth.uid())) with check (public.is_intern_gebruiker(auth.uid()));

create policy "Intern leest campagneobjecten" on public.off_market_campagne_objecten
  for select to authenticated using (public.is_intern_gebruiker(auth.uid()));
create policy "Intern maakt campagneobjecten" on public.off_market_campagne_objecten
  for insert to authenticated with check (public.is_intern_gebruiker(auth.uid()));
create policy "Intern wijzigt campagneobjecten" on public.off_market_campagne_objecten
  for update to authenticated using (public.is_intern_gebruiker(auth.uid())) with check (public.is_intern_gebruiker(auth.uid()));

create policy "Intern leest partijmatchbesluiten" on public.off_market_partij_match_besluiten
  for select to authenticated using (public.is_intern_gebruiker(auth.uid()));
create policy "Intern maakt partijmatchbesluiten" on public.off_market_partij_match_besluiten
  for insert to authenticated with check (public.is_intern_gebruiker(auth.uid()));
create policy "Intern wijzigt partijmatchbesluiten" on public.off_market_partij_match_besluiten
  for update to authenticated using (public.is_intern_gebruiker(auth.uid())) with check (public.is_intern_gebruiker(auth.uid()));

create policy "Intern leest campagneevents" on public.off_market_campagne_events
  for select to authenticated using (public.is_intern_gebruiker(auth.uid()));
create policy "Intern maakt campagneevents" on public.off_market_campagne_events
  for insert to authenticated with check (public.is_intern_gebruiker(auth.uid()));

create policy "Intern leest campagneconfig" on public.off_market_campaign_config
  for select to authenticated using (public.is_intern_gebruiker(auth.uid()));
create policy "Intern wijzigt campagneconfig" on public.off_market_campaign_config
  for update to authenticated using (public.is_intern_gebruiker(auth.uid())) with check (public.is_intern_gebruiker(auth.uid()));

create trigger off_market_benadercampagnes_set_updated_at
  before update on public.off_market_benadercampagnes
  for each row execute function public.update_updated_at_column();
create trigger off_market_campagne_objecten_set_updated_at
  before update on public.off_market_campagne_objecten
  for each row execute function public.update_updated_at_column();
create trigger off_market_partij_match_besluiten_set_updated_at
  before update on public.off_market_partij_match_besluiten
  for each row execute function public.update_updated_at_column();

-- Backfill uitsluitend wanneer een Radar-signaal exact één expliciete koppeling naar
-- het centrale eigenaarsregister heeft. Naam-only of vergelijkbare BV-namen worden
-- bewust niet afgeleid/samengevoegd.
with betrouwbare_signalen as (
  select ek.signaal_id, min(ek.eigenaar_id::text)::uuid as eigenaar_id
  from public.eigenaar_koppelingen ek
  where ek.signaal_id is not null
    and coalesce(ek.betrouwbaarheid, 0) >= 90
  group by ek.signaal_id
  having count(distinct ek.eigenaar_id) = 1
), partij_historie as (
  select
    bs.eigenaar_id,
    max(b.verzonden_op) filter (where b.status = 'verstuurd') as laatste_koude_contact_op,
    bool_or(b.status in ('concept','definitief')) as heeft_open_brief,
    bool_or(coalesce(b.responsstatus,'') in ('interesse','wil_meer_informatie','gesprek_gepland','reactie_ontvangen')) as warm,
    bool_or(coalesce(b.responsstatus,'') = 'niet_geinteresseerd') as niet_geinteresseerd
  from betrouwbare_signalen bs
  join public.off_market_brieven b on b.signaal_id = bs.signaal_id
  where b.archived_at is null
  group by bs.eigenaar_id
)
insert into public.off_market_benadercampagnes (
  eigenaar_id, doelstelling, status, contact_status, laatste_koude_contact_op,
  herbenaderen_vanaf, cooldown_maanden, routing_reden
)
select
  ph.eigenaar_id,
  'radar_acquisitie',
  case when ph.warm then 'warm' when ph.heeft_open_brief then 'actief' else 'afgerond_geen_reactie' end,
  case when ph.warm then 'warm' when ph.niet_geinteresseerd then 'not_interested' else 'cold' end,
  ph.laatste_koude_contact_op,
  case when ph.laatste_koude_contact_op is not null
    then (ph.laatste_koude_contact_op::date + interval '6 months')::date
    else null end,
  6,
  'Veilige backfill uit bestaande briefhistorie en één betrouwbare eigenaar_koppeling.'
from partij_historie ph
where not exists (
  select 1 from public.off_market_benadercampagnes c
  where c.eigenaar_id = ph.eigenaar_id and c.doelstelling = 'radar_acquisitie'
);

with betrouwbare_signalen as (
  select ek.signaal_id, min(ek.eigenaar_id::text)::uuid as eigenaar_id
  from public.eigenaar_koppelingen ek
  where ek.signaal_id is not null
    and coalesce(ek.betrouwbaarheid, 0) >= 90
  group by ek.signaal_id
  having count(distinct ek.eigenaar_id) = 1
), kandidaten as (
  select
    c.id as campagne_id,
    bs.signaal_id,
    row_number() over (
      partition by c.id
      order by max(b.verzonden_op) desc nulls last, bs.signaal_id
    ) as rn
  from public.off_market_benadercampagnes c
  join betrouwbare_signalen bs on bs.eigenaar_id = c.eigenaar_id
  left join public.off_market_brieven b on b.signaal_id = bs.signaal_id and b.archived_at is null
  where c.doelstelling = 'radar_acquisitie'
  group by c.id, bs.signaal_id
)
insert into public.off_market_campagne_objecten (
  campagne_id, signaal_id, rol, signaal_ids, reden_toevoeging, noemen_in_volgend_contact
)
select
  k.campagne_id,
  k.signaal_id,
  case when k.rn = 1 then 'primary' else 'context' end,
  array[k.signaal_id],
  'Veilige backfill uit bestaande betrouwbare eigenaar_koppeling.',
  false
from kandidaten k
on conflict (campagne_id, signaal_id) do nothing;
