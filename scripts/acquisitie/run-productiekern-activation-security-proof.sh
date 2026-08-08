#!/usr/bin/env bash
set -euo pipefail

ACTIVATION_DRAFT="supabase/migration-drafts/20260808_acquisitie_productiekern_activatie_security.sql"
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/postgres}"
INTERN="31000000-0000-0000-0000-000000000001"
EXTERN="32000000-0000-0000-0000-000000000001"

[[ -f "$ACTIVATION_DRAFT" ]] || { echo "Ontbrekende activatie-reviewdraft" >&2; exit 1; }
ACTIVATION_COMMIT="$(mktemp)"
sed 's/^rollback;$/commit;/' "$ACTIVATION_DRAFT" > "$ACTIVATION_COMMIT"
trap 'rm -f "$ACTIVATION_COMMIT"' EXIT
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$ACTIVATION_COMMIT" >/dev/null

# Interne gebruiker ziet het bestaande dossier via RLS.
internal_count="$(psql "$DB_URL" -v ON_ERROR_STOP=1 -Atqc "select set_config('request.jwt.claim.sub','$INTERN',false); set role authenticated; select count(*) from public.off_market_acquisitie_dossiers;")"
internal_count="$(printf '%s\n' "$internal_count" | tail -n 1)"
[[ "$internal_count" == "1" ]] || { echo "Interne SELECT faalde: $internal_count" >&2; exit 1; }

# Externe authenticated gebruiker heeft wel tabel-SELECT maar RLS levert 0 rijen.
external_count="$(psql "$DB_URL" -v ON_ERROR_STOP=1 -Atqc "select set_config('request.jwt.claim.sub','$EXTERN',false); set role authenticated; select count(*) from public.off_market_acquisitie_dossiers;")"
external_count="$(printf '%s\n' "$external_count" | tail -n 1)"
[[ "$external_count" == "0" ]] || { echo "Externe RLS lekte dossiers: $external_count" >&2; exit 1; }

# Zonder JWT eveneens 0 rijen.
nojwt_count="$(psql "$DB_URL" -v ON_ERROR_STOP=1 -Atqc "set role authenticated; select count(*) from public.off_market_acquisitie_dossiers;")"
[[ "$nojwt_count" == "0" ]] || { echo "JWT-loze read lekte dossiers: $nojwt_count" >&2; exit 1; }

# Directe writes moeten al op privilege-niveau blokkeren.
set +e
write_output="$(psql "$DB_URL" -v ON_ERROR_STOP=1 -qc "select set_config('request.jwt.claim.sub','$INTERN',false); set role authenticated; insert into public.off_market_acquisitie_dossiers(id,selectie_id,signaal_id,primaire_werkbak) values (gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'nieuwe_selectie');" 2>&1)"
write_status=$?
set -e
[[ "$write_status" != "0" && "$write_output" == *"permission denied"* ]] || { echo "Directe dossierwrite was niet privilege-geblokkeerd: $write_output" >&2; exit 1; }

# ACL-matrix: vier readtabellen alleen SELECT; wrappers execute; intern/helper dicht.
read_acl="$(psql "$DB_URL" -Atqc "select count(*) from (values ('off_market_acquisitie_dossiers'),('off_market_brief_versies'),('off_market_printbatches'),('off_market_printbatch_brieven')) v(t) where has_table_privilege('authenticated','public.'||t,'SELECT') and not has_table_privilege('authenticated','public.'||t,'INSERT') and not has_table_privilege('authenticated','public.'||t,'UPDATE') and not has_table_privilege('authenticated','public.'||t,'DELETE');")"
wrapper_acl="$(psql "$DB_URL" -Atqc "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('off_market_verwerking_starten','off_market_brief_reserveren','off_market_briefversie_aanmaken','off_market_printbatch_aanmaken','off_market_briefversie_aan_batch_toevoegen','off_market_brief_definitief_maken','off_market_batch_documenten_registreren','off_market_batch_geprint_markeren','off_market_brief_gepost_markeren') and has_function_privilege('authenticated',p.oid,'EXECUTE') and not has_function_privilege('anon',p.oid,'EXECUTE');")"
inner_acl="$(psql "$DB_URL" -Atqc "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'off_market_%_intern' or p.proname='off_market_productiekern_assert_interne_actor') and has_function_privilege('authenticated',p.oid,'EXECUTE');")"
[[ "$read_acl" == "4" && "$wrapper_acl" == "9" && "$inner_acl" == "0" ]] || { echo "Activatie ACL-matrix faalde: reads=$read_acl wrappers=$wrapper_acl intern=$inner_acl" >&2; exit 1; }

echo "PRODUCTIEKERN_ACTIVATION_SECURITY_PROOF_OK"
