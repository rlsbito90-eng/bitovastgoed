// V1C — Mock-adapter resultaat-shape en deterministisme
import { describe, it, expect } from 'vitest';
import { bouwZoekvarianten, normaliseerAdres } from '@/lib/offMarket/kadaster/adres';
import { mockKadasterLookup } from '@/lib/offMarket/kadaster/mockAdapter';

describe('mockKadasterLookup', () => {
  const adres = normaliseerAdres({ origineel: 'Hoofdweg 160-H 1057 DB Amsterdam' });
  const varianten = bouwZoekvarianten(adres);
  const exact = varianten.find(v => v.id === 'postcode-huisnummer-toevoeging')!;

  it('exacte variant geeft hoge confidence', () => {
    const r = mockKadasterLookup({ variant: exact, origineelAdres: adres.origineel });
    expect(r.status).toBe('geslaagd');
    expect(r.resultaten[0].confidence).toBeGreaterThanOrEqual(0.8);
    expect(r.resultaten[0].kadastrale_aanduiding).toMatch(/AMSTERDAM/);
  });

  it('is deterministisch voor dezelfde input', () => {
    const a = mockKadasterLookup({ variant: exact, origineelAdres: adres.origineel });
    const b = mockKadasterLookup({ variant: exact, origineelAdres: adres.origineel });
    expect(a.resultaten[0].eigenaar_naam).toBe(b.resultaten[0].eigenaar_naam);
    expect(a.resultaten[0].kadastrale_aanduiding).toBe(b.resultaten[0].kadastrale_aanduiding);
  });

  it('bron blijft "mock"', () => {
    const r = mockKadasterLookup({ variant: exact, origineelAdres: adres.origineel });
    expect(r.resultaten.every(x => x.bron === 'mock')).toBe(true);
  });
});
