-- Bito CRM: commerciële objectbeoordeling (interne, optionele intake).
-- Bestaande objecten.vraagprijs/prijsindicatie/marktwaarde_indicatie/
-- marktwaarde_bron/verkoopmotivatie zijn de enige bronnen voor die gegevens.

create table if not exists public.object_commerciele_beoordeling (
  object_id uuid primary key references public.objecten(id) on delete cascade,
  prijs_oordeel text not null default 'onbekend'
    check (prijs_oordeel in ('onbekend','realistisch','ambitieus','herzien')),
  verkoop_bereidheid text not null default 'onbekend'
    check (verkoop_bereidheid in ('onbekend','verkennend','bereid','bevestigd')),
  verkoop_termijn text not null default 'onbekend'
    check (verkoop_termijn in ('onbekend','spoed','binnen_3m','binnen_6m','flexibel')),
  prijs_flexibiliteit text not null default 'onbekend'
    check (prijs_flexibiliteit in ('onbekend','vast','bespreekbaar','ruim')),
  beslisser_status text not null default 'onbekend'
    check (beslisser_status in ('onbekend','bevoegd','mede_beslissers','tussenpersoon')),
  eerder_aangeboden text not null default 'onbekend'
    check (eerder_aangeboden in ('onbekend','nee','ja')),
  eerder_aangeboden_toelichting text,
  informatie_status text not null default 'onbekend'
    check (informatie_status in ('onbekend','basis','voldoende','geverifieerd')),
  intern_oordeel text,
  besluit text
    check (besluit is null or besluit in ('verkennen','markttoets','actief','herbeoordelen')),
  besluit_toelichting text,
  bijgewerkt_op timestamptz not null default now(),
  bijgewerkt_door uuid default auth.uid(),
  constraint object_commerciele_beoordeling_besluit_toelichting check (
    besluit is null or length(btrim(coalesce(besluit_toelichting,''))) between 1 and 2000
  ),
  constraint object_commerciele_beoordeling_eerder_aanbod check (
    eerder_aangeboden <> 'ja' or
    length(btrim(coalesce(eerder_aangeboden_toelichting,''))) between 1 and 2000
  ),
  constraint object_commerciele_beoordeling_toelichtingen check (
    length(coalesce(eerder_aangeboden_toelichting,'')) <= 2000
    and length(coalesce(intern_oordeel,'')) <= 2000
    and length(coalesce(besluit_toelichting,'')) <= 2000
  )
);

alter table public.object_commerciele_beoordeling enable row level security;
revoke all on table public.object_commerciele_beoordeling from public, anon;
grant select, insert, update on public.object_commerciele_beoordeling to authenticated;

create policy "Intern leest commerciele objectbeoordeling"
  on public.object_commerciele_beoordeling for select to authenticated
  using ((select public.is_intern_gebruiker((select auth.uid()))));

create policy "Intern maakt commerciele objectbeoordeling"
  on public.object_commerciele_beoordeling for insert to authenticated
  with check ((select public.is_intern_gebruiker((select auth.uid()))));

create policy "Intern wijzigt commerciele objectbeoordeling"
  on public.object_commerciele_beoordeling for update to authenticated
  using ((select public.is_intern_gebruiker((select auth.uid()))))
  with check ((select public.is_intern_gebruiker((select auth.uid()))));

comment on table public.object_commerciele_beoordeling is
  'Interne, beargumenteerde beoordeling van verkoopbereidheid en aanbiedbaarheid. Geen taxatie, geen automatische verzending, geen koperspipeline. Prijs en motivatie blijven in public.objecten.';
comment on column public.object_commerciele_beoordeling.besluit is
  'Optioneel handmatig besluit met verplicht besluit_toelichting. Ontbrekend besluit gebruikt alleen de vrijblijvende berekende suggestie.';
