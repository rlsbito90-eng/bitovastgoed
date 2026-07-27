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
    expect(item?.category).toBe('now');
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
    expect(item?.message).toContain('automatische tekstmatch');
    expect(item?.message).toContain('geen bevestigde dubbeling');
    expect(item?.details?.find((detail) => detail.label === 'Algemene kostenpost')?.value).toContain('Centrale transformatieraming');
    expect(item?.details?.find((detail) => detail.label === 'Componentkosten')?.value).toContain('Piet Heinstraat 89');
    expect(item?.details?.find((detail) => detail.label === 'Waarom gemeld')?.value).toContain('€ 300.000');
    expect(item?.actions).toHaveLength(2);
    expect(item?.actions?.[1]).toMatchObject({
      targetId: 'strategy-unit-unit-2',
      openTarget: true,
    });
  });


  it('legt per regel vast welk woord de overlapmelding activeerde', () => {
    const details = findDuplicateDevelopmentCostDetails([
      cost({
        id: 'cost-bouw',
        cost_category: 'Algemene bouwkosten',
        description: 'Nieuwbouw casco',
        amount: 250_000,
        reliability_status: 'hoog',
      }),
    ], [
      unit({ id: 'unit-bouw', unit_label: 'Nieuwbouwdeel', transformation_costs: 400_000 }),
    ]);

    expect(details).toHaveLength(1);
    expect(details[0].matchedTerms).toEqual(expect.arrayContaining(['nieuwbouw', 'bouwkosten']));
    expect(details[0].centralItems[0]).toMatchObject({ id: 'cost-bouw', amount: 250_000 });
    expect(details[0].componentItems[0]).toMatchObject({ id: 'unit-bouw', amount: 400_000 });
    expect(details[0].reviewState).toBe('onbeoordeeld');
  });

  it('respecteert de handmatige keuze WWS niet nodig', () => {
    const scenario = context().scenario as ValidationContext['scenario'] & { wws_mode_default?: string | null };
    scenario.wws_mode_default = 'niet_nodig';
    const result = buildNogTeControleren(context({ scenario }));

    expect(result.some((entry) => entry.message.includes('nog geen WWS-units'))).toBe(false);
    const notRelevant = result.find((entry) => entry.title === 'WWS niet relevant');
    expect(notRelevant?.category).toBe('not_relevant');
    expect(notRelevant?.actions?.[0]?.sectionId).toBe('sec-wws');
  });

  it('maakt de mixed-use OVB-waarschuwing direct navigeerbaar', () => {
    const scenario = context().scenario;
    scenario.ovb_mode = 'auto';
    const result = buildNogTeControleren(context({ scenario, objectType: 'mixed_use' }));

    const item = result.find((entry) => entry.title === 'OVB-verdeling kiezen');
    expect(item?.category).toBe('now');
    expect(item?.actions?.map((action) => action.sectionId)).toEqual(['sec-aankoop', 'sec-componenten']);
  });

  it('opent bij onvolledige OVB het eerste betreffende component', () => {
    const scenario = context().scenario;
    scenario.ovb_mode = 'per_component';
    const result = buildNogTeControleren(context({
      scenario,
      objectType: 'mixed_use',
      components: [comp({
        id: 'component-ovb',
        component_type: 'appartement',
        allocated_component_value: null,
        surface_gbo: null,
      })],
    }));

    const item = result.find((entry) => entry.title === 'OVB per component aanvullen');
    expect(item?.actions?.[0]).toMatchObject({
      targetId: 'componenten-unit-component-ovb',
      openTarget: true,
    });
  });
});
