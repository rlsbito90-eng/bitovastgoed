import { describe, expect, it } from 'vitest';
import { beoordeelProductiekernReviewGereedheid } from './productiekernReviewGereedheid';

const volledigeBundel = {
  volledig: true,
  blokkades: [],
  verleentProductieMigratie: false as const,
  verleentProductieActivatie: false as const,
};

describe('productiekern reviewgereedheid', () => {
  it('kan technische review toestaan zonder merge of productie toe te staan', () => {
    expect(beoordeelProductiekernReviewGereedheid({
      proefBewijs: volledigeBundel,
      actueleDdlEnRlsVastgelegd: true,
      sqlDriftHersteld: true,
      gerichteTestsGroen: true,
      typecheckGroen: true,
      productiebuildGroen: true,
      volledigeSuiteBekendeBaselineUitsluitend: true,
      prBeschrijvingActueel: true,
    })).toEqual({
      gereedVoorTechnischeReview: true,
      gereedVoorMerge: false,
      gereedVoorProductie: false,
      blokkades: [],
    });
  });

  it('verzamelt alle open reviewblokkades', () => {
    const resultaat = beoordeelProductiekernReviewGereedheid({
      proefBewijs: { ...volledigeBundel, volledig: false, blokkades: ['bewijs verlopen'] },
      actueleDdlEnRlsVastgelegd: false,
      sqlDriftHersteld: false,
      gerichteTestsGroen: false,
      typecheckGroen: false,
      productiebuildGroen: false,
      volledigeSuiteBekendeBaselineUitsluitend: false,
      prBeschrijvingActueel: false,
    });
    expect(resultaat.gereedVoorTechnischeReview).toBe(false);
    expect(resultaat.blokkades).toHaveLength(8);
    expect(resultaat.gereedVoorMerge).toBe(false);
    expect(resultaat.gereedVoorProductie).toBe(false);
  });
});
