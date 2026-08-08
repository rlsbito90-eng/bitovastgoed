export interface ProductiekernBaselineAfwijking {
  testbestand: string;
  aantalFouten: number;
  productiekernGerelateerd: boolean;
}

export interface ProductiekernBaselineBeoordeling {
  uitsluitendBekendeNietProductiekernAfwijkingen: boolean;
  totaalFouten: number;
  onverwachteBestanden: string[];
  blokkades: string[];
}

/**
 * Bekende regressiebaseline na synchronisatie met main op 2026-08-08.
 * BAG queryTransport is bewust verwijderd: die vier eerdere failures zijn op
 * de gesynchroniseerde branch groen geworden en mogen daarom niet opnieuw als
 * geaccepteerde baseline-afwijking worden beschouwd.
 */
export const BEKENDE_NIET_PRODUCTIEKERN_BASELINEBESTANDEN = [
  'src/lib/acquisitieRelatieMatching.test.ts',
  'src/lib/kadaster/databaseContract.test.ts',
  'src/lib/objectIdentity/backfillDryRun.test.ts',
  'src/test/vastgoedkansen/bagIdentifiersReadOnly.test.ts',
] as const;

export function beoordeelProductiekernBaselineAfwijkingen(
  afwijkingen: readonly ProductiekernBaselineAfwijking[],
): ProductiekernBaselineBeoordeling {
  const blokkades: string[] = [];
  const bekende = new Set<string>(BEKENDE_NIET_PRODUCTIEKERN_BASELINEBESTANDEN);
  const onverwachteBestanden = afwijkingen
    .filter(({ testbestand }) => !bekende.has(testbestand))
    .map(({ testbestand }) => testbestand);
  const productiekernAfwijkingen = afwijkingen.filter(
    ({ productiekernGerelateerd }) => productiekernGerelateerd,
  );
  const ongeldigeAantallen = afwijkingen.filter(
    ({ aantalFouten }) => !Number.isInteger(aantalFouten) || aantalFouten <= 0,
  );

  if (onverwachteBestanden.length > 0) {
    blokkades.push(
      `Onverwachte falende testbestanden: ${onverwachteBestanden.join(', ')}.`,
    );
  }
  if (productiekernAfwijkingen.length > 0) {
    blokkades.push('De regressiesuite bevat productiekern-gerelateerde fouten.');
  }
  if (ongeldigeAantallen.length > 0) {
    blokkades.push('Een of meer baseline-afwijkingen hebben een ongeldig foutaantal.');
  }

  return {
    uitsluitendBekendeNietProductiekernAfwijkingen: blokkades.length === 0,
    totaalFouten: afwijkingen.reduce(
      (totaal, afwijking) => totaal + Math.max(0, afwijking.aantalFouten),
      0,
    ),
    onverwachteBestanden,
    blokkades,
  };
}
