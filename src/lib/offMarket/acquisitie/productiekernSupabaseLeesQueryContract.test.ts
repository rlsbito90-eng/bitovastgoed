import { describe, expect, it } from 'vitest';

import {
  bouwProductiekernLeesQuery,
  PRODUCTIEKERN_LEES_QUERY_CONTRACTEN,
} from './productiekernSupabaseLeesQueryContract';

describe('productiekern Supabase leesquerycontracten', () => {
  it('beperkt reads tot vijf expliciete querycontracten', () => {
    expect(Object.keys(PRODUCTIEKERN_LEES_QUERY_CONTRACTEN)).toEqual([
      'haal_dossier',
      'haal_brief',
      'haal_briefversies',
      'haal_printbatch',
      'haal_printbatch_brieven',
    ]);
  });

  it('selecteert uitsluitend benodigde kolommen en nooit een wildcard', () => {
    for (const contract of Object.values(PRODUCTIEKERN_LEES_QUERY_CONTRACTEN)) {
      expect(contract.selectKolommen.length).toBeGreaterThan(0);
      expect(contract.selectKolommen).not.toContain('*');
      expect(new Set(contract.selectKolommen).size).toBe(contract.selectKolommen.length);
    }
  });

  it('legt cardinaliteit en deterministische lijstvolgorde vast', () => {
    expect(PRODUCTIEKERN_LEES_QUERY_CONTRACTEN.haal_dossier.cardinaliteit)
      .toBe('nul_of_een');
    expect(PRODUCTIEKERN_LEES_QUERY_CONTRACTEN.haal_briefversies).toMatchObject({
      cardinaliteit: 'lijst',
      volgorde: { kolom: 'versienummer', oplopend: true },
    });
    expect(PRODUCTIEKERN_LEES_QUERY_CONTRACTEN.haal_printbatch_brieven).toMatchObject({
      cardinaliteit: 'lijst',
      tabel: 'off_market_printbatch_brieven',
      filterKolom: 'batch_id',
      volgorde: { kolom: 'created_at', oplopend: true },
      maximaalAantalRecords: 1000,
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
