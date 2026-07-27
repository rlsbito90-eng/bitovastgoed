import { describe, expect, it } from 'vitest';
import { buildNogTeControleren, type ValidationContext } from '@/lib/vastgoedrekenen/validation';
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
    components: [],
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

function messages(result: ReturnType<typeof buildNogTeControleren>): string {
  return result.map((item) => item.message).join('\n');
}

describe('Vastgoedrekenen Fase 1.1-validatie', () => {
  it('accepteert component-GDV als verkoopopbrengstbron', () => {
    const result = buildNogTeControleren(context({
      sellOffUnits: [
        unit({
          strategy: 'transformeren_verkopen',
          sale_price_total: 1_500_000,
          sale_costs_pct: 2,
          transformation_costs: 400_000,
        }),
      ],
    }));

    expect(messages(result)).not.toContain('Verkoopscenario zonder verkoopopbrengst');
    expect(messages(result)).not.toContain('Verkoopkosten ontbreken bij de centrale scenario-exit');
  });

  it('signaleert dezelfde ontwikkelkost centraal en per component', () => {
    const result = buildNogTeControleren(context({
      costs: [cost({
        cost_category: 'Bouwkosten transformatie',
        amount: 300_000,
      })],
      sellOffUnits: [
        unit({
          strategy: 'transformeren_verkopen',
          sale_price_total: 1_500_000,
          sale_costs_pct: 2,
          transformation_costs: 300_000,
        }),
      ],
    }));

    expect(messages(result)).toContain('Mogelijke dubbele kosteninvoer');
    expect(messages(result)).toContain('transformatie');
  });

  it('waarschuwt niet voor dubbele kosten bij verschillende kostensoorten', () => {
    const result = buildNogTeControleren(context({
      costs: [cost({
        cost_category: 'Advies- en vergunningskosten',
        amount: 75_000,
      })],
      sellOffUnits: [
        unit({
          strategy: 'transformeren_verkopen',
          sale_price_total: 1_500_000,
          sale_costs_pct: 2,
          transformation_costs: 300_000,
        }),
      ],
    }));

    expect(messages(result)).not.toContain('Mogelijke dubbele kosteninvoer');
  });

  it('toont gemengde OVB als expliciet biedingsrisico', () => {
    const result = buildNogTeControleren(context({
      objectType: 'mixed_use',
      scenario: scen({
        strategy_type: 'herontwikkeling',
        ovb_mode: 'auto',
        sale_strategy: 'geen_verkoop',
      }),
      components: [
        comp({ component_type: 'woning' }),
        comp({ component_type: 'winkel' }),
      ],
    }));

    expect(messages(result)).toContain('Biedingsrisico: mixed-use object zonder OVB-toerekening per component');
  });

  it('toont gemengde btw-behandeling als expliciet biedingsrisico', () => {
    const result = buildNogTeControleren(context({
      costs: [
        cost({ cost_category: 'Bouwkosten', amount: 100_000, vat_treatment: 'pct_21' }),
        cost({ cost_category: 'Advieskosten', amount: 25_000, vat_treatment: 'verrekenbaar' }),
      ],
    }));

    expect(messages(result)).toContain('Biedingsrisico: meerdere btw-behandelingen');
  });

  it('onderscheidt handmatige waardering van een verkooptransactie', () => {
    const result = buildNogTeControleren(context({
      sellOffUnits: [
        unit({
          strategy: 'handmatige_waarde',
          hold_value_manual: 900_000,
        }),
      ],
    }));

    expect(messages(result)).toContain('handmatige waarderingsaannames en geen verkooptransacties');
  });
});
