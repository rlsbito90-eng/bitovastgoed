import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pad = 'scripts/bag/run-2a4a-shadow-preflight.sh';
const script = readFileSync(resolve(process.cwd(), pad), 'utf-8');
const compact = script.replace(/\s+/g, ' ').trim();

describe('BAG 2A.4A shadow-preflight', () => {
  it('faalt gesloten zonder expliciete shadowidentiteit en database-URL', () => {
    for (const naam of [
      'BAG_SHADOW_PROJECT_REF',
      'BAG_EXPECTED_SHADOW_PROJECT_REF',
      'BAG_SHADOW_ENVIRONMENT',
      'BAG_SHADOW_DATABASE_URL',
    ]) {
      expect(script).toContain(`require_env ${naam}`);
    }
    expect(script).toContain("BAG_SHADOW_ENVIRONMENT\" == 'shadow'");
    expect(script).toContain('Database-URL behoort niet aantoonbaar');
  });

  it('blokkeert de bekende productieprojectref en aanvullende denylistrefs', () => {
    expect(script).toContain('readonly PROD_REF_VASTGOED="ljudxyrqoifhfikueric"');
    expect(script).toContain('BAG_PRODUCTION_PROJECT_REFS');
    expect(script).toContain('De doelprojectref staat op de productie-denylijst.');
    expect(script).not.toContain('supabase/config.toml`');
  });

  it('staat uitsluitend Supabase direct/session-pooler met expliciete TLS toe', () => {
    expect(script).toContain('*.supabase.co');
    expect(script).toContain('*.pooler.supabase.com');
    expect(script).toContain("sslmode\" == 'require'");
    expect(script).toContain("sslmode\" == 'verify-full'");
    expect(script).not.toContain('sslmode=disable');
  });

  it('voert eerst een read-only preflight met begrensde time-outs uit', () => {
    expect(script).toContain('BEGIN TRANSACTION READ ONLY;');
    expect(script).toContain('statement_timeout=30000');
    expect(script).toContain('lock_timeout=5000');
    expect(script).toContain('idle_in_transaction_session_timeout=30000');
    expect(script).toContain("postgis_schema\" == 'extensions'");
    expect(script).toContain('production_row_estimate == 0');
    expect(script).toContain('bag_schema_count == 0');
    expect(script).toContain("to_regclass('auth.users')");
    expect(script).toContain('SELECT count(*)::bigint AS auth_users_aantal FROM auth.users');
    expect(script).toContain('SELECT count(*)::bigint AS objecten_aantal FROM public.objecten');
    expect(script).not.toContain('reltuples');
  });

  it('kan zonder approval phrase nooit de migratie uitvoeren', () => {
    const approvalPositie = script.indexOf('BAG_SHADOW_SCHEMA_APPROVAL');
    const migratiePositie = script.indexOf('psql "$BAG_SHADOW_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f');
    expect(script).toContain('APPLY_BAG_SCHEMA_ONLY_2A4A');
    expect(approvalPositie).toBeGreaterThan(0);
    expect(migratiePositie).toBeGreaterThan(approvalPositie);
    expect(compact).not.toContain('INSERT INTO bag_');
    expect(compact).not.toContain('\\copy');
  });

  it('bewijst na schema-only exact drie schemas, tien lege tabellen en veilige rollen', () => {
    expect(script).toContain("[[ \"$schema_count\" == '3' ]]");
    expect(script).toContain("[[ \"$table_count\" == '10' ]]");
    expect(script).toContain("[[ \"$forced_rls_count\" == '10' ]]");
    expect(script).toContain("[[ \"$safe_role_count\" == '3' ]]");
    expect(script).toContain("[[ \"$app_schema_privileges\" == '0' ]]");
    expect(script).toContain("[[ \"$bag_row_estimate\" == '0' ]]");
  });

  it('schrijft een controleerbaar rapport zonder database-URL of wachtwoord', () => {
    expect(script).toContain('2a4a-report.json');
    expect(script).toContain('importedRows: 0');
    const rapportBlok = script.slice(script.indexOf("REPORT_STATUS=\"$status\""));
    expect(rapportBlok).not.toContain('BAG_SHADOW_DATABASE_URL');
    expect(rapportBlok).not.toContain('password');
  });
});
