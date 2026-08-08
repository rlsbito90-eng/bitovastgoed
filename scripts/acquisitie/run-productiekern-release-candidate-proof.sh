#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/postgres}"
CANDIDATE="dist/acquisitie-productiekern/20260808_acquisitie_productiekern_release_candidate.sql"
GENERATOR="scripts/acquisitie/genereer-productiekern-release-candidate.mjs"

psql_safe() {
  psql "$DB_URL" -v ON_ERROR_STOP=1 "$@"
}

rm -rf "$(dirname "$CANDIDATE")"
node "$GENERATOR" "$CANDIDATE" >/dev/null

if [[ ! -s "$CANDIDATE" ]]; then
  echo "Releasekandidaat ontbreekt of is leeg" >&2
  exit 1
fi

if grep -q "20260808_acquisitie_productiekern_activatie_security.sql.*RELEASEDEEL" "$CANDIDATE"; then
  echo "Activatie-security is onterecht in releasekandidaat opgenomen" >&2
  exit 1
fi
if grep -Eqi '^\s*(grant select|grant execute).*authenticated' "$CANDIDATE"; then
  echo "Releasekandidaat bevat onbedoelde activatiegrant" >&2
  exit 1
fi

# Synthetisch bestaand CRM-contract voor uitsluitend tijdelijke CI-PostgreSQL.
# Dit benadert geen Supabase-project en is geen vervanging voor de reeds uitgevoerde
# read-only productie-DDL/RLS-verificatie.
psql_safe <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;

CREATE OR REPLACE FUNCTION public.is_intern_gebruiker(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT false $$;

CREATE TABLE public.off_market_acquisitie_selectie (
  id uuid PRIMARY KEY,
  signaal_id uuid NOT NULL,
  toegevoegd_door uuid NULL,
  toegevoegd_op timestamptz NOT NULL DEFAULT now(),
  notitie text NULL,
  archived_at timestamptz NULL
);

CREATE TABLE public.off_market_brieven (
  id uuid PRIMARY KEY,
  signaal_id uuid NULL,
  status text NOT NULL DEFAULT 'concept',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT off_market_brieven_status_check CHECK (status IN ('concept','verstuurd'))
);
SQL

psql_safe -f "$CANDIDATE"

# Structuur, publieke wrappers en interne implementaties bestaan na COMMIT.
table_count="$(psql_safe -Atqc "select count(*) from information_schema.tables where table_schema='public' and table_name in ('off_market_acquisitie_dossiers','off_market_brief_versies','off_market_printbatches','off_market_printbatch_brieven','off_market_batchdocumenten','off_market_productie_events','off_market_productie_nummerreeksen');")"
if [[ "$table_count" != "7" ]]; then
  echo "Releasekandidaat mist tabellen: $table_count/7" >&2
  exit 1
fi

public_rpc_count="$(psql_safe -Atqc "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('off_market_verwerking_starten','off_market_brief_reserveren','off_market_briefversie_aanmaken','off_market_printbatch_aanmaken','off_market_briefversie_aan_batch_toevoegen','off_market_brief_definitief_maken','off_market_batch_documenten_registreren','off_market_batch_geprint_markeren','off_market_brief_gepost_markeren');")"
internal_rpc_count="$(psql_safe -Atqc "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('off_market_verwerking_starten_intern','off_market_brief_reserveren_intern','off_market_briefversie_aanmaken_intern','off_market_printbatch_aanmaken_intern','off_market_briefversie_aan_batch_toevoegen_intern','off_market_brief_definitief_maken_intern','off_market_batch_documenten_registreren_intern','off_market_batch_geprint_markeren_intern','off_market_brief_gepost_markeren_intern');")"
if [[ "$public_rpc_count" != "9" || "$internal_rpc_count" != "9" ]]; then
  echo "RPC-wrapperstructuur onvolledig: public=$public_rpc_count intern=$internal_rpc_count" >&2
  exit 1
fi

status_constraint="$(psql_safe -Atqc "select pg_get_constraintdef(c.oid) from pg_constraint c where c.conrelid='public.off_market_brieven'::regclass and c.conname='off_market_brieven_status_check';")"
for status in concept verstuurd definitief geannuleerd; do
  if [[ "${status_constraint,,}" != *"$status"* ]]; then
    echo "Legacycompatibele briefstatus ontbreekt: $status" >&2
    exit 1
  fi
done

# Release installeert structuur maar activeert geen clienttoegang.
read_grants="$(psql_safe -Atqc "select count(*) from information_schema.role_table_grants where grantee='authenticated' and privilege_type='SELECT' and table_schema='public' and table_name in ('off_market_acquisitie_dossiers','off_market_brief_versies','off_market_printbatches','off_market_printbatch_brieven');")"
execute_grants="$(psql_safe -Atqc "select count(*) from information_schema.routine_privileges where grantee='authenticated' and routine_schema='public' and routine_name in ('off_market_verwerking_starten','off_market_brief_reserveren','off_market_briefversie_aanmaken','off_market_printbatch_aanmaken','off_market_briefversie_aan_batch_toevoegen','off_market_brief_definitief_maken','off_market_batch_documenten_registreren','off_market_batch_geprint_markeren','off_market_brief_gepost_markeren');")"
if [[ "$read_grants" != "0" || "$execute_grants" != "0" ]]; then
  echo "Releasekandidaat activeerde clienttoegang: select=$read_grants execute=$execute_grants" >&2
  exit 1
fi

policy_count="$(psql_safe -Atqc "select count(*) from pg_policies where schemaname='public' and policyname like 'acquisitie_productiekern_%';")"
if [[ "$policy_count" != "0" ]]; then
  echo "Releasekandidaat bevat onbedoelde activatiepolicies: $policy_count" >&2
  exit 1
fi

# Geen backfill: bestaande legacybrief blijft legacy en krijgt geen fictief nummer/selectie.
psql_safe <<'SQL'
INSERT INTO public.off_market_brieven (id, signaal_id, status)
VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'verstuurd');
SQL
legacy_backfill="$(psql_safe -Atqc "select count(*) from public.off_market_brieven where id='11111111-1111-1111-1111-111111111111' and briefnummer is null and selectie_id is null;")"
if [[ "$legacy_backfill" != "1" ]]; then
  echo "Legacybrief is onbedoeld teruggevuld" >&2
  exit 1
fi

echo "PRODUCTIEKERN_RELEASE_CANDIDATE_PROOF_OK"
