-- Read-only verificatie voor de centrale object- en Kadasterkostenlaag.
-- Voert geen DDL/DML uit en maakt geen Kadaster-aanvragen.

with vereiste_tabellen(tabelnaam) as (
  values
    ('crm_objectregistraties'),
    ('crm_objectbronkoppelingen'),
    ('kadaster_producten'),
    ('kadaster_budgetten'),
    ('kadaster_kosten_events')
), aanwezige_tabellen as (
  select table_name
  from information_schema.tables
  where table_schema = 'public'
), tabelcontrole as (
  select v.tabelnaam, (a.table_name is not null) as aanwezig
  from vereiste_tabellen v
  left join aanwezige_tabellen a on a.table_name = v.tabelnaam
), rls_controle as (
  select c.relname as tabelnaam, c.relrowsecurity as rls_actief
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'crm_objectregistraties',
      'crm_objectbronkoppelingen',
      'kadaster_producten',
      'kadaster_budgetten',
      'kadaster_kosten_events'
    )
), browser_write_policies as (
  select tablename, policyname, cmd
  from pg_policies
  where schemaname = 'public'
    and tablename = 'kadaster_kosten_events'
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
)
select jsonb_build_object(
  'status', case
    when exists (select 1 from tabelcontrole where not aanwezig) then 'missing_tables'
    when exists (select 1 from rls_controle where not rls_actief) then 'rls_missing'
    when exists (select 1 from browser_write_policies) then 'unsafe_browser_write_policy'
    else 'schema_ready'
  end,
  'tabellen', (select jsonb_agg(to_jsonb(tabelcontrole) order by tabelnaam) from tabelcontrole),
  'rls', (select jsonb_agg(to_jsonb(rls_controle) order by tabelnaam) from rls_controle),
  'browser_write_policies', (select coalesce(jsonb_agg(to_jsonb(browser_write_policies)), '[]'::jsonb) from browser_write_policies)
) as kadaster_schema_preflight;
