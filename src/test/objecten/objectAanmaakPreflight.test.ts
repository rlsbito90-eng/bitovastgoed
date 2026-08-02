import { describe, expect, it } from 'vitest';
import type { ObjectVastgoed } from '@/data/mock-data';
import { beoordeelObjectAanmaakPreflight } from '@/lib/objecten/objectAanmaakPreflight';

const object = (id: string, patch: Partial<ObjectVastgoed> = {}): ObjectVastgoed => ({
  id,
  titel: id,
  anoniem: false,
  adres: 'Markt 1',
  postcode: '5038 AB',
  plaats: 'Tilburg',
  provincie: 'Noord-Brabant',
  type: 'winkels',
  status: 'te_beoordelen',
  exclusief: false,
  verhuurStatus: 'leeg',
  ontwikkelPotentie: false,
  transformatiePotentie: false,
  isPortefeuille: false,
  documentenBeschikbaar: false,
  datumToegevoegd: '2026-08-02',
  ...patch,
});

describe('objectaanmaak-preflight', () => {
  it('signaleert een bestaand object op volledig genormaliseerd adres', () => {
    const matches = beoordeelObjectAanmaakPreflight(
      { adres: 'Markt-1', postcode: '5038ab', plaats: 'TILBURG' },
      [object('bestaand')],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].object.id).toBe('bestaand');
    expect(matches[0].redenen).toContain('volledig_adres');
  });

  it('geeft maximaal drie sterke kandidaten terug', () => {
    const matches = beoordeelObjectAanmaakPreflight(
      { adres: 'Markt 1', postcode: '5038 AB', plaats: 'Tilburg' },
      [object('1'), object('2'), object('3'), object('4')],
    );
    expect(matches).toHaveLength(3);
  });

  it('wijzigt bronobjecten niet', () => {
    const bestaand = object('1');
    const snapshot = JSON.stringify(bestaand);
    beoordeelObjectAanmaakPreflight({ adres: 'Markt 1', postcode: '5038 AB', plaats: 'Tilburg' }, [bestaand]);
    expect(JSON.stringify(bestaand)).toBe(snapshot);
  });
});
