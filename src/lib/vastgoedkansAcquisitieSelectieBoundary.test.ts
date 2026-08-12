import { describe, expect, it } from 'vitest';
import { bouwVastgoedkansSelectieBoundary } from './vastgoedkansAcquisitieSelectieBoundary';
import type { Vastgoedkans } from './vastgoedkansen';

const kans = {
  id: '11111111-1111-1111-1111-111111111111',
  adres: 'Teststraat 1',
  postcode: '1000 AA',
  plaats: 'Amsterdam',
  objectId: null,
  eigenaarRelatieId: null,
  archivedAt: null,
} as Vastgoedkans;

describe('BUILD 2.0A.2 — selectiegrens', () => {
  it('mapt een Vastgoedkans naar de gedeelde dossiercontext zonder legacy signaal te fabriceren', () => {
    const grens = bouwVastgoedkansSelectieBoundary(kans);
    expect(grens.dossier.bronType).toBe('vastgoedkans');
    expect(grens.dossier.bronId).toBe(kans.id);
    expect(grens.actief).toBe(true);
    expect(grens.legacyOffMarketSelectieDirect).toBe(false);
    expect(grens.vereistGedeeldSelectieContract).toBe(true);
  });
});
