import { describe, expect, it } from 'vitest';

import { bouwProductiekernPariteitsrapport } from './productiekernPariteitsrapport';
import type { ProductiekernDossierPariteitsmeting } from './productiekernDossierPariteitsmeting';

function meting(
  status: ProductiekernDossierPariteitsmeting['status'],
): ProductiekernDossierPariteitsmeting {
  return {
    status,
    vergelijking: null,
    waarschuwingen: [],
  };
}

describe('bouwProductiekernPariteitsrapport', () => {
  it('weigert een lege steekproef als veilig bewijs', () => {
    const rapport = bouwProductiekernPariteitsrapport([]);

    expect(rapport.totaal).toBe(0);
    expect(rapport.veiligVoorReadOnlyProef).toBe(false);
  });

  it('telt iedere status en bewaart kritieke en ontbrekende selectie-IDs', () => {
    const rapport = bouwProductiekernPariteitsrapport([
      { selectieId: 'selectie-1', meting: meting('gelijk') },
      { selectieId: 'selectie-2', meting: meting('procesafwijking') },
      { selectieId: 'selectie-3', meting: meting('kritieke_afwijking') },
      { selectieId: 'selectie-4', meting: meting('productiekern_dossier_ontbreekt') },
      { selectieId: 'selectie-5', meting: meting('niet_geactiveerd') },
    ]);

    expect(rapport.aantallen).toEqual({
      niet_geactiveerd: 1,
      productiekern_dossier_ontbreekt: 1,
      gelijk: 1,
      procesafwijking: 1,
      kritieke_afwijking: 1,
    });
    expect(rapport.kritiekeSelectieIds).toEqual(['selectie-3']);
    expect(rapport.ontbrekendeSelectieIds).toEqual(['selectie-4']);
    expect(rapport.veiligVoorReadOnlyProef).toBe(false);
  });

  it('staat procesafwijkingen toe wanneer identiteit en dekking veilig zijn', () => {
    const rapport = bouwProductiekernPariteitsrapport([
      { selectieId: 'selectie-1', meting: meting('gelijk') },
      { selectieId: 'selectie-2', meting: meting('procesafwijking') },
    ]);

    expect(rapport.veiligVoorReadOnlyProef).toBe(true);
    expect(rapport.aantallen.procesafwijking).toBe(1);
  });

  it('blokkeert zodra één meting niet geactiveerd was', () => {
    const rapport = bouwProductiekernPariteitsrapport([
      { selectieId: 'selectie-1', meting: meting('gelijk') },
      { selectieId: 'selectie-2', meting: meting('niet_geactiveerd') },
    ]);

    expect(rapport.veiligVoorReadOnlyProef).toBe(false);
  });
});
