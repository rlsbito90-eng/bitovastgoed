import { describe, expect, it } from 'vitest';
import { bepaalPrimaireWerkTab, bepaalWerkcontextNavigatie, bouwEigenaarGoogleUrl } from './vastgoedkansWorkspace';
import type { Vastgoedkans } from '@/lib/vastgoedkansen';

const basis = {
  id: '1', status: 'onderzoek', kadasterStatus: 'niet_gestart', eigenaarStatus: 'niet_gestart', briefStatus: 'niet_gestart', plaats: 'Amsterdam',
} as Vastgoedkans;

describe('vastgoedkansWorkspace', () => {
  it('stuurt eerst naar Kadaster en eigenaar', () => {
    expect(bepaalPrimaireWerkTab(basis)).toBe('kadaster');
  });

  it('stuurt na eigenaaronderzoek naar brieven', () => {
    expect(bepaalPrimaireWerkTab({ ...basis, kadasterStatus: 'afgerond', eigenaarStatus: 'bekend' })).toBe('brieven');
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
