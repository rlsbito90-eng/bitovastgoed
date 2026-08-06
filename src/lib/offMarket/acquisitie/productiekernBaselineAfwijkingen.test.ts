import { describe, expect, it } from 'vitest';

import { beoordeelProductiekernBaselineAfwijkingen } from './productiekernBaselineAfwijkingen';

describe('beoordeelProductiekernBaselineAfwijkingen', () => {
  it('accepteert uitsluitend de bekende niet-productiekern baseline', () => {
    const resultaat = beoordeelProductiekernBaselineAfwijkingen([
      { testbestand: 'src/lib/acquisitieRelatieMatching.test.ts', aantalFouten: 1, productiekernGerelateerd: false },
      { testbestand: 'src/lib/kadaster/databaseContract.test.ts', aantalFouten: 1, productiekernGerelateerd: false },
      { testbestand: 'src/lib/bag/queryTransport.test.ts', aantalFouten: 4, productiekernGerelateerd: false },
      { testbestand: 'src/lib/objectIdentity/backfillDryRun.test.ts', aantalFouten: 1, productiekernGerelateerd: false },
      { testbestand: 'src/test/vastgoedkansen/bagIdentifiersReadOnly.test.ts', aantalFouten: 2, productiekernGerelateerd: false },
    ]);

    expect(resultaat).toEqual({
      uitsluitendBekendeNietProductiekernAfwijkingen: true,
      totaalFouten: 9,
      onverwachteBestanden: [],
      blokkades: [],
    });
  });

  it('blokkeert nieuwe of productiekern-gerelateerde regressies', () => {
    const resultaat = beoordeelProductiekernBaselineAfwijkingen([
      { testbestand: 'src/lib/offMarket/acquisitie/nieuw.test.ts', aantalFouten: 1, productiekernGerelateerd: true },
    ]);

    expect(resultaat.uitsluitendBekendeNietProductiekernAfwijkingen).toBe(false);
    expect(resultaat.blokkades).toHaveLength(2);
  });

  it('weigert nul, negatieve en niet-gehele foutaantallen', () => {
    const resultaat = beoordeelProductiekernBaselineAfwijkingen([
      { testbestand: 'src/lib/bag/queryTransport.test.ts', aantalFouten: 0, productiekernGerelateerd: false },
    ]);

    expect(resultaat.uitsluitendBekendeNietProductiekernAfwijkingen).toBe(false);
    expect(resultaat.blokkades).toContain(
      'Een of meer baseline-afwijkingen hebben een ongeldig foutaantal.',
    );
  });
});
