import { describe, expect, it } from 'vitest';
import { bepaalPrimaireWerkTab, bepaalWerkcontextNavigatie, bouwEigenaarGoogleUrl } from './vastgoedkansWorkspace';
import type { Vastgoedkans } from '@/lib/vastgoedkansen';

const basis = {
  id: '1',
  status: 'onderzoek',
  bagPandId: null,
  bagVerblijfsobjectId: null,
  kadasterStatus: 'niet_gestart',
  eigenaarStatus: 'niet_gestart',
  briefStatus: 'niet_gestart',
  plaats: 'Amsterdam',
} as Vastgoedkans;

describe('vastgoedkansWorkspace', () => {
  it('stuurt zonder BAG-koppeling eerst naar Onderzoek', () => {
    expect(bepaalPrimaireWerkTab(basis)).toBe('onderzoek');
  });

  it('stuurt na BAG-koppeling naar Kadaster en eigenaar', () => {
    expect(bepaalPrimaireWerkTab({ ...basis, bagPandId: '0363100012112079' })).toBe('kadaster');
  });

  it('stuurt na eigenaaronderzoek naar brieven', () => {
    expect(bepaalPrimaireWerkTab({
      ...basis,
      bagPandId: '0363100012112079',
      kadasterStatus: 'gegevens_bekend',
      eigenaarStatus: 'bekend',
    })).toBe('brieven');
  });

  it('bouwt een beperkte Google-zoekopdracht met naam en plaats', () => {
    const url = bouwEigenaarGoogleUrl('Voorbeeld Vastgoed B.V.', 'Amsterdam');
    expect(url).toContain('google.com/search');
    expect(decodeURIComponent(url!)).toContain('"Voorbeeld Vastgoed B.V." Amsterdam vastgoed');
    expect(bouwEigenaarGoogleUrl('   ')).toBeNull();
  });

  it('navigeert binnen de actieve werkcontext', () => {
    expect(bepaalWerkcontextNavigatie(['a', 'b', 'c'], 'b')).toEqual({ index: 1, total: 3, vorigeId: 'a', volgendeId: 'c' });
  });
});
