import { describe, expect, it } from 'vitest';
import { isDirectLoginHost } from './stableTestLogin';

describe('Vaste testomgeving: directe beveiligde aanmelding', () => {
  it('gebruikt op het vaste crm-test adres de bestaande loginpagina', () => {
    expect(isDirectLoginHost('bitovastgoed-git-crm-test-bitovastgoed.vercel.app')).toBe(true);
  });

  it('verandert de aanmelding van productie en overige previews niet', () => {
    expect(isDirectLoginHost('bitovastgoed.vercel.app')).toBe(false);
    expect(isDirectLoginHost('bitovastgoed-random-bitovastgoed.vercel.app')).toBe(false);
    expect(isDirectLoginHost('bitovastgoed-git-crm-test-bitovastgoed.vercel.app.evil.test')).toBe(false);
  });
});
