import { describe, expect, it } from 'vitest';
import { dryRunFingerprint, maakDryRunRapport, maakImportBatches } from './importBatch';

describe('maakImportBatches', () => {
  it('verdeelt records deterministisch en maakt een voltooid checkpoint', () => {
    const result = maakImportBatches({ records: [1, 2, 3, 4, 5], batchGrootte: 2 }, '2026-08-03T00:00:00.000Z');
    expect(result.batches.map(batch => batch.records)).toEqual([[1, 2], [3, 4], [5]]);
    expect(result.checkpoint).toMatchObject({ cursor: '5', verwerkteRecords: 5, voltooid: true });
  });

  it('kan hervatten vanaf een startindex', () => {
    const result = maakImportBatches({ records: [1, 2, 3, 4], batchGrootte: 2, startIndex: 2 });
    expect(result.batches).toHaveLength(1);
    expect(result.batches[0].records).toEqual([3, 4]);
    expect(result.checkpoint.verwerkteRecords).toBe(2);
  });

  it('weigert ongeldige batchgroottes en startindices', () => {
    expect(() => maakImportBatches({ records: [], batchGrootte: 0 })).toThrow();
    expect(() => maakImportBatches({ records: [1], batchGrootte: 1, startIndex: 2 })).toThrow();
  });
});

describe('dry-runrapport', () => {
  const basis = {
    datasetVersie: 'v20200601-assen',
    scopeCode: '0106',
    tellingen: {
      ontvangen: 10,
      verwerkt: 10,
      geweigerd: 0,
      perObjecttype: { Pand: 2, Verblijfsobject: 2 },
      objecten: 4,
      voorkomens: 10,
      relaties: 3,
      geometrieen: 4,
    },
    waarschuwingen: ['b', 'a'],
    fouten: [],
    hervatbaarVanaf: null,
  };

  it('levert een deterministische fingerprint onafhankelijk van waarschuwingvolgorde', () => {
    const a = maakDryRunRapport(basis);
    const b = dryRunFingerprint({ ...basis, waarschuwingen: ['a', 'b'] });
    expect(a.fingerprint).toBe(b);
  });
});
