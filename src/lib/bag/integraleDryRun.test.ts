import { describe, expect, it } from 'vitest';
import type { BagOfficieelAdapterRecord } from './officieleXmlRecordAdapter';
import { voerIntegraleBagDryRunUit } from './integraleDryRun';

function record(overrides: Partial<BagOfficieelAdapterRecord> = {}): BagOfficieelAdapterRecord {
  return {
    objecttype: 'Pand',
    identificatie: '0106100000000001',
    status: 'Pand in gebruik',
    voorkomen: {
      voorkomenidentificatie: 1,
      beginGeldigheid: '2020-01-01',
      eindGeldigheid: null,
      tijdstipRegistratie: '2020-01-01T00:00:00Z',
      eindRegistratie: null,
      tijdstipRegistratieLV: null,
      tijdstipEindRegistratieLV: null,
      tijdstipInactief: null,
      tijdstipInactiefLV: null,
    },
    geometrie: { vorm: 'polygoon', crs: 'EPSG:28992', dimensie: 2, coordinaten: [1, 2, 3, 4] },
    relaties: {},
    velden: { oorspronkelijkBouwjaar: 1990 },
    ...overrides,
  };
}

describe('voerIntegraleBagDryRunUit', () => {
  it('verwerkt officiële records via batches naar staging en rapport', () => {
    const result = voerIntegraleBagDryRunUit({
      datasetVersie: 'v20200601-assen',
      scopeCode: '0106',
      records: [record(), record({ objecttype: 'Woonplaats', identificatie: '0106000000000001', geometrie: { vorm: 'polygoon', crs: 'EPSG:28992', dimensie: 2, coordinaten: [1, 2, 3, 4] } })],
      batchGrootte: 1,
    });
    expect(result.batches).toBe(2);
    expect(result.rapport.tellingen).toMatchObject({ ontvangen: 2, verwerkt: 2, objecten: 2, voorkomens: 2 });
    expect(result.rapport.fingerprint).toBeTruthy();
  });

  it('levert bij dezelfde records dezelfde fingerprint ongeacht batchgrootte', () => {
    const records = [record(), record({ identificatie: '0106100000000002' })];
    const a = voerIntegraleBagDryRunUit({ datasetVersie: 'v1', scopeCode: '0106', records, batchGrootte: 1 });
    const b = voerIntegraleBagDryRunUit({ datasetVersie: 'v1', scopeCode: '0106', records, batchGrootte: 10 });
    expect(a.rapport.fingerprint).toBe(b.rapport.fingerprint);
  });
});
