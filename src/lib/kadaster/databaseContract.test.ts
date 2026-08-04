import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  KADASTER_BRON_MODULES,
  KADASTER_SCHEMA_TABLES,
} from './databaseContract';

const objectMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260804150000_crm_objectidentiteit.sql'),
  'utf8',
);
const kostenMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260804152000_kadaster_kostenbeheer.sql'),
  'utf8',
);
const preflight = readFileSync(
  resolve(process.cwd(), 'supabase/verification/kadaster_schema_preflight.sql'),
  'utf8',
);

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
    expect(preflight).not.toMatch(/\b(insert|update|delete|alter|create|drop|truncate)\b/i);
    expect(preflight).toContain('unsafe_browser_write_policy');
  });
});
