import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  KADASTER_BRON_MODULES,
  KADASTER_SCHEMA_TABLES,
} from './databaseContract';

const objectMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migration-archive/pre-baseline-snapshot/20260804150000_crm_objectidentiteit.sql'),
  'utf8',
);
const kostenMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migration-archive/pre-baseline-snapshot/20260804152000_kadaster_kostenbeheer.sql'),
  'utf8',
);
const preflight = readFileSync(
  resolve(process.cwd(), 'supabase/verification/kadaster_schema_preflight.sql'),
  'utf8',
);

const stripSqlCommentsAndStrings = (sql: string): string =>
  sql
    .replace(/--.*$/gm, '')
    .replace(/'(?:''|[^'])*'/g, "''");

describe('Kadaster databasecontract', () => {
  it('houdt het TypeScript-contract gelijk aan de repositorymigraties', () => {
    for (const table of KADASTER_SCHEMA_TABLES) {
      expect(`${objectMigration}\n${kostenMigration}`).toContain(table);
      expect(preflight).toContain(table);
    }
  });

  it('ondersteunt één centrale app-brede modulelijst', () => {
    expect(KADASTER_BRON_MODULES).toEqual([
      'vastgoedkansen',
      'off_market_radar',
      'objecten',
      'acquisitie',
      'deals',
      'pandenverkenner',
      'snelle_pandcheck',
      'referentieobjecten',
      'vastgoedrekenen',
    ]);
    for (const module of KADASTER_BRON_MODULES) expect(kostenMigration).toContain(module);
  });

  it('houdt kosten-events browser-read-only en de preflight read-only', () => {
    expect(kostenMigration).toContain('Browserrollen krijgen bewust geen INSERT/UPDATE/DELETE-policy');
    const uitvoerbarePreflight = stripSqlCommentsAndStrings(preflight);
    expect(uitvoerbarePreflight).not.toMatch(
      /\b(insert\s+into|update\s+[a-z_]|delete\s+from|alter\s+table|create\s+(?:table|policy|function|index)|drop\s+(?:table|policy|function|index)|truncate\s+)\b/i,
    );
    expect(preflight).toContain('unsafe_browser_write_policy');
  });

  it('heeft geen externe has_role-afhankelijkheid en vertrouwt alleen serverbeheerste app_metadata', () => {
    expect(objectMigration).toContain('create or replace function public.is_app_admin()');
    expect(objectMigration).toContain("auth.jwt() -> 'app_metadata' ->> 'role'");
    expect(objectMigration).not.toMatch(/auth\.jwt\(\)\s*->\s*'user_metadata'/i);
    expect(kostenMigration).toContain('public.is_app_admin()');
    expect(kostenMigration).not.toContain('public.has_role');
  });

  it('geeft niet langer alle authenticated gebruikers onbeperkte objectmutaties', () => {
    expect(objectMigration).not.toMatch(/for all to authenticated\s+using \(true\) with check \(true\)/i);
    expect(objectMigration).toContain('created_by = auth.uid() or public.is_app_admin()');
    expect(objectMigration).toContain('crm_objectregistraties_beheerder_verwijderen');
  });
});
