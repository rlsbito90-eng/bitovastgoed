import { describe, expect, it } from 'vitest';
import { useDirectLoginForHost } from './stableTestLogin';

describe('Vaste testomgeving: directe beveiligde aanmelding', () => {
  it('gebruikt op het vaste crm-test adres de bestaande loginpagina', () => {
    expect(useDirectLoginForHost('bitovastgoed-git-crm-test-bitovastgoed.vercel.app')).toBe(true);
  });

  it('verandert de aanmelding van productie en overige previews niet', () => {
    expect(useDirectLoginForHost('bitovastgoed.vercel.app')).toBe(false);
    expect(useDirectLoginForHost('bitovastgoed-random-bitovastgoed.vercel.app')).toBe(false);
    expect(useDirectLoginForHost('bitovastgoed-git-crm-test-bitovastgoed.vercel.app.evil.test')).toBe(false);
  });
});
