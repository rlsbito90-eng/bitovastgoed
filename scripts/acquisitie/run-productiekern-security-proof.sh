#!/usr/bin/env bash
set -euo pipefail

BASE_DRAFT="supabase/migration-drafts/20260806_acquisitie_productiekern_build_a.sql"
DOSSIER_DRAFT="supabase/migration-drafts/20260806_acquisitie_productiekern_dossier_briefkern.sql"
TRANSACTIE_DRAFT="supabase/migration-drafts/20260806_acquisitie_productiekern_transactionele_functies.sql"
VROEG_DRAFT="supabase/migration-drafts/20260808_acquisitie_productiekern_vroege_transactionele_functies.sql"
SECURITY_DRAFT="supabase/migration-drafts/20260808_acquisitie_productiekern_security_wrappers.sql"
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/postgres}"

psql_safe() { psql "$DB_URL" -v ON_ERROR_STOP=1 "$@"; }
commit_variant() { local t; t="$(mktemp)"; sed 's/^rollback;$/commit;/' "$1" > "$t"; printf '%s\n' "$t"; }
expect_failure() {
  local expected="$1" output status
  shift
  set +e
  output="$("$@" 2>&1)"; status=$?
  set -e
  [[ "$status" != "0" ]] || { echo "Verwachte fout bleef uit: $expected" >&2; exit 1; }
  [[ "$output" == *"$expected"* ]] || { echo "Onverwachte fout. Verwacht '$expected', kreeg: $output" >&2; exit 1; }
}

for f in "$BASE_DRAFT" "$DOSSIER_DRAFT" "$TRANSACTIE_DRAFT" "$VROEG_DRAFT" "$SECURITY_DRAFT"; do
  [[ -f "$f" ]] || { echo "Ontbrekend reviewbestand: $f" >&2; exit 1; }
done

psql_safe <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
CREATE SCHEMA public;
CREATE SCHEMA auth;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA auth TO postgres;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
GRANT USAGE ON SCHEMA public, auth TO authenticated;

-- CI-equivalent van Supabase auth.uid(): uitsluitend session claim lezen.
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE TABLE public.proof_internal_users (user_id uuid PRIMARY KEY);
CREATE FUNCTION public.is_intern_gebruiker(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.proof_internal_users WHERE user_id=_user_id)
$$;

-- Minimale, productie-vormige shells voor de reeds bewezen drafts.
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
  signaal_id uuid NOT NULL,
  brieftekst text NOT NULL DEFAULT '',
  onderwerp text NULL,
  objectadres text NULL,
  objectomschrijving text NULL,
  aanhef text NULL,
  eigenaar_naam text NULL,
  eigenaar_bedrijfsnaam text NULL,
  status text NOT NULL DEFAULT 'concept',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT off_market_brieven_status_check CHECK (status IN ('concept','verstuurd'))
);
SQL

BASE_COMMIT="$(commit_variant "$BASE_DRAFT")"
DOSSIER_COMMIT="$(commit_variant "$DOSSIER_DRAFT")"
TRANSACTIE_COMMIT="$(commit_variant "$TRANSACTIE_DRAFT")"
VROEG_COMMIT="$(commit_variant "$VROEG_DRAFT")"
SECURITY_COMMIT="$(commit_variant "$SECURITY_DRAFT")"
trap 'rm -f "$BASE_COMMIT" "$DOSSIER_COMMIT" "$TRANSACTIE_COMMIT" "$VROEG_COMMIT" "$SECURITY_COMMIT"' EXIT

psql_safe -f "$BASE_COMMIT" >/dev/null
psql_safe -f "$DOSSIER_COMMIT" >/dev/null
psql_safe -f "$TRANSACTIE_COMMIT" >/dev/null
psql_safe -f "$VROEG_COMMIT" >/dev/null
psql_safe -f "$SECURITY_COMMIT" >/dev/null

INTERN="31000000-0000-0000-0000-000000000001"
EXTERN="32000000-0000-0000-0000-000000000001"
SELECTIE="11000000-0000-0000-0000-000000000001"
SIGNAAL="21000000-0000-0000-0000-000000000001"

psql_safe -qc "insert into public.proof_internal_users(user_id) values ('$INTERN'); insert into public.off_market_acquisitie_selectie(id,signaal_id) values ('$SELECTIE','$SIGNAAL');"

