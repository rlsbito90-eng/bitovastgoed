import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync('supabase/migrations/20260812234500_acquisitie_selectie_vastgoedkansen.sql', 'utf8');

describe('BUILD 2.0A.3 — polymorfe acquisitieselectie', () => {
  it('breidt het legacy contract uit zonder signaalrecords te herschrijven', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS vastgoedkans_id uuid');
    expect(sql).toContain('ALTER COLUMN signaal_id DROP NOT NULL');
    expect(sql).toContain('num_nonnulls(signaal_id, vastgoedkans_id) = 1');
    expect(sql).toContain('REFERENCES public.vastgoedkansen(id)');
    expect(sql).toContain('off_market_acquisitie_selectie_vastgoedkans_actief_uniek');
    expect(sql).not.toMatch(/UPDATE\s+public\.off_market_acquisitie_selectie/i);
    expect(sql).not.toMatch(/INSERT\s+INTO\s+public\.off_market_signalen/i);
  });
});
