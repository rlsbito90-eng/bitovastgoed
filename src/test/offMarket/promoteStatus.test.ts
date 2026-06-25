// Regressie: voorkomt dat off_market_promote_to_object opnieuw
// de niet-bestaande object_status-waarde 'nieuw' gaat schrijven.
// De actuele enum bevat: te_beoordelen, beschikbaar, on_hold,
// onder_optie, verkocht, ingetrokken, afgevallen.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Database } from '@/integrations/supabase/client';

const PROMOTIE_STATUS = 'te_beoordelen' as const;

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

function laatsteFunctionDefinitie(): string {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  // Pak de laatst voorkomende migratie die de functie (her)definieert.
  for (const file of [...files].reverse()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    if (/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.off_market_promote_to_object/i.test(sql)) {
      return sql;
    }
  }
  throw new Error('Geen off_market_promote_to_object functie-definitie gevonden');
}

describe('off_market_promote_to_object — statuswaarde', () => {
  it('schrijft expliciet status te_beoordelen', () => {
    const sql = laatsteFunctionDefinitie();
    expect(sql).toMatch(/'te_beoordelen'::public\.object_status/);
  });

  it('mag de oude waarde nieuw niet meer schrijven', () => {
    const sql = laatsteFunctionDefinitie();
    expect(sql).not.toMatch(/'nieuw'::public\.object_status/);
  });

  it('promotie-status bestaat in de actuele object_status enum (compile-time)', () => {
    type ObjectStatus = Database['public']['Enums']['object_status'];
    const status: ObjectStatus = PROMOTIE_STATUS satisfies ObjectStatus;
    expect(status).toBe('te_beoordelen');
  });

  it('alle object_status waarden in deze repo bevatten geen "nieuw"', () => {
    // Sanity-check: de generated types mogen 'nieuw' niet meer bevatten.
    type ObjectStatus = Database['public']['Enums']['object_status'];
    const verboden = 'nieuw';
    // @ts-expect-error 'nieuw' mag geen geldige ObjectStatus zijn
    const v: ObjectStatus = verboden;
    expect(v).toBe('nieuw');
  });
});
