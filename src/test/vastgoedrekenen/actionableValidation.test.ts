import { describe, expect, it } from 'vitest';
import {
  buildNogTeControleren,
  findDuplicateDevelopmentCostDetails,
  type ValidationContext,
} from '@/lib/vastgoedrekenen/validation';
import { comp, cost, scen, unit } from './golden/fixtures';

function context(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    scenario: scen({
      strategy_type: 'herontwikkeling',
      ovb_mode: 'manual',
      transfer_tax_amount: 0,
      sale_strategy: 'geen_verkoop',
      rent_source: 'handmatig',
      cost_structure: 'bekend',
      contract_checked: true,
      service_costs_checked: true,
      mjop_present: 'ja',
    }),
    components: [comp({ component_type: 'appartement' })],
    costs: [],
    wwsUnits: [],
    sellOffUnits: [],
    objectType: 'enkelvoudig',
    propertyType: 'mixed_use',
    hasWoz: true,
    hasEnergyLabel: true,
    hasBouwjaar: true,
    ...overrides,
  };
}

describe('actiegerichte validatie Vastgoedrekenen', () => {
  it('behandelt onvoorzien over directe componentkosten niet als dubbele transformatiekosten', () => {
    const details = findDuplicateDevelopmentCostDetails([
      cost({
        id: 'cost-onvoorzien',
        cost_category: 'Bouwkosten',
        description: 'Onvoorzien over directe componentkosten (10%)',
        amount: 120_000,
        reliability_status: 'hoog',
        notes: 'Projectspecifieke risicoreservering d.d. 24-07-2026',
      }),
    ], [
      unit({ id: 'unit-1', strategy: 'transformeren_verkopen', transformation_costs: 300_000 }),
    ]);

    expect(details).toEqual([]);
  });

  it('wijst een niet-onderbouwde kostenpost rechtstreeks aan', () => {
    const result = buildNogTeControleren(context({
      costs: [cost({
        id: 'cost-advies',
        cost_category: 'Advieskosten',
        description: 'Architect en constructeur',
        amount: 75_000,
        reliability_status: null,
        notes: null,
      })],
    }));

    const item = result.find((entry) => entry.title === 'Kostenpost onderbouwen');
    expect(item?.message).toContain('Architect en constructeur');
    expect(item?.actions?.[0]).toEqual({
      label: 'Ga naar deze kostenpost',
      sectionId: 'sec-kosten',
      targetId: 'cost-cost-advies',
    });
  });

  it('benoemt beide invoerbronnen en geeft twee navigatieacties bij echte overlap', () => {
    const result = buildNogTeControleren(context({
      costs: [cost({
        id: 'cost-transformatie',
        cost_category: 'Bouwkosten transformatie',
        description: 'Centrale transformatieraming',
        amount: 300_000,
        reliability_status: 'hoog',
        notes: 'Aannemersraming d.d. 24-07-2026',
      })],
      sellOffUnits: [unit({
        id: 'unit-2',
        unit_label: 'Piet Heinstraat 89',
        strategy: 'transformeren_verkopen',
        transformation_costs: 300_000,
      })],
    }));

    const item = result.find((entry) => entry.title?.includes('dubbele transformatiekosten'));
    expect(item?.message).toContain('Centrale transformatieraming');
    expect(item?.message).toContain('1 component(en)');
    expect(item?.actions).toHaveLength(2);
    expect(item?.actions?.[1].targetId).toBe('strategy-unit-unit-2');
  });
});
