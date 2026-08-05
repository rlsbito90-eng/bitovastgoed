import { describe, expect, it } from 'vitest';
import { berekenAmsterdamClosure } from './amsterdamClosure';
import { berekenMetadataSha256, type AmsterdamMetadataRecord } from './amsterdamMetadataIndex';

function index(records: AmsterdamMetadataRecord[]) {
  return { records, indexSha256: berekenMetadataSha256(records) };
}

describe('Amsterdam closure', () => {
  it('convergeert deterministisch vanaf gemeentecode 0363', () => {
    const resultaat = berekenAmsterdamClosure({
      index: index([
        { identificatie: '0363100000000001', objecttype: 'Pand', gerelateerdeIdentificaties: ['0363010000000001'] },
        { identificatie: '0363010000000001', objecttype: 'Verblijfsobject', gerelateerdeIdentificaties: ['0363200000000001'] },
        { identificatie: '0363200000000001', objecttype: 'Nummeraanduiding', gerelateerdeIdentificaties: [] },
        { identificatie: '0106100000000001', objecttype: 'Pand', gerelateerdeIdentificaties: [] },
      ]),
    });
    expect(resultaat.status).toBe('closure_validated');
    expect(resultaat.rapport?.records).toBe(3);
    expect(resultaat.rapport?.geselecteerdeIds).not.toContain('0106100000000001');
    expect(resultaat.rapport?.groeiPerPass.at(-1)).toBe(0);
    expect(resultaat.rapport?.selectieChecksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('volgt gerelateerde identificaties buiten de gemeenteprefix mee', () => {
    const resultaat = berekenAmsterdamClosure({
      index: index([
        { identificatie: '0363100000000001', objecttype: 'Pand', gerelateerdeIdentificaties: ['0457010000000001'] },
        { identificatie: '0457010000000001', objecttype: 'Verblijfsobject', gerelateerdeIdentificaties: [] },
      ]),
    });
    expect(resultaat.rapport?.geselecteerdeIds).toContain('0457010000000001');
  });

  it('stopt zonder seeds', () => {
    const resultaat = berekenAmsterdamClosure({
      index: index([{ identificatie: '0106100000000001', objecttype: 'Pand', gerelateerdeIdentificaties: [] }]),
    });
    expect(resultaat.status).toBe('stop');
    expect(resultaat.fouten.map(f => f.code)).toContain('geen_seeds');
  });

  it('stopt zonder convergentie binnen het maximum aantal passes', () => {
    const records: AmsterdamMetadataRecord[] = [
      { identificatie: '0363100000000000', objecttype: 'Pand', gerelateerdeIdentificaties: ['0363100000000001'] },
    ];
    for (let i = 1; i < 6; i += 1) {
      records.push({
        identificatie: `036310000000000${i}`,
        objecttype: 'Pand',
        gerelateerdeIdentificaties: [`036310000000000${i + 1}`],
      });
    }
    records.push({ identificatie: '0363100000000006', objecttype: 'Pand', gerelateerdeIdentificaties: [] });
    const resultaat = berekenAmsterdamClosure({ index: index(records), gemeentecode: '0363100000000000', maximumPasses: 1 });
    expect(resultaat.status).toBe('stop');
  });
});
