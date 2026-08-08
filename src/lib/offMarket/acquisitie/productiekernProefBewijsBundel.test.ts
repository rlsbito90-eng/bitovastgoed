import { describe, expect, it } from 'vitest';
import { bundelProductiekernProefBewijs } from './productiekernProefBewijsBundel';

const geldig = { geldig: true, leeftijdUren: 1, blokkades: [] };

describe('productiekern proefbewijsbundel', () => {
  it('is volledig bij twee geldige bewijzen op dezelfde basis', () => {
    expect(bundelProductiekernProefBewijs({
      schemaBewijs: geldig,
      concurrencyBewijs: geldig,
      zelfdeDoelomgeving: true,
      zelfdeSchemaBasis: true,
    })).toEqual({
      volledig: true,
      blokkades: [],
      verleentProductieMigratie: false,
      verleentProductieActivatie: false,
    });
  });

  it('verzamelt bewijs- en omgevingsblokkades', () => {
    const resultaat = bundelProductiekernProefBewijs({
      schemaBewijs: { geldig: false, leeftijdUren: null, blokkades: ['verlopen'] },
      concurrencyBewijs: { geldig: false, leeftijdUren: null, blokkades: ['schema wijkt af'] },
      zelfdeDoelomgeving: false,
      zelfdeSchemaBasis: false,
    });
    expect(resultaat.volledig).toBe(false);
    expect(resultaat.blokkades).toHaveLength(4);
    expect(resultaat.verleentProductieMigratie).toBe(false);
  });
});
