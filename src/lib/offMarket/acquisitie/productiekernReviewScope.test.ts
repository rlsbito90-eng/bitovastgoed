import { describe, expect, it } from 'vitest';

import { beoordeelProductiekernReviewScope } from './productiekernReviewScope';

describe('beoordeelProductiekernReviewScope', () => {
  it('accepteert uitsluitend productiekerncode, drafts en documentatie', () => {
    const resultaat = beoordeelProductiekernReviewScope([
      'src/lib/offMarket/acquisitie/productiekernReviewScope.ts',
      'supabase/migration-drafts/20260806_acquisitie_productiekern_build_a.sql',
      'docs/off-market/ACQUISITIE-PRODUCTIEKERN-SCHEMAREVIEW.md',
    ]);

    expect(resultaat).toEqual({
      binnenScope: true,
      buitenScopeBestanden: [],
      verbodenDomeinen: [],
      blokkades: [],
    });
  });

  it('blokkeert wijzigingen buiten de toegestane paden', () => {
    const resultaat = beoordeelProductiekernReviewScope([
      'src/components/off-market/AcquisitieSelectieTab.tsx',
    ]);

    expect(resultaat.binnenScope).toBe(false);
    expect(resultaat.buitenScopeBestanden).toEqual([
      'src/components/off-market/AcquisitieSelectieTab.tsx',
    ]);
  });

  it('signaleert verboden domeinen afzonderlijk', () => {
    const resultaat = beoordeelProductiekernReviewScope([
      'src/lib/bag/queryTransport.ts',
      'src/lib/kadaster/databaseContract.ts',
      'src/test/vastgoedkansen/bagIdentifiersReadOnly.test.ts',
      'src/lib/objectIdentity/backfillDryRun.ts',
    ]);

    expect(resultaat.binnenScope).toBe(false);
    expect(resultaat.verbodenDomeinen).toEqual([
      'BAG',
      'Kadaster',
      'Vastgoedkansen',
      'Objectidentiteit-backfill',
    ]);
  });
});
