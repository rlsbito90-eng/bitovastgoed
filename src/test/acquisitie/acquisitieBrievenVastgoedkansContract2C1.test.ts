import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { acquisitieDossierNaarBriefPersistenceTarget } from '@/lib/acquisitieBriefPersistenceTarget';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260813111500_acquisitie_brieven_vastgoedkans_contract.sql'),
  'utf8',
);

describe('BUILD 2.0C.1 — Vastgoedkans brief persistence contract', () => {
  it('mapt Off-Market naar alleen signaal_id', () => {
    expect(acquisitieDossierNaarBriefPersistenceTarget({ bronType: 'off_market_signaal', bronId: ' signaal-1 ' }))
      .toEqual({ signaal_id: 'signaal-1', vastgoedkans_id: null, dossier_type: 'off_market_signaal' });
  });

  it('mapt Vastgoedkans naar alleen vastgoedkans_id', () => {
    expect(acquisitieDossierNaarBriefPersistenceTarget({ bronType: 'vastgoedkans', bronId: ' kans-1 ' }))
      .toEqual({ signaal_id: null, vastgoedkans_id: 'kans-1', dossier_type: 'vastgoedkans' });
  });

  it('weigert een lege bron-ID', () => {
    expect(() => acquisitieDossierNaarBriefPersistenceTarget({ bronType: 'vastgoedkans', bronId: '  ' }))
      .toThrow(/bron-ID/i);
  });

  it('maakt off_market_brieven additief dossierbreed zonder bestaande rijen te herschrijven', () => {
    expect(migration).toContain('add column if not exists vastgoedkans_id uuid null');
    expect(migration).toContain('alter column signaal_id drop not null');
    expect(migration).toContain('off_market_brieven_vastgoedkans_id_fkey');
    expect(migration).toContain('off_market_brieven_exact_een_dossier_check');
    expect(migration).toContain('num_nonnulls(signaal_id, vastgoedkans_id) = 1');
    expect(migration).not.toMatch(/update\s+public\.off_market_brieven/i);
  });

  it('maakt brief-events dossierbreed en backfillt alleen het bestaande brontype', () => {
    expect(migration).toContain('off_market_brief_events_vastgoedkans_id_fkey');
    expect(migration).toContain("dossier_type in ('off_market_signaal','vastgoedkans')");
    expect(migration).toContain("set dossier_type='off_market_signaal'");
    expect(migration).toContain('off_market_brief_events_dossier_type_consistent_check');
    expect(migration).toContain('brief_nummer between 1 and 3');
  });

  it('verwijdert geen bestaande tabellen, rijen of Off-Market-FKs', () => {
    expect(migration).not.toMatch(/drop\s+table/i);
    expect(migration).not.toMatch(/delete\s+from/i);
    expect(migration).not.toMatch(/drop\s+constraint\s+off_market_brieven_signaal_id_fkey/i);
    expect(migration).not.toMatch(/drop\s+constraint\s+off_market_brief_events_signaal_id_fkey/i);
  });
});
