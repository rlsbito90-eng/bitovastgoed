#!/usr/bin/env bash
set -euo pipefail

readonly PROD_REF_VASTGOED="ljudxyrqoifhfikueric"
readonly APPROVAL_PHRASE="APPLY_BAG_SCHEMA_ONLY_2A4A"
readonly MIGRATION_PATH="supabase/migrations/20260803143000_bag_2a3b_private_schema_candidate.sql"

fail() {
  printf 'BAG 2A.4A GEBLOKKEERD: %s\n' "$1" >&2
  exit 1
}

require_env() {
  local name="$1"
  [[ -n "${!name:-}" ]] || fail "Omgevingsvariabele ${name} ontbreekt."
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Vereist commando ontbreekt: $1."
}

require_env BAG_SHADOW_PROJECT_REF
require_env BAG_EXPECTED_SHADOW_PROJECT_REF
require_env BAG_SHADOW_ENVIRONMENT
require_env BAG_SHADOW_DATABASE_URL
require_command node
require_command psql

[[ "$BAG_SHADOW_PROJECT_REF" =~ ^[a-z0-9]{20}$ ]] \
  || fail 'BAG_SHADOW_PROJECT_REF heeft niet het verwachte Supabase-projectrefformaat.'
[[ "$BAG_EXPECTED_SHADOW_PROJECT_REF" == "$BAG_SHADOW_PROJECT_REF" ]] \
  || fail 'Projectref wijkt af van de vooraf bevestigde shadowprojectref.'
[[ "$BAG_SHADOW_ENVIRONMENT" == 'shadow' ]] \
  || fail 'BAG_SHADOW_ENVIRONMENT moet exact shadow zijn.'