# In productie zou een aparte expliciete activatiemigratie uitsluitend deze
# wrappergrants kunnen toevoegen. Hier gebeurt dat alleen in de tijdelijke CI-db.
psql_safe <<'SQL'
GRANT EXECUTE ON FUNCTION public.off_market_verwerking_starten(uuid,uuid,text,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.off_market_brief_reserveren(uuid,uuid,text,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.off_market_briefversie_aanmaken(uuid,uuid,text,timestamptz,jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.off_market_printbatch_aanmaken(uuid,text,timestamptz,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.off_market_briefversie_aan_batch_toevoegen(uuid,uuid,uuid,uuid,text,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.off_market_brief_definitief_maken(uuid,uuid,uuid,text,integer,timestamptz,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.off_market_batch_documenten_registreren(uuid,uuid,text,integer,timestamptz,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.off_market_batch_geprint_markeren(uuid,uuid,text,integer,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.off_market_brief_gepost_markeren(uuid,uuid,uuid,text,uuid,text,integer,timestamptz) TO authenticated;
SQL

# 1. Geen JWT -> fail closed vóór enige mutatie.
expect_failure productiekern_auth_verplicht psql "$DB_URL" -v ON_ERROR_STOP=1 -qc \
"set role authenticated; select * from public.off_market_verwerking_starten('$SELECTIE','$INTERN','security:no-jwt','2026-08-08T12:00:00Z');"
[[ "$(psql_safe -Atqc "select count(*) from public.off_market_productie_events where operation_key='security:no-jwt';")" == "0" ]] || { echo "Auth-fout liet audit achter" >&2; exit 1; }

# 2. Authenticated maar niet intern -> geweigerd.
expect_failure productiekern_intern_gebruiker_verplicht psql "$DB_URL" -v ON_ERROR_STOP=1 -qc \
"select set_config('request.jwt.claim.sub','$EXTERN',false); set role authenticated; select * from public.off_market_verwerking_starten('$SELECTIE','$EXTERN','security:extern','2026-08-08T12:01:00Z');"
[[ "$(psql_safe -Atqc "select count(*) from public.off_market_productie_events where operation_key='security:extern';")" == "0" ]] || { echo "Externe gebruiker liet audit achter" >&2; exit 1; }

# 3. Interne JWT maar actor spoofing -> geweigerd.
expect_failure productiekern_actor_mismatch psql "$DB_URL" -v ON_ERROR_STOP=1 -qc \
"select set_config('request.jwt.claim.sub','$INTERN',false); set role authenticated; select * from public.off_market_verwerking_starten('$SELECTIE','$EXTERN','security:spoof','2026-08-08T12:02:00Z');"
[[ "$(psql_safe -Atqc "select count(*) from public.off_market_productie_events where operation_key='security:spoof';")" == "0" ]] || { echo "Actor-spoof liet audit achter" >&2; exit 1; }

# 4. Interne JWT + eigen actor -> toegestaan en exact één audit-event.
psql_safe -qc "select set_config('request.jwt.claim.sub','$INTERN',false); set role authenticated; select * from public.off_market_verwerking_starten('$SELECTIE','$INTERN','security:intern','2026-08-08T12:03:00Z');"
[[ "$(psql_safe -Atqc "select count(*) from public.off_market_productie_events where operation_key='security:intern' and actor_id='$INTERN';")" == "1" ]] || { echo "Interne actor werd niet correct geaudit" >&2; exit 1; }

# 5. Directe toegang tot helper en *_intern blijft voor authenticated dicht.
helper_acl="$(psql_safe -Atqc "select has_function_privilege('authenticated','public.off_market_productiekern_assert_interne_actor(uuid)','EXECUTE');")"
inner_acl="$(psql_safe -Atqc "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'off_market_%_intern' and has_function_privilege('authenticated',p.oid,'EXECUTE');")"
wrapper_acl="$(psql_safe -Atqc "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('off_market_verwerking_starten','off_market_brief_reserveren','off_market_briefversie_aanmaken','off_market_printbatch_aanmaken','off_market_briefversie_aan_batch_toevoegen','off_market_brief_definitief_maken','off_market_batch_documenten_registreren','off_market_batch_geprint_markeren','off_market_brief_gepost_markeren') and has_function_privilege('authenticated',p.oid,'EXECUTE');")"
[[ "$helper_acl" == "f" && "$inner_acl" == "0" && "$wrapper_acl" == "9" ]] || { echo "Security ACL bewijs faalde: helper=$helper_acl inner=$inner_acl wrappers=$wrapper_acl" >&2; exit 1; }

echo "PRODUCTIEKERN_SECURITY_PROOF_OK"
