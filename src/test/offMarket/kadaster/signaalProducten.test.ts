// Fase 4K.4D — controleer dat Off Market Radar in V1 alleen rechten en
// waarde aanbiedt; WOZ-object wordt bewust niet aangeboden in de signaalfase.
import { describe, it, expect } from 'vitest';
import { SIGNAAL_ALLOWED_PRODUCTS } from '@/components/offmarket/kadaster/SignaalKadasterKaart';

describe('Off Market Radar — Kadaster productselectie V1', () => {
  it('staat rechten en waarde toe', () => {
    expect(SIGNAAL_ALLOWED_PRODUCTS).toContain('rechten');
    expect(SIGNAAL_ALLOWED_PRODUCTS).toContain('waarde');
  });

  it('staat WOZ-object (product `object`) niet toe in V1', () => {
    expect(SIGNAAL_ALLOWED_PRODUCTS).not.toContain('object');
  });

  it('staat gratis producten lasten/buurt niet toe in signaalfase', () => {
    expect(SIGNAAL_ALLOWED_PRODUCTS).not.toContain('lasten');
    expect(SIGNAAL_ALLOWED_PRODUCTS).not.toContain('buurt');
  });
});
