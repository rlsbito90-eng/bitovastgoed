import type { ProductiekernProefBewijsBundel } from './productiekernProefBewijsBundel';

export interface ProductiekernReviewGereedheidInput {
  proefBewijs: ProductiekernProefBewijsBundel;
  actueleDdlEnRlsVastgelegd: boolean;
  sqlDriftHersteld: boolean;
  gerichteTestsGroen: boolean;
  typecheckGroen: boolean;
  productiebuildGroen: boolean;
  volledigeSuiteBekendeBaselineUitsluitend: boolean;
  prBeschrijvingActueel: boolean;
}

export interface ProductiekernReviewGereedheid {
  gereedVoorTechnischeReview: boolean;
  gereedVoorMerge: false;
  gereedVoorProductie: false;
  blokkades: string[];
}

export function beoordeelProductiekernReviewGereedheid(
  input: ProductiekernReviewGereedheidInput,
): ProductiekernReviewGereedheid {
  const blokkades: string[] = [];
  if (!input.proefBewijs.volledig) {
    blokkades.push(...input.proefBewijs.blokkades.map((b) => `Proefbewijs: ${b}`));
  }
  if (!input.actueleDdlEnRlsVastgelegd) blokkades.push('Actuele DDL/RLS-verificatie is niet vastgelegd.');
  if (!input.sqlDriftHersteld) blokkades.push('SQL-drift na verificatie is niet aantoonbaar hersteld.');
  if (!input.gerichteTestsGroen) blokkades.push('Gerichte productiekern-tests zijn niet groen.');
  if (!input.typecheckGroen) blokkades.push('Typecheck is niet groen.');
  if (!input.productiebuildGroen) blokkades.push('Productiebuild is niet groen.');
  if (!input.volledigeSuiteBekendeBaselineUitsluitend) {
    blokkades.push('De volledige suite bevat niet uitsluitend bekende baselinefouten.');
  }
  if (!input.prBeschrijvingActueel) blokkades.push('De PR-beschrijving is niet actueel.');

  return {
    gereedVoorTechnischeReview: blokkades.length === 0,
    gereedVoorMerge: false,
    gereedVoorProductie: false,
    blokkades,
  };
}
