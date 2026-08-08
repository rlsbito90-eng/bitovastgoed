import { describe, expect, it } from 'vitest';

import { beoordeelProductiekernReadOnlyProef } from './productiekernReadOnlyProefBesluit';
import type { ProductiekernPariteitsrapport } from './productiekernPariteitsrapport';

function maakRapport(
  overrides: Partial<ProductiekernPariteitsrapport> = {},
): ProductiekernPariteitsrapport {
  return {
    totaal: 10,
    aantallen: {
      niet_geactiveerd: 0,
      productiekern_dossier_ontbreekt: 0,
      gelijk: 9,
      procesafwijking: 1,
      kritieke_afwijking: 0,
    },
    kritiekeSelectieIds: [],
    ontbrekendeSelectieIds: [],
    veiligVoorReadOnlyProef: true,
    ...overrides,
  };
}

const eisen = {
  minimaalAantalMetingen: 10,
  maximaalAandeelProcesafwijkingen: 0.1,
};

describe('beoordeelProductiekernReadOnlyProef', () => {
  it('staat de proef alleen toe wanneer rapport en expliciete eisen groen zijn', () => {
    expect(beoordeelProductiekernReadOnlyProef(maakRapport(), eisen)).toEqual({
      toegestaan: true,
      blokkades: [],
      aandeelProcesafwijkingen: 0.1,
    });
  });

  it('blokkeert een onveilig pariteitsrapport', () => {
    const besluit = beoordeelProductiekernReadOnlyProef(
      maakRapport({ veiligVoorReadOnlyProef: false }),
      eisen,
    );

    expect(besluit.toegestaan).toBe(false);
    expect(besluit.blokkades).toContain(
      'Het pariteitsrapport is niet veilig voor een read-only proef.',
    );
  });

  it('blokkeert een te kleine steekproef', () => {
    const besluit = beoordeelProductiekernReadOnlyProef(
      maakRapport({ totaal: 9 }),
      eisen,
    );

    expect(besluit.toegestaan).toBe(false);
    expect(besluit.blokkades).toContain('Er zijn 9 metingen; minimaal 10 vereist.');
  });

  it('blokkeert te veel procesafwijkingen', () => {
    const besluit = beoordeelProductiekernReadOnlyProef(
      maakRapport({
        aantallen: {
          niet_geactiveerd: 0,
          productiekern_dossier_ontbreekt: 0,
          gelijk: 8,
          procesafwijking: 2,
          kritieke_afwijking: 0,
        },
      }),
      eisen,
    );

    expect(besluit.toegestaan).toBe(false);
    expect(besluit.aandeelProcesafwijkingen).toBe(0.2);
  });

  it('weigert ongeldige proefcriteria fail-closed', () => {
    const besluit = beoordeelProductiekernReadOnlyProef(maakRapport(), {
      minimaalAantalMetingen: 0,
      maximaalAandeelProcesafwijkingen: 2,
    });

    expect(besluit.toegestaan).toBe(false);
    expect(besluit.blokkades).toHaveLength(2);
  });
});
