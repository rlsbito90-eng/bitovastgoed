import { describe, expect, it } from 'vitest';

import {
  bouwProductiekernLeesQuery,
  PRODUCTIEKERN_LEES_QUERY_CONTRACTEN,
} from './productiekernSupabaseLeesQueryContract';

describe('productiekern Supabase leesquerycontracten', () => {
  it('beperkt reads tot vier expliciete querycontracten', () => {
    expect(Object.keys(PRODUCTIEKERN_LEES_QUERY_CONTRACTEN)).toEqual([
      'haal_dossier',
      'haal_brief',
      'haal_briefversies',
      'haal_printbatch',
    ]);
  });

  it('selecteert uitsluitend benodigde kolommen en nooit een wildcard', () => {
    for (const contract of Object.values(PRODUCTIEKERN_LEES_QUERY_CONTRACTEN)) {
      expect(contract.selectKolommen.length).toBeGreaterThan(0);
      expect(contract.selectKolommen).not.toContain('*');
      expect(new Set(contract.selectKolommen).size).toBe(contract.selectKolommen.length);
    }
  });

  it('legt cardinaliteit en deterministische versievolgorde vast', () => {
    expect(PRODUCTIEKERN_LEES_QUERY_CONTRACTEN.haal_dossier.cardinaliteit)
      .toBe('nul_of_een');
    expect(PRODUCTIEKERN_LEES_QUERY_CONTRACTEN.haal_briefversies).toMatchObject({
      cardinaliteit: 'lijst',
      volgorde: { kolom: 'versienummer', oplopend: true },
    });
  });

  it('weigert een lege filterwaarde vóór transport', () => {
    expect(() => bouwProductiekernLeesQuery('haal_brief', '   '))
      .toThrow('Filterwaarde voor haal_brief is verplicht.');
  });

  it('bouwt een query zonder dynamische tabel- of kolomnamen', () => {
    expect(bouwProductiekernLeesQuery('haal_dossier', 'selectie-1')).toEqual({
      ...PRODUCTIEKERN_LEES_QUERY_CONTRACTEN.haal_dossier,
      filterWaarde: 'selectie-1',
    });
  });
});
