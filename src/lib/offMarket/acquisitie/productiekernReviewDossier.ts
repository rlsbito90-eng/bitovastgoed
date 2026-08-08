import type { ProductiekernBaselineBeoordeling } from './productiekernBaselineAfwijkingen';
import type { ProductiekernReviewGereedheid } from './productiekernReviewGereedheid';

export interface ProductiekernReviewDossierInput {
  headSha: string;
  previewStatus: 'success' | 'pending' | 'failure' | 'unknown';
  baseline: ProductiekernBaselineBeoordeling;
  reviewGereedheid: ProductiekernReviewGereedheid;
  vastgelegdOp: string;
}

export interface ProductiekernReviewDossier {
  versie: 1;
  headSha: string;
  previewGroen: boolean;
  baselineFouten: number;
  uitsluitendBekendeBaseline: boolean;
  gereedVoorTechnischeReview: boolean;
  gereedVoorMerge: false;
  gereedVoorProductie: false;
  blokkades: string[];
  vastgelegdOp: string;
}

export function bouwProductiekernReviewDossier(
  input: ProductiekernReviewDossierInput,
): ProductiekernReviewDossier {
  const blokkades = [...input.reviewGereedheid.blokkades];
  const headSha = input.headSha.trim();
  const vastgelegdOp = input.vastgelegdOp.trim();

  if (!/^[0-9a-f]{40}$/i.test(headSha)) {
    blokkades.push('De review-head is geen geldige volledige commit-SHA.');
  }
  if (input.previewStatus !== 'success') {
    blokkades.push(`De actuele preview is niet groen: ${input.previewStatus}.`);
  }
  if (!input.baseline.uitsluitendBekendeNietProductiekernAfwijkingen) {
    blokkades.push(...input.baseline.blokkades.map((blok) => `Baseline: ${blok}`));
  }
  if (!vastgelegdOp || Number.isNaN(Date.parse(vastgelegdOp))) {
    blokkades.push('vastgelegdOp is geen geldige ISO-datum.');
  }

  return {
    versie: 1,
    headSha,
    previewGroen: input.previewStatus === 'success',
    baselineFouten: input.baseline.totaalFouten,
    uitsluitendBekendeBaseline:
      input.baseline.uitsluitendBekendeNietProductiekernAfwijkingen,
    gereedVoorTechnischeReview:
      input.reviewGereedheid.gereedVoorTechnischeReview && blokkades.length === 0,
    gereedVoorMerge: false,
    gereedVoorProductie: false,
    blokkades,
    vastgelegdOp,
  };
}
