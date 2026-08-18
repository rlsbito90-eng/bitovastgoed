import { describe, expect, it } from 'vitest';

import {
  bouwProductiekernBulkLeesQuery,
  bouwProductiekernLeesQuery,
  PRODUCTIEKERN_BULK_LEES_QUERY_CONTRACTEN,
  PRODUCTIEKERN_LEES_QUERY_CONTRACTEN,
} from './productiekernSupabaseLeesQueryContract';

describe('productiekern Supabase leesquerycontracten', () => {
  it('beperkt single reads tot zes expliciete querycontracten', () => {
    expect(Object.keys(PRODUCTIEKERN_LEES_QUERY_CONTRACTEN)).toEqual([
      'haal_dossier',
      'haal_brief',
      'haal_briefversies',
      'haal_printbatch',
      'haal_printbatch_brieven',
      'haal_batchdocumenten',
    ]);
  });

  it('beperkt bulk reads tot vijf vaste ID-setcontracten', () => {
    expect(Object.keys(PRODUCTIEKERN_BULK_LEES_QUERY_CONTRACTEN)).toEqual([
      'haal_dossiers_op_selectie_ids',
      'haal_brieven_op_ids',
      'haal_briefversies_op_ids',
      'haal_briefversies_op_brief_ids',
      'haal_printbatch_brieven_op_versie_ids',
    ]);
    expect(PRODUCTIEKERN_BULK_LEES_QUERY_CONTRACTEN.haal_dossiers_op_selectie_ids).toMatchObject({
      tabel: 'off_market_acquisitie_dossiers', filterKolom: 'selectie_id', cardinaliteit: 'lijst',
      maximaalAantalRecords: 1000, maximaalAantalFilterwaarden: 1000,
    });
    expect(PRODUCTIEKERN_BULK_LEES_QUERY_CONTRACTEN.haal_brieven_op_ids).toMatchObject({
      tabel: 'off_market_brieven', filterKolom: 'id', cardinaliteit: 'lijst',
      maximaalAantalRecords: 1000, maximaalAantalFilterwaarden: 1000,
    });
    expect(PRODUCTIEKERN_BULK_LEES_QUERY_CONTRACTEN.haal_briefversies_op_brief_ids).toMatchObject({
      tabel: 'off_market_brief_versies', filterKolom: 'brief_id', cardinaliteit: 'lijst',
      maximaalAantalRecords: 5000, maximaalAantalFilterwaarden: 1000,
    });
    expect(PRODUCTIEKERN_BULK_LEES_QUERY_CONTRACTEN.haal_printbatch_brieven_op_versie_ids).toMatchObject({
      tabel: 'off_market_printbatch_brieven', filterKolom: 'brief_versie_id', cardinaliteit: 'lijst',
      maximaalAantalRecords: 2000, maximaalAantalFilterwaarden: 1000,
    });
  });

  it('selecteert uitsluitend benodigde kolommen en nooit een wildcard', () => {
    const contracten = [
      ...Object.values(PRODUCTIEKERN_LEES_QUERY_CONTRACTEN),
      ...Object.values(PRODUCTIEKERN_BULK_LEES_QUERY_CONTRACTEN),
    ];
    for (const contract of contracten) {
      expect(contract.selectKolommen.length).toBeGreaterThan(0);
      expect(contract.selectKolommen).not.toContain('*');
      expect(new Set(contract.selectKolommen).size).toBe(contract.selectKolommen.length);
    }
  });

  it('legt cardinaliteit en deterministische lijstvolgorde vast', () => {
    expect(PRODUCTIEKERN_LEES_QUERY_CONTRACTEN.haal_dossier.cardinaliteit).toBe('nul_of_een');
    expect(PRODUCTIEKERN_LEES_QUERY_CONTRACTEN.haal_briefversies).toMatchObject({
      cardinaliteit: 'lijst', volgorde: { kolom: 'versienummer', oplopend: true },
    });
    expect(PRODUCTIEKERN_LEES_QUERY_CONTRACTEN.haal_printbatch_brieven).toMatchObject({
      cardinaliteit: 'lijst', tabel: 'off_market_printbatch_brieven', filterKolom: 'batch_id',
      volgorde: { kolom: 'created_at', oplopend: true }, maximaalAantalRecords: 1000,
    });
    expect(PRODUCTIEKERN_LEES_QUERY_CONTRACTEN.haal_batchdocumenten).toMatchObject({
      cardinaliteit: 'lijst', tabel: 'off_market_batchdocumenten', filterKolom: 'batch_id',
      volgorde: { kolom: 'created_at', oplopend: true }, maximaalAantalRecords: 400,
    });
  });

  it('weigert lege waarden en normaliseert/dedupliceert bulk-ID sets', () => {
    expect(() => bouwProductiekernLeesQuery('haal_brief', '   ')).toThrow('Filterwaarde voor haal_brief is verplicht.');
    expect(() => bouwProductiekernBulkLeesQuery('haal_dossiers_op_selectie_ids', []))
      .toThrow('Filterwaarden voor haal_dossiers_op_selectie_ids zijn verplicht.');
    expect(bouwProductiekernBulkLeesQuery(
      'haal_dossiers_op_selectie_ids', [' selectie-2 ', 'selectie-1', 'selectie-2'],
    ).filterWaarden).toEqual(['selectie-2', 'selectie-1']);
  });

  it('weigert bulksets boven de harde bovengrens', () => {
    expect(() => bouwProductiekernBulkLeesQuery(
      'haal_briefversies_op_ids', Array.from({ length: 1001 }, (_, index) => `versie-${index}`),
    )).toThrow('Te veel filterwaarden voor haal_briefversies_op_ids.');
  });

  it('bouwt briefscope bulkquery zonder dynamische tabel- of kolomnamen', () => {
    expect(bouwProductiekernBulkLeesQuery(
      'haal_briefversies_op_brief_ids', ['brief-2', ' brief-1 ', 'brief-2'],
    )).toEqual({
      ...PRODUCTIEKERN_BULK_LEES_QUERY_CONTRACTEN.haal_briefversies_op_brief_ids,
      filterWaarden: ['brief-2', 'brief-1'],
    });
  });

  it('bouwt een query zonder dynamische tabel- of kolomnamen', () => {
    expect(bouwProductiekernLeesQuery('haal_dossier', 'selectie-1')).toEqual({
      ...PRODUCTIEKERN_LEES_QUERY_CONTRACTEN.haal_dossier,
      filterWaarde: 'selectie-1',
    });
  });
});
