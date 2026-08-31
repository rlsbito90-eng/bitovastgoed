import { describe, expect, it } from 'vitest';
import { summarizeUnifiedFees } from '@/lib/lifecycle/feeReporting';

describe('unified fee reporting', () => {
  it('telt bij een concrete Deal alleen de Deal fee en niet ook de Objectprognose', () => {
    const stats = summarizeUnifiedFees([
      {
        objectId: 'pernis',
        dealId: 'deal-1',
        feeSource: 'deal',
        pipelineFee: 14_000,
        realizedFee: 0,
        objectForecastFeeReference: 18_000,
        dealFeeReference: 14_000,
      },
    ], 2026);

    expect(stats.pipelineBedrag).toBe(14_000);
    expect(stats.dealForecastAantal).toBe(1);
    expect(stats.objectForecastAantal).toBe(0);
  });

  it('gebruikt de Objectfee zolang nog geen concrete transactie-Deal bestaat', () => {
    const stats = summarizeUnifiedFees([
      {
        objectId: 'object-zonder-deal',
        feeSource: 'object',
        pipelineFee: 18_000,
        realizedFee: 0,
        objectForecastFeeReference: 18_000,
      },
    ], 2026);

    expect(stats.pipelineBedrag).toBe(18_000);
    expect(stats.objectForecastAantal).toBe(1);
    expect(stats.dealForecastAantal).toBe(0);
  });

  it('verplaatst dezelfde fee bij closing uit pipeline naar gerealiseerd', () => {
    const stats = summarizeUnifiedFees([
      {
        objectId: 'closed-object',
        dealId: 'closed-deal',
        feeSource: 'deal',
        pipelineFee: 0,
        realizedFee: 14_000,
        realizedAt: '2026-08-31T10:00:00.000Z',
        objectForecastFeeReference: 18_000,
        dealFeeReference: 14_000,
      },
    ], 2026);

    expect(stats.pipelineBedrag).toBe(0);
    expect(stats.gerealiseerdBedrag).toBe(14_000);
    expect(stats.gerealiseerdAantal).toBe(1);
  });

  it('telt gerealiseerde fee alleen in het gevraagde rapportagejaar', () => {
    const rows = [{
      objectId: 'old-object',
      dealId: 'old-deal',
      feeSource: 'deal' as const,
      pipelineFee: 0,
      realizedFee: 9_000,
      realizedAt: '2025-12-31T10:00:00.000Z',
    }];

    expect(summarizeUnifiedFees(rows, 2026).gerealiseerdBedrag).toBe(0);
    expect(summarizeUnifiedFees(rows, 2025).gerealiseerdBedrag).toBe(9_000);
  });
});
