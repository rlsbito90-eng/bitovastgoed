import { describe, expect, it } from 'vitest';

import { bepaalProductiekernOpenBlokkades } from './productiekernOpenBlokkades';

const allesGroen = {
  actueleProductieDdlGeverifieerd: true,
  actueleProductieRlsGeverifieerd: true,
  schemaProefGroen: true,
  concurrencyProefGroen: true,
  rlsPoliciesEnGrantsGetest: true,
  supabaseRepositoryGeimplementeerd: true,
  documentproductieGeimplementeerd: true,
  volledigeRegressiesuiteGroen: true,
  explicietProductieakkoord: true,
};

describe('bepaalProductiekernOpenBlokkades', () => {
  it('rapporteert alle negen blokkades bij ontbrekend bewijs', () => {
    const resultaat = bepaalProductiekernOpenBlokkades({
      actueleProductieDdlGeverifieerd: false,
      actueleProductieRlsGeverifieerd: false,
      schemaProefGroen: false,
      concurrencyProefGroen: false,
      rlsPoliciesEnGrantsGetest: false,
      supabaseRepositoryGeimplementeerd: false,
      documentproductieGeimplementeerd: false,
      volledigeRegressiesuiteGroen: false,
      explicietProductieakkoord: false,
    });

    expect(resultaat.open).toHaveLength(9);
    expect(resultaat.gereedVoorTechnischeReview).toBe(false);
    expect(resultaat.gereedVoorMerge).toBe(false);
    expect(resultaat.gereedVoorProductie).toBe(false);
  });

  it('scheidt technische review van mergegereedheid', () => {
    const resultaat = bepaalProductiekernOpenBlokkades({
      ...allesGroen,
      schemaProefGroen: false,
      concurrencyProefGroen: false,
    });

    expect(resultaat.gereedVoorTechnischeReview).toBe(true);
    expect(resultaat.gereedVoorMerge).toBe(false);
    expect(resultaat.gereedVoorProductie).toBe(false);
  });

  it('houdt productie gesloten wanneer alleen expliciet akkoord ontbreekt', () => {
    const resultaat = bepaalProductiekernOpenBlokkades({
      ...allesGroen,
      explicietProductieakkoord: false,
    });

    expect(resultaat.open).toEqual([
      {
        categorie: 'akkoord',
        omschrijving: 'Afzonderlijk expliciet productieakkoord ontbreekt.',
        vereistVoor: 'productie',
      },
    ]);
    expect(resultaat.gereedVoorTechnischeReview).toBe(true);
    expect(resultaat.gereedVoorMerge).toBe(true);
    expect(resultaat.gereedVoorProductie).toBe(false);
  });

  it('is pas volledig gereed wanneer ieder bewijs groen is', () => {
    expect(bepaalProductiekernOpenBlokkades(allesGroen)).toEqual({
      open: [],
      gereedVoorTechnischeReview: true,
      gereedVoorMerge: true,
      gereedVoorProductie: true,
    });
  });
});
