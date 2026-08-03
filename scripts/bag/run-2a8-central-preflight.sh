#!/usr/bin/env bash
set -euo pipefail

readonly KNOWN_PRODUCTION_REF="ljudxyrqoifhfikueric"
readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly SQL_PATH="$ROOT_DIR/experiments/bag/2a8/central-preflight.sql"

fail() {
  printf 'BAG 2A.8 GEBLOKKEERD: %s\n' "$1" >&2
  exit 1
}

require_env() {
  local name="$1"
  [[ -n "${!name:-}" ]] || fail "Omgevingsvariabele ${name} ontbreekt."
}

require_env BAG_SHADOW_PROJECT_REF
require_env BAG_EXPECTED_SHADOW_PROJECT_REF
require_env BAG_SHADOW_ENVIRONMENT
require_env BAG_SHADOW_DATABASE_URL
require_env BAG_PREFLIGHT_EXPECTATION

command -v node >/dev/null 2>&1 || fail 'Vereist commando ontbreekt: node.'
command -v psql >/dev/null 2>&1 || fail 'Vereist commando ontbreekt: psql.'
[[ -f "$SQL_PATH" ]] || fail "SQL-controlebestand ontbreekt: ${SQL_PATH}."

[[ "$BAG_SHADOW_PROJECT_REF" =~ ^[a-z0-9]{20}$ ]] \
  || fail 'BAG_SHADOW_PROJECT_REF heeft niet het verwachte projectrefformaat.'
[[ "$BAG_EXPECTED_SHADOW_PROJECT_REF" == "$BAG_SHADOW_PROJECT_REF" ]] \
  || fail 'Projectref wijkt af van de vooraf bevestigde shadowprojectref.'
[[ "$BAG_SHADOW_ENVIRONMENT" == 'shadow' ]] \
  || fail 'BAG_SHADOW_ENVIRONMENT moet exact shadow zijn.'
[[ "$BAG_PREFLIGHT_EXPECTATION" == 'clean-shadow' \
  || "$BAG_PREFLIGHT_EXPECTATION" == 'active-dataset' ]] \
  || fail 'BAG_PREFLIGHT_EXPECTATION moet clean-shadow of active-dataset zijn.'
if [[ "$BAG_PREFLIGHT_EXPECTATION" == 'active-dataset' ]]; then
  [[ "${BAG_PREFLIGHT_SCOPE_CODE:-}" =~ ^[A-Za-z0-9_-]{1,64}$ ]] \
    || fail 'Active-dataset vereist een geldige BAG_PREFLIGHT_SCOPE_CODE.'
fi

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

production_refs=",${BAG_PRODUCTION_PROJECT_REFS:-$KNOWN_PRODUCTION_REF},"
if [[ "$production_refs" == *",$BAG_SHADOW_PROJECT_REF,"* \
  || "$BAG_SHADOW_PROJECT_REF" == "$KNOWN_PRODUCTION_REF" \
  || "$BAG_SHADOW_DATABASE_URL" == *"$KNOWN_PRODUCTION_REF"* ]]; then
  fail 'Het doel staat op de productie-denylijst.'
fi

readonly REPORT_DIR="${BAG_PREFLIGHT_REPORT_DIR:-bag-central-preflight}"
readonly CHECKS_TSV="$REPORT_DIR/2a8-checks.tsv"
readonly REPORT_JSON="$REPORT_DIR/2a8-report.json"
mkdir -p "$REPORT_DIR"

export PGOPTIONS='-c statement_timeout=30000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=30000'
psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 -At -F $'\t' \
  -v expectation="$BAG_PREFLIGHT_EXPECTATION" \
  -v scope_code="${BAG_PREFLIGHT_SCOPE_CODE:-}" \
  -f "$SQL_PATH" >"$CHECKS_TSV"

REPORT_PROJECT_REF="$BAG_SHADOW_PROJECT_REF" \
REPORT_EXPECTATION="$BAG_PREFLIGHT_EXPECTATION" \
REPORT_SCOPE_CODE="${BAG_PREFLIGHT_SCOPE_CODE:-}" \
REPORT_CHECKS_TSV="$CHECKS_TSV" \
REPORT_JSON="$REPORT_JSON" \
node <<'NODE'
const fs = require('node:fs');

const rows = fs.readFileSync(process.env.REPORT_CHECKS_TSV, 'utf8')
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [name, passed, actual, expected] = line.split('\t');
    return { name, passed: passed === '1', actual, expected };
  });
const failed = rows.filter((row) => !row.passed);
const report = {
  build: '2A.8',
  status: failed.length === 0 ? 'green' : 'blocked',
  environment: 'shadow',
  projectRef: process.env.REPORT_PROJECT_REF,
  expectation: process.env.REPORT_EXPECTATION,
  scopeCode: process.env.REPORT_SCOPE_CODE || null,
  readOnly: true,
  checks: rows,
  failedChecks: failed.map((row) => row.name),
};
fs.writeFileSync(process.env.REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);
if (failed.length) {
  process.stderr.write(`BAG 2A.8 GEBLOKKEERD: ${failed.map((row) => row.name).join(', ')}\n`);
  process.exit(1);
}
NODE

printf 'BUILD 2A.8 centrale preflight groen: %s (%s). Rapport: %s\n' \
  "$BAG_SHADOW_PROJECT_REF" "$BAG_PREFLIGHT_EXPECTATION" "$REPORT_JSON"