IFS=$'\t' read -r database_host database_user sslmode <<EOF
$(BAG_DATABASE_URL="$BAG_SHADOW_DATABASE_URL" node -e '
  const url = new URL(process.env.BAG_DATABASE_URL);
  process.stdout.write([
    url.hostname,
    decodeURIComponent(url.username),
    url.searchParams.get("sslmode") || "",
  ].join("\t"));
')
EOF

[[ "$database_host" == *.supabase.co || "$database_host" == *.pooler.supabase.com ]] \
  || fail 'Databasehost is geen toegestane Supabase direct- of poolerhost.'
if [[ "$database_host" != *"$BAG_SHADOW_PROJECT_REF"* \
  && "$database_user" != *".$BAG_SHADOW_PROJECT_REF" ]]; then
  fail 'Database-URL behoort niet aantoonbaar bij de bevestigde shadowprojectref.'
fi
[[ "$sslmode" == 'require' || "$sslmode" == 'verify-full' ]] \
  || fail 'Database-URL moet expliciet sslmode=require of verify-full gebruiken.'

production_refs=",${BAG_PRODUCTION_PROJECT_REFS:-$PROD_REF_VASTGOED},"
if [[ "$production_refs" == *",$BAG_SHADOW_PROJECT_REF,"* \
  || "$BAG_SHADOW_PROJECT_REF" == "$PROD_REF_VASTGOED" ]]; then
  fail 'De doelprojectref staat op de productie-denylijst.'
fi

readonly REPORT_DIR="${BAG_SHADOW_REPORT_DIR:-bag-shadow-preflight}"
mkdir -p "$REPORT_DIR"
readonly PREFLIGHT_TSV="$REPORT_DIR/2a4a-preflight.tsv"
readonly VALIDATION_TSV="$REPORT_DIR/2a4a-schema-validation.tsv"
readonly REPORT_JSON="$REPORT_DIR/2a4a-report.json"

export PGOPTIONS='-c statement_timeout=30000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=30000'

psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 -At -F $'\t' >"$PREFLIGHT_TSV" <<'SQL'
BEGIN TRANSACTION READ ONLY;
SELECT pg_catalog.to_regclass('auth.users') IS NOT NULL AS heeft_auth_users \gset
\if :heeft_auth_users
  SELECT count(*)::bigint AS auth_users_aantal FROM auth.users \gset
\else
  \set auth_users_aantal 0
\endif
SELECT pg_catalog.to_regclass('public.objecten') IS NOT NULL AS heeft_objecten \gset
\if :heeft_objecten
  SELECT count(*)::bigint AS objecten_aantal FROM public.objecten \gset
\else
  \set objecten_aantal 0
\endif
SELECT pg_catalog.to_regclass('public.deals') IS NOT NULL AS heeft_deals \gset
\if :heeft_deals
  SELECT count(*)::bigint AS deals_aantal FROM public.deals \gset
\else
  \set deals_aantal 0
\endif
SELECT pg_catalog.to_regclass('public.vastgoedkansen') IS NOT NULL AS heeft_vastgoedkansen \gset
\if :heeft_vastgoedkansen
  SELECT count(*)::bigint AS vastgoedkansen_aantal FROM public.vastgoedkansen \gset
\else
  \set vastgoedkansen_aantal 0
\endif
SELECT pg_catalog.to_regclass('public.off_market_signalen') IS NOT NULL AS heeft_signalen \gset
\if :heeft_signalen
  SELECT count(*)::bigint AS signalen_aantal FROM public.off_market_signalen \gset
\else
  \set signalen_aantal 0
\endif
SELECT
  pg_catalog.current_database(),
  pg_catalog.current_user,
  pg_catalog.current_setting('server_version_num'),
  COALESCE((
    SELECT e.extversion
    FROM pg_catalog.pg_extension AS e
    WHERE e.extname = 'postgis'
  ), ''),
  COALESCE((
    SELECT n.nspname
    FROM pg_catalog.pg_extension AS e
    JOIN pg_catalog.pg_namespace AS n ON n.oid = e.extnamespace
    WHERE e.extname = 'postgis'
  ), ''),
  (
    SELECT count(*)
    FROM pg_catalog.pg_namespace
    WHERE nspname IN ('bag_control', 'bag_staging', 'bag_published')
  ),
  :'auth_users_aantal'::bigint
    + :'objecten_aantal'::bigint
    + :'deals_aantal'::bigint
    + :'vastgoedkansen_aantal'::bigint
    + :'signalen_aantal'::bigint,
  pg_catalog.pg_database_size(pg_catalog.current_database());
COMMIT;
SQL

IFS=$'\t' read -r database_name database_role server_version_num postgis_version \
  postgis_schema bag_schema_count production_row_estimate database_size <"$PREFLIGHT_TSV"

[[ -n "$database_name" && -n "$database_role" ]] \
  || fail 'Database-identiteit kon niet read-only worden vastgesteld.'
(( server_version_num >= 150000 )) \
  || fail 'PostgreSQL 15 of hoger is vereist.'
[[ -n "$postgis_version" ]] \
  || fail 'PostGIS is niet geïnstalleerd.'
[[ "$postgis_schema" == 'extensions' ]] \
  || fail 'PostGIS staat niet in het verwachte private extensions-schema.'
(( bag_schema_count == 0 )) \
  || fail 'Eén of meer BAG-schema’s bestaan al; deze eerste schema-only proef stopt.'
(( production_row_estimate == 0 )) \
  || fail 'CRM- of Auth-rijschattingen vormen een productie-indicator.'

status='ready_for_schema_only'

if [[ "${BAG_SHADOW_APPLY_SCHEMA_ONLY:-false}" == 'true' ]]; then
  [[ "${BAG_SHADOW_SCHEMA_APPROVAL:-}" == "$APPROVAL_PHRASE" ]] \
    || fail "Schema-only uitvoering vereist de exacte approval phrase ${APPROVAL_PHRASE}."
  [[ -f "$MIGRATION_PATH" ]] || fail "Migratiekandidaat ontbreekt: $MIGRATION_PATH."

  psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$MIGRATION_PATH"

  psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 -At -F $'\t' >"$VALIDATION_TSV" <<'SQL'
BEGIN TRANSACTION READ ONLY;
SELECT
  (
    SELECT count(*) FROM pg_catalog.pg_namespace
    WHERE nspname IN ('bag_control', 'bag_staging', 'bag_published')
  ),
  (
    SELECT count(*)
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('bag_control', 'bag_staging', 'bag_published')
      AND c.relkind IN ('r', 'p')
  ),
  (
    SELECT count(*)
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('bag_control', 'bag_staging', 'bag_published')
      AND c.relkind IN ('r', 'p')
      AND c.relrowsecurity
      AND c.relforcerowsecurity
  ),
  (
    SELECT count(*)
    FROM pg_catalog.pg_roles
    WHERE rolname IN ('bag_loader', 'bag_publisher', 'bag_reader')
      AND NOT rolcanlogin
      AND NOT rolsuper
      AND NOT rolcreatedb
      AND NOT rolcreaterole
      AND NOT rolinherit
      AND NOT rolreplication
      AND NOT rolbypassrls
  ),
  (
    SELECT count(*)
    FROM pg_catalog.pg_namespace AS n
    CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(rolnaam)
    WHERE n.nspname IN ('bag_control', 'bag_staging', 'bag_published')
      AND pg_catalog.has_schema_privilege(r.rolnaam, n.oid, 'USAGE')
  ),
  (SELECT count(*) FROM bag_control.datasetversies)
    + (SELECT count(*) FROM bag_control.geometrie_afwijkingen)
    + (SELECT count(*) FROM bag_staging.objecten)
    + (SELECT count(*) FROM bag_staging.voorkomens)
    + (SELECT count(*) FROM bag_staging.relaties)
    + (SELECT count(*) FROM bag_staging.geometrieen)
    + (SELECT count(*) FROM bag_published.objecten)
    + (SELECT count(*) FROM bag_published.voorkomens)
    + (SELECT count(*) FROM bag_published.relaties)
    + (SELECT count(*) FROM bag_published.geometrieen);
COMMIT;
SQL

  IFS=$'\t' read -r schema_count table_count forced_rls_count safe_role_count \
    app_schema_privileges bag_row_estimate <"$VALIDATION_TSV"
  [[ "$schema_count" == '3' ]] || fail 'Schema-only validatie vond niet exact drie BAG-schema’s.'
  [[ "$table_count" == '10' ]] || fail 'Schema-only validatie vond niet exact tien BAG-tabellen.'
  [[ "$forced_rls_count" == '10' ]] || fail 'Niet alle BAG-tabellen hebben geforceerde RLS.'
  [[ "$safe_role_count" == '3' ]] || fail 'De drie afgescheiden BAG-rollen zijn niet veilig geconfigureerd.'
  [[ "$app_schema_privileges" == '0' ]] || fail 'Een standaard-applicatierol heeft BAG-schema-USAGE.'
  [[ "$bag_row_estimate" == '0' ]] || fail 'Schema-only proef heeft onverwacht BAG-data aangemaakt.'
  status='schema_only_validated'
fi

REPORT_STATUS="$status" REPORT_PROJECT_REF="$BAG_SHADOW_PROJECT_REF" \
REPORT_DATABASE_HOST="$database_host" REPORT_DATABASE_NAME="$database_name" \
REPORT_DATABASE_ROLE="$database_role" REPORT_SERVER_VERSION="$server_version_num" \
REPORT_POSTGIS_VERSION="$postgis_version" REPORT_DATABASE_SIZE="$database_size" \
node -e '
  const report = {
    build: "2A.4A",
    status: process.env.REPORT_STATUS,
    environment: "shadow",
    projectRef: process.env.REPORT_PROJECT_REF,
    databaseHost: process.env.REPORT_DATABASE_HOST,
    databaseName: process.env.REPORT_DATABASE_NAME,
    databaseRole: process.env.REPORT_DATABASE_ROLE,
    serverVersionNum: Number(process.env.REPORT_SERVER_VERSION),
    postgisVersion: process.env.REPORT_POSTGIS_VERSION,
    databaseSizeBytes: Number(process.env.REPORT_DATABASE_SIZE),
    importedRows: 0,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
' >"$REPORT_JSON"

printf 'BAG 2A.4A: %s — rapport: %s\n' "$status" "$REPORT_JSON"
