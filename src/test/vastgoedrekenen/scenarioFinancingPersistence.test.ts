import { describe, expect, it } from 'vitest';
import { buildFinancingFacilityPayload } from '@/lib/vastgoedrekenen/scenarioFinancingPersistence';

function validDraft() {
  return {
    scenarioId: 'scenario-1',
    facilityName: 'Aankooplening',
    facilityType: 'acquisition' as const,
    commitmentAmount: '600.000',
    drawMethod: 'single_month' as const,
    drawStartMonth: '0',
    annualInterestRatePct: '6,25',
    interestMethod: 'cash' as const,
    arrangementFeePct: '1,00',
    arrangementFeeAmount: '',
    repaymentMethod: 'bullet' as const,
    amortizationStartMonth: '',
    maturityMonth: '24',
    source: 'Indicatieve term sheet 29-07-2026',
    notes: 'Aflossing bij verkoop',
    sortOrder: 0,
  };
}

describe('financieringsopslagcontract', () => {
  it('verwerkt Nederlandse getalnotatie en schrijft het volledige versiecontract', () => {
    expect(buildFinancingFacilityPayload(validDraft())).toEqual({
      scenario_id: 'scenario-1',
      facility_name: 'Aankooplening',
      facility_type: 'acquisition',
      commitment_amount: 600000,
      draw_method: 'single_month',
      draw_start_month: 0,
      annual_interest_rate_pct: 6.25,
      interest_method: 'cash',
      arrangement_fee_pct: 1,
      arrangement_fee_amount: null,
      repayment_method: 'bullet',
      amortization_start_month: null,
      maturity_month: 24,
      source: 'Indicatieve term sheet 29-07-2026',
      notes: 'Aflossing bij verkoop',
      sort_order: 0,
      schema_version: 1,
    });
  });

  it('vereist een bron en een positief leenbedrag', () => {
    expect(() => buildFinancingFacilityPayload({ ...validDraft(), source: '' })).toThrow(/bron of onderbouwing/i);
    expect(() => buildFinancingFacilityPayload({ ...validDraft(), commitmentAmount: '0' })).toThrow(/positief maximaal leenbedrag/i);
  });

  it('staat niet toe dat percentage en vast bedrag tegelijk worden gebruikt', () => {
    expect(() => buildFinancingFacilityPayload({
      ...validDraft(),
      arrangementFeeAmount: '5.000',
    })).toThrow(/percentage óf als vast bedrag/i);
  });

  it('vereist een geldige startmaand bij lineaire aflossing', () => {
    expect(() => buildFinancingFacilityPayload({
      ...validDraft(),
      repaymentMethod: 'linear',
      amortizationStartMonth: '',
    })).toThrow(/startmaand aflossing/i);

    expect(buildFinancingFacilityPayload({
      ...validDraft(),
      repaymentMethod: 'linear',
      amortizationStartMonth: '12',
      arrangementFeePct: '',
    }).amortization_start_month).toBe(12);
  });

  it('blokkeert een eindmaand die niet later is dan de eerste opname', () => {
    expect(() => buildFinancingFacilityPayload({
      ...validDraft(),
      drawStartMonth: '12',
      maturityMonth: '12',
    })).toThrow(/eindmaand moet later/i);
  });
});
