import { describe, expect, it } from 'vitest';

import { bouwProductiekernReviewDossier } from './productiekernReviewDossier';

const groeneBaseline = {
  uitsluitendBekendeNietProductiekernAfwijkingen: true,
  totaalFouten: 9,
  onverwachteBestanden: [],
  blokkades: [],
};

const groeneReview = {
  gereedVoorTechnischeReview: true,
  gereedVoorMerge: false as const,
  gereedVoorProductie: false as const,
  blokkades: [],
};

describe('bouwProductiekernReviewDossier', () => {
  it('legt een groene technische reviewsnapshot vast zonder merge- of productieclaim', () => {
    const dossier = bouwProductiekernReviewDossier({
      headSha: 'a'.repeat(40),
      previewStatus: 'success',
      baseline: groeneBaseline,
      reviewGereedheid: groeneReview,
      vastgelegdOp: '2026-08-06T13:55:00.000Z',
    });

    expect(dossier.gereedVoorTechnischeReview).toBe(true);
    expect(dossier.gereedVoorMerge).toBe(false);
    expect(dossier.gereedVoorProductie).toBe(false);
    expect(dossier.baselineFouten).toBe(9);
  });

  it('blokkeert een pending preview en ongeldige head', () => {
    const dossier = bouwProductiekernReviewDossier({
      headSha: 'kort',
      previewStatus: 'pending',
      baseline: groeneBaseline,
      reviewGereedheid: groeneReview,
      vastgelegdOp: '2026-08-06T13:55:00.000Z',
    });

    expect(dossier.gereedVoorTechnischeReview).toBe(false);
    expect(dossier.blokkades).toHaveLength(2);
  });

  it('neemt review- en baselineblokkades fail-closed over', () => {
    const dossier = bouwProductiekernReviewDossier({
      headSha: 'b'.repeat(40),
      previewStatus: 'success',
      baseline: {
        ...groeneBaseline,
        uitsluitendBekendeNietProductiekernAfwijkingen: false,
        blokkades: ['Nieuwe regressie.'],
      },
      reviewGereedheid: {
        ...groeneReview,
        gereedVoorTechnischeReview: false,
        blokkades: ['DDL/RLS ontbreekt.'],
      },
      vastgelegdOp: 'ongeldig',
    });

    expect(dossier.blokkades).toEqual([
      'DDL/RLS ontbreekt.',
      'Baseline: Nieuwe regressie.',
      'vastgelegdOp is geen geldige ISO-datum.',
    ]);
  });
});
