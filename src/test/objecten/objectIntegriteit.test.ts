import { describe, expect, it } from 'vitest';
import type { ObjectVastgoed } from '@/data/mock-data';
import { analyseerObjectIntegriteit } from '@/lib/objecten/objectIntegriteit';

const object = (id: string, overrides: Partial<ObjectVastgoed> = {}): ObjectVastgoed => ({
  id,
  titel: id,
  anoniem: false,
  plaats: 'Tilburg',
  provincie: 'Noord-Brabant',
  adres: 'Markt 1',
  postcode: '5038 AB',
  type: 'winkels',
  status: 'te_beoordelen',
  exclusief: false,
  verhuurStatus: 'leeg',
  ontwikkelPotentie: false,
  transformatiePotentie: false,
  isPortefeuille: false,
  documentenBeschikbaar: false,
  datumToegevoegd: '2026-08-02',
  ...overrides,
});

describe('objectintegriteitscontrole', () => {
  it('meldt ontbrekende adresvelden zonder data te wijzigen', () => {
    const input = object('1', { adres: undefined, postcode: undefined });
    const rapport = analyseerObjectIntegriteit([input]);
    expect(rapport.aantallen.adres_ontbreekt).toBe(1);
    expect(rapport.aantallen.postcode_ontbreekt).toBe(1);
    expect(input.adres).toBeUndefined();
  });

  it('groepeert gelijkwaardige adressen als mogelijk duplicaat', () => {
    const rapport = analyseerObjectIntegriteit([
      object('1', { crmObjectnummer: 'OBJ-000001' }),
      object('2', { crmObjectnummer: 'OBJ-000002', adres: 'markt-1', postcode: '5038AB', plaats: 'tilburg' }),
    ]);
    expect(rapport.aantallen.mogelijk_dubbel_adres).toBe(1);
    expect(rapport.objectenMetIssues).toBe(2);
  });

  it('meldt dubbele interne referentienummers', () => {
    const rapport = analyseerObjectIntegriteit([
      object('1', { internReferentienummer: 'REF-10' }),
      object('2', { adres: 'Markt 2', internReferentienummer: ' ref 10 ' }),
    ]);
    expect(rapport.aantallen.dubbel_intern_referentienummer).toBe(1);
  });
});
