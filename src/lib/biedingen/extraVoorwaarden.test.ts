import { describe, expect, it } from 'vitest';
import { biedingFromDb, biedingToDb } from './db';
import type { ExtraVoorwaarde } from './types';

describe('gestructureerde biedingsvoorwaarden', () => {
  const condition: ExtraVoorwaarde = { type: 'bezichtiging', karakter: 'voorbehoud', toelichting: 'Positieve bezichtiging', deadline: '2026-11-27' };
  it('behoudt historische vrije tekst en onbekende voorwaarden', () => {
    expect(biedingFromDb({ voorwaarden: 'Bestaande afspraak' })).toMatchObject({ voorwaarden: 'Bestaande afspraak', extraVoorwaarden: null });
  });
  it('onderscheidt onbekend, expliciet geen en aanwezig', () => {
    for (const value of [null, [], [condition]]) {
      expect(biedingFromDb({ extra_voorwaarden: value }).extraVoorwaarden).toEqual(value);
      expect(biedingToDb({ extraVoorwaarden: value }).extra_voorwaarden).toEqual(value);
    }
  });
  it('verandert voorwaarden niet bij een statusupdate', () => {
    expect(biedingToDb({status:'afgewezen'})).not.toHaveProperty('extra_voorwaarden');
  });
});
