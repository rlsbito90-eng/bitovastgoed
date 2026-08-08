import { describe, expect, it } from 'vitest';

import { bouwProductiekernLeesAuditRecord } from './productiekernSupabaseLeesAudit';

describe('bouwProductiekernLeesAuditRecord', () => {
  it('registreert uitsluitend querymetadata zonder IDs of persoonsgegevens', () => {
    expect(bouwProductiekernLeesAuditRecord({
      query: 'haal_briefversies',
      uitkomst: 'lijst',
      duurMs: 18,
      aantalRecords: 2,
    })).toEqual({
      query: 'haal_briefversies',
      uitkomst: 'lijst',
      duurMs: 18,
      aantalRecords: 2,
      foutcode: null,
      bevatPersoonsgegevens: false,
      bevatFilterwaarde: false,
    });
  });

  it('vereist een genormaliseerde foutcode bij foutuitkomsten', () => {
    expect(() => bouwProductiekernLeesAuditRecord({
      query: 'haal_dossier',
      uitkomst: 'fout',
      duurMs: 4,
    })).toThrow('Een foutuitkomst vereist een genormaliseerde foutcode.');

    expect(bouwProductiekernLeesAuditRecord({
      query: 'haal_dossier',
      uitkomst: 'fout',
      duurMs: 4,
      foutcode: 'niet_geautoriseerd',
    }).foutcode).toBe('niet_geautoriseerd');
  });

  it('weigert ongeldige duur en recordaantallen', () => {
    expect(() => bouwProductiekernLeesAuditRecord({
      query: 'haal_brief', uitkomst: 'geblokkeerd', duurMs: -1,
    })).toThrow('Leesduur moet een niet-negatief eindig getal zijn.');
    expect(() => bouwProductiekernLeesAuditRecord({
      query: 'haal_printbatch', uitkomst: 'lijst', duurMs: 1, aantalRecords: 1.5,
    })).toThrow('Aantal records moet een niet-negatief geheel getal zijn.');
  });
});
