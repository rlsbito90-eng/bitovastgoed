import { describe, expect, it } from 'vitest';
import { computeScenario, type ComputeContext } from '@/lib/vastgoedrekenen/compute';
import { scen, unit } from './golden/fixtures';

function contextWithStrategy(extraInvestmentCosts = 200_000): ComputeContext {
  return {
    scenario: scen({
      purchase_price: 1_000_000,
      asking_price: 1_000_000,
      current_monthly_rent: 4_500,
      assumption_profile: 'handmatig',
      vacancy_percentage: 0,
      operating_cost_percentage: 0,
      maintenance_reserve_percentage: 0,
      management_cost_percentage: 0,
      other_annual_costs: 0,
      unforeseen_percentage: 0,
      due_diligence_costs: 0,
      ovb_mode: 'manual',
      transfer_tax_amount: 0,
      buyer_fee_method: 'zero',
      notary_costs_method: 'zero',
    }),
    components: [],
    costs: [],
    wwsUnits: [],
    strategyUnits: [
      unit({
        strategy: 'transformeren_verkopen',
        sale_price_total: 2_000_000,
        sale_costs_percentage: 0,
        transformation_costs: extraInvestmentCosts,
      }),
    ],
    taxSettings: null,
    objectType: 'enkelvoudig',
    objectArea: 100,
    propertyType: 'residentieel',
  };
}

describe('computeScenario — grondslag kengetallen totale investering', () => {
  it('neemt extra componentontwikkelkosten op in BAR, factor en NAR', () => {
    const output = computeScenario(contextWithStrategy());

    expect(output.totalInvestment).toBe(1_200_000);
    expect(output.correctedAnnualRent).toBe(54_000);
    expect(output.noi).toBe(54_000);
    expect(output.barTotalInvestment).toBe(4.5);
    expect(output.factorTotalInvestment).toBe(22.22);
    expect(output.narTotalInvestment).toBe(4.5);

    expect(output.barTotalInvestment).toBe(
      Number(((output.correctedAnnualRent / output.totalInvestment) * 100).toFixed(2)),
    );
    expect(output.narTotalInvestment).toBe(
      Number(((output.noi / output.totalInvestment) * 100).toFixed(2)),
    );
  });

  it('behoudt de bestaande uitkomsten zonder componentstrategie', () => {
    const ctx = contextWithStrategy(0);
    ctx.strategyUnits = [];

    const output = computeScenario(ctx);

    expect(output.totalInvestment).toBe(1_000_000);
    expect(output.barTotalInvestment).toBe(5.4);
    expect(output.factorTotalInvestment).toBe(18.52);
    expect(output.narTotalInvestment).toBe(5.4);
    expect(output.barPurchasePrice).toBe(5.4);
    expect(output.factorPurchasePrice).toBe(18.52);
  });

  it('geeft de scorecontext hetzelfde BAR als de gerapporteerde output', () => {
    const output = computeScenario(contextWithStrategy());

    expect(output.barTotalInvestment).toBe(4.5);
    expect(output.warnings).toContain('BAR op totale investering laag (<5%).');
  });
});
