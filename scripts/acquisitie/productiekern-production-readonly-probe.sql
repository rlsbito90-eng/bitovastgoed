-- ACQUISITIEPRODUCTIEKERN — PRODUCTIE READ-ONLY PROBE
--
-- DOEL
--   Bewijs de actuele DDL/RLS en alleen geaggregeerde datakwaliteit van de
--   bestaande CRM-productietabellen voordat BUILD A ooit wordt geactiveerd.
--
-- VEILIGHEID
--   * uitsluitend SELECT/catalogusqueries;
--   * transactie staat expliciet READ ONLY;
--   * geen rijinhoud, namen, adressen of brieftekst in de uitvoer;
--   * geen migratie, DDL, DML, grants of configuratiewijziging;
--   * eindigt met ROLLBACK.
--
-- BEOOGD PROJECT: ljudxyrqoifhfikueric
-- Voer dit uitsluitend uit tegen de aantoonbare CRM-productiedatabase.

begin transaction read only;
set local statement_timeout = '10s';
set local lock_timeout = '2s';

-- ---------------------------------------------------------------------------
-- A. Context — voorkomt dat output van een verkeerd project als bewijs geldt
-- ---------------------------------------------------------------------------
select
  current_database() as database_name,
  current_user as database_user,
  current_setting('server_version') as server_version,
  now() as probe_at;

-- ---------------------------------------------------------------------------
-- B. Tabellen + kolommen
-- ---------------------------------------------------------------------------
select
  c.table_schema,
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in (
    'off_market_acquisitie_selectie',
    'off_market_brieven',
    'off_market_brief_events',
    'off_market_signalen',
    'taken'
  )
order by c.table_name, c.ordinal_position;

-- ---------------------------------------------------------------------------
-- C. Constraints — inclusief exacte legacy briefstatuscheck
-- ---------------------------------------------------------------------------
select
  cls.relname as table_name,
  con.conname as constraint_name,
  con.contype as constraint_type,
  con.convalidated as validated,
  pg_get_constraintdef(con.oid, true) as definition
from pg_constraint con
join pg_class cls on cls.oid = con.conrelid
join pg_namespace ns on ns.oid = cls.relnamespace
where ns.nspname = 'public'
  and cls.relname in (
    'off_market_acquisitie_selectie',
    'off_market_brieven',
    'off_market_brief_events',
    'off_market_signalen',
    'taken'
  )
order by cls.relname, con.conname;

-- ---------------------------------------------------------------------------
-- D. Indexen
-- ---------------------------------------------------------------------------
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'off_market_acquisitie_selectie',
    'off_market_brieven',
    'off_market_brief_events',
    'off_market_signalen',
    'taken'
  )
order by tablename, indexname;

-- ---------------------------------------------------------------------------
-- E. RLS-status op tabellen
-- ---------------------------------------------------------------------------
select
  ns.nspname as schema_name,
  cls.relname as table_name,
  cls.relrowsecurity as rls_enabled,
  cls.relforcerowsecurity as rls_forced
from pg_class cls
join pg_namespace ns on ns.oid = cls.relnamespace
where ns.nspname = 'public'
  and cls.relkind in ('r', 'p')
  and cls.relname in (
    'off_market_acquisitie_selectie',
    'off_market_brieven',
    'off_market_brief_events',
    'off_market_signalen',
    'taken'
  )
order by cls.relname;

-- ---------------------------------------------------------------------------
-- F. RLS-policies
-- ---------------------------------------------------------------------------
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'off_market_acquisitie_selectie',
    'off_market_brieven',
    'off_market_brief_events',
    'off_market_signalen',
    'taken'
  )
order by tablename, policyname;

-- ---------------------------------------------------------------------------
-- G. Tabelgrants voor API-rollen
-- ---------------------------------------------------------------------------
select
  grantee,
  table_schema,
  table_name,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'off_market_acquisitie_selectie',
    'off_market_brieven',
    'off_market_brief_events',
    'off_market_signalen',
    'taken'
  )
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

-- ---------------------------------------------------------------------------
-- H. Autorisatiehelper waarop bestaande policies steunen
-- ---------------------------------------------------------------------------
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  p.proconfig as function_config,
  pg_get_userbyid(p.proowner) as owner
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'is_intern_gebruiker';

-- ---------------------------------------------------------------------------
-- I. Geaggregeerde datakwaliteit — geen persoonsgegevens/inhoud
-- ---------------------------------------------------------------------------
select status, count(*) as aantal
from public.off_market_brieven
group by status
order by status;

select
  count(*) as totaal_brieven,
  count(*) filter (where geadresseerde_key is null or btrim(geadresseerde_key) = '') as zonder_geadresseerde_key,
  count(*) filter (where printdatum is not null) as met_printdatum,
  count(*) filter (where postdatum is not null) as met_postdatum,
  count(*) filter (where postdatum is not null and printdatum is null) as gepost_zonder_printdatum
from public.off_market_brieven;

select
  count(*) as totaal_events,
  count(*) filter (where brief_id is null) as events_zonder_brief_id,
  count(*) filter (where geadresseerde_key is null or btrim(geadresseerde_key) = '') as events_zonder_geadresseerde_key
from public.off_market_brief_events;

select
  count(*) as totaal_selecties,
  count(*) filter (where archived_at is null) as actieve_selecties,
  count(distinct signaal_id) filter (where archived_at is null) as unieke_actieve_signalen
from public.off_market_acquisitie_selectie;

-- Actieve dubbele selecties zouden de repository-unique-index tegenspreken.
select count(*) as actieve_signalen_met_meerdere_selecties
from (
  select signaal_id
  from public.off_market_acquisitie_selectie
  where archived_at is null
  group by signaal_id
  having count(*) > 1
) d;

-- ---------------------------------------------------------------------------
-- J. Compacte expliciete statusconstraint-check voor BUILD A
-- ---------------------------------------------------------------------------
select
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid, true) as definition,
  position('concept' in lower(pg_get_constraintdef(con.oid, true))) > 0 as bevat_concept,
  position('verstuurd' in lower(pg_get_constraintdef(con.oid, true))) > 0 as bevat_verstuurd,
  position('definitief' in lower(pg_get_constraintdef(con.oid, true))) > 0 as bevat_definitief,
  position('geannuleerd' in lower(pg_get_constraintdef(con.oid, true))) > 0 as bevat_geannuleerd
from pg_constraint con
where con.conrelid = 'public.off_market_brieven'::regclass
  and con.contype = 'c'
  and con.conname = 'off_market_brieven_status_check';

rollback;
