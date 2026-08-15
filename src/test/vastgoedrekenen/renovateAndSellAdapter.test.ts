import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  OTHER_PROJECT_COST_KEY,
  RENOVATION_COST_KEY,
  TEMPORARY_INCOME_WARNING,
  RenovateAndSellInputAdapter,
  getRenovateAndSellNormalizedValues,
  mergeRenovateAndSellCosts,
  type RenovateAndSellInput,
} from '@/lib/vastgoedrekenen/propositions';
import { computeSale } from '@/lib/vastgoedrekenen/verkoop';
import type { Scenario } from '@/lib/vastgoedrekenen/types';

const input = (overrides: Partial<RenovateAndSellInput> = {}): RenovateAndSellInput => ({
  purchasePrice: 500_000,
  renovationAreaM2: 200,
  renovationCostBasis: 'per_m2',
  renovationCostsPerM2: 1_000,
  otherProjectCosts: 50_000,
  unforeseenPercentage: 5,
  financingCosts: 25_000,
  projectDurationMonths: 12,
  saleValueSource: 'total',
  grossSaleValue: 1_000_000,
  saleCostsPercentage: 2,
  saleOtherCosts: 5_000,
  targetMarginAmount: 100_000,
  targetMarginPercentageOfGdv: 15,
  targetRoiPercentage: 20,
  sources: [{ sourceType: 'taxatie', reference: 'bron-1' }],
  ...overrides,
});

function normalized(overrides: Partial<RenovateAndSellInput> = {}) {
  return getRenovateAndSellNormalizedValues(RenovateAndSellInputAdapter.normalize(input(overrides)));
}

describe('RenovateAndSellInputAdapter', () => {
  it('is exporteerbaar en gebruikt de registryversie', () => {
    expect(RenovateAndSellInputAdapter.propositionType).toBe('renovate_and_sell');
    expect(RenovateAndSellInputAdapter.schemaVersion).toBe(1);
  });

  it('weigert negatieve bedragen en oppervlakten', () => {
    const result = RenovateAndSellInputAdapter.validate(input({
      purchasePrice: -1,
      renovationAreaM2: -2,
      saleOtherCosts: -3,
    }));
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toEqual(expect.arrayContaining([
      'purchasePrice', 'renovationAreaM2', 'saleOtherCosts',
    ]));
  });

  it('behoudt bronreferenties', () => {
    expect(RenovateAndSellInputAdapter.describeSources(input())).toEqual([
      { sourceType: 'taxatie', reference: 'bron-1' },
    ]);
    expect(RenovateAndSellInputAdapter.normalize(input()).sources).toHaveLength(1);
  });

  it('mapt scenario-invoer zonder outputs te berekenen', () => {
    const values = normalized();
    expect(values.scenarioPatch).toMatchObject({
      purchase_price: 500_000,
      sale_strategy: 'renoveren_verkopen',
      sale_price_source: 'total',
      sale_price_total: 1_000_000,
      sale_costs_percentage: 2,
      sale_other_costs: 5_000,
      sale_target_margin_amount: 100_000,
      sale_target_margin_percentage: 15,
      sale_target_roi_percentage: 20,
      financing_costs: 25_000,
      unforeseen_percentage: 5,
    });
    expect(values.scenarioPatch).not.toHaveProperty('totalInvestment');
    expect(values.scenarioPatch).not.toHaveProperty('roi');
    expect(values.scenarioPatch).not.toHaveProperty('maximumBid');
  });

  it('mapt verkoopwaarde per m² zonder de bruto verkoopwaarde zelf te berekenen', () => {
    const values = normalized({
      saleValueSource: 'per_m2',
      grossSaleValue: undefined,
      saleValuePerM2: 4_000,
      sellableAreaM2: 250,
    });
    expect(values.scenarioPatch).toMatchObject({
      sale_price_source: 'per_m2',
      sale_price_total: null,
      sale_price_per_m2: 4_000,
      sale_sellable_m2: 250,
    });
  });

  it('normaliseert renovatiekosten één keer naar stabiele adapter-owned kostenregels', () => {
    const values = normalized();
    expect(values.scenarioCosts).toEqual([
      expect.objectContaining({ ownershipKey: RENOVATION_COST_KEY, amount: 200_000 }),
      expect.objectContaining({ ownershipKey: OTHER_PROJECT_COST_KEY, amount: 50_000 }),
    ]);
  });

  it('vervangt adapter-owned regels en behoudt handmatige kostenregels', () => {
    const existing: Array<{ ownership_key: string | null; description?: string; amount: number }> = [
      { ownership_key: RENOVATION_COST_KEY, amount: 100 },
      { ownership_key: null, description: 'Handmatig', amount: 123 },
    ];
    const merged = mergeRenovateAndSellCosts(existing, normalized().scenarioCosts, (cost) => ({
      ownership_key: cost.ownershipKey as string,
      amount: cost.amount,
    }));
    expect(merged.filter((cost) => cost.ownership_key === RENOVATION_COST_KEY)).toHaveLength(1);
    expect(merged).toContainEqual(expect.objectContaining({ description: 'Handmatig', amount: 123 }));
  });

  it('plaatst verkoopkosten niet in scenario_costs', () => {
    const values = normalized();
    expect(values.scenarioCosts.some((cost) => cost.amount === 5_000)).toBe(false);
    expect(values.scenarioPatch.sale_other_costs).toBe(5_000);
  });

  it('registreert tijdelijke inkomsten zonder huur- of NOI-mapping', () => {
    const values = normalized({ temporaryProjectIncome: 10_000, temporaryProjectIncomeCosts: 2_000 });
    expect(values.scenarioPatch.temporary_project_income).toBe(10_000);
    expect(values.scenarioPatch.temporary_project_income_costs).toBe(2_000);
    expect(values.scenarioPatch).not.toHaveProperty('current_monthly_rent');
    expect(values.scenarioPatch).not.toHaveProperty('market_monthly_rent');
    expect(values.warnings).toContain(TEMPORARY_INCOME_WARNING);
    expect(values.scenarioCosts.every((cost) => cost.amount >= 0)).toBe(true);
  });

  it('sluit aan op bestaande verkooplogica: GDV bruto en verkoopkosten eenmaal', () => {
    const patch = normalized().scenarioPatch as unknown as Scenario;
    const result = computeSale(patch, 750_000, 500_000);
    expect(result.grossSaleProceeds).toBe(1_000_000);
    expect(result.saleCostsTotal).toBe(25_000);
    expect(result.netSaleProceeds).toBe(975_000);
    expect(result.netMargin).toBe(225_000);
  });

  it('legt alleen additieve registratieve scenariovelden vast', () => {
    const migration = readFileSync(
      `${process.cwd()}/supabase/migration-archive/pre-baseline-snapshot/20260727234500_vastgoedrekenen_2a3_renovate_and_sell.sql`,
      'utf8',
    );
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS renovation_area_m2 numeric');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS project_duration_months integer');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS temporary_project_income numeric');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS temporary_project_income_costs numeric');
    expect(migration).not.toContain('proposition_type');
    expect(migration).not.toContain('UPDATE public.calculation_scenarios');
  });
});
