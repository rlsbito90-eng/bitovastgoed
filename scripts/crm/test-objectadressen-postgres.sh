#!/usr/bin/env bash
set -euo pipefail
# De PostgreSQL-service bestaat alleen gedurende deze GitHub Actions-job.
# Nooit productiegegevens of credentials gebruiken.
if ! command -v psql >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y postgresql-client
fi
psql -v ON_ERROR_STOP=1 -f scripts/crm/test-objectadressen-postgres.sql

# Test exact het ontwerpdocument, dat nog géén productiemigratie is.
psql -v ON_ERROR_STOP=1 -f docs/crm/sql/object-adressen-onderdelen-ONTWERP-NIET-UITVOEREN.sql

# Constraintevaluaties en RLS-positief/negatief.
psql -v ON_ERROR_STOP=1 -f scripts/crm/test-objectadressen-verify.sql

# ANON mag helemaal geen SELECT-rechten hebben, zelfs niet op lege tabellen.
if psql -v ON_ERROR_STOP=1 -c "SET ROLE anon; SELECT count(*) FROM public.crm_object_adressen" > /tmp/crm-anon-denied.log 2>&1; then
  echo "FOUT: anon kon adresinformatie lezen."
  exit 1
fi
if ! grep -qi 'permission denied' /tmp/crm-anon-denied.log; then
  echo "FOUT: anon-query faalde om een andere reden dan ontbrekende toegang."
  cat /tmp/crm-anon-denied.log
  exit 1
fi
echo "Tijdelijke PostgreSQL-structuur, RLS en autorisatiechecks geslaagd. Database wordt automatisch afgebroken."
