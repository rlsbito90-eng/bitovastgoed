import { describe, expect, it } from 'vitest';
import { computeScenario } from '@/lib/vastgoedrekenen/compute';
import { aggregateStrategy } from '@/lib/vastgoedrekenen/componentStrategy';
import { computeScenarioOvb } from '@/lib/vastgoedrekenen/ovb';
import { computeResidualBid } from '@/lib/vastgoedrekenen/residueel';
import { computeSale } from '@/lib/vastgoedrekenen/verkoop';
import { comp, cost, scen, unit } from './golden/fixtures';

const baseScenario = (overrides: Record<string, unknown> = {}) => scen({
  purchase_price: 0,
  asking_price: 0,
  ovb_mode: 'manual',
  transfer_tax_amount: 0,
  buyer_fee_method: 'zero',
  notary_costs_method: 'zero',
  notary_costs: 0,
  advisory_costs: 0,
  due_diligence_costs: 0,
  other_acquisition_costs: 0,
  safety_margin: 0,
  financing_costs: 0,
  sale_target_margin_amount: 0,
  sale_target_margin_percentage: 0,
  sale_target_roi_percentage: 0,
  target_margin: 0,
  ...overrides,
});

function residual(overrides: Partial<Parameters<typeof computeResidualBid>[0]> = {}) {
  return computeResidualBid({
    scenario: baseScenario({ sale_target_margin_percentage: 20 }),
    components: [],
    taxSettings: null,
    objectType: 'residentieel',
    source: 'scenario_exit',
    grossDevelopmentValue: 1_000_000,
    componentDispositionCosts: 0,
    componentDevelopmentCosts: 0,
    sharedScenarioCosts: 200_000,
    financingCosts: 0,
    ...overrides,
  })!;
}

describe('residuele maximale koopsom', () => {
  it('gebruikt ook in de scenario-exit winst op bruto GDV', () => {
    const sale = computeSale(
      baseScenario({
        sale_price_total: 1_000_000,
        sale_costs_percentage: 2,
        sale_target_margin_percentage: 20,
      }),
      500_000,
      0,
    );
    // Netto opbrengst 980.000 minus 20% van bruto GDV (200.000).
    expect(sale.exitBasedMaxBid).toBe(780_000);
    expect(sale.exitBidBindingTarget).toBe('marge_pct');
  });

  it('rekent zonder vraagprijs terug op winst op kosten', () => {
    const result = residual({
      scenario: baseScenario({ sale_target_roi_percentage: 20 }),
    });
    expect(result.bindingTarget).toBe('winst_op_kosten');
    expect(result.allowedTotalInvestment).toBe(833_333);
    expect(result.maxPurchasePrice).toBe(633_333);
  });

  it('rekent winst op GDV rechtstreeks van de bruto opbrengstwaarde', () => {
    const result = residual();
    expect(result.bindingTarget).toBe('winst_op_gdv');
    expect(result.targetProfitAmount).toBe(200_000);
    expect(result.maxPurchasePrice).toBe(600_000);
  });

  it('kiest bij meerdere doelen het strengste doel', () => {
    const result = residual({
      scenario: baseScenario({
        sale_target_roi_percentage: 10,
        sale_target_margin_percentage: 15,
      }),
    });
    expect(result.bindingTarget).toBe('winst_op_gdv');
    expect(result.allowedTotalInvestment).toBe(850_000);
    expect(result.maxPurchasePrice).toBe(650_000);
  });

  it('ondersteunt een vaste doelwinst', () => {
    const result = residual({
      scenario: baseScenario({ sale_target_margin_amount: 125_000 }),
    });
    expect(result.bindingTarget).toBe('vaste_winst');
    expect(result.targetProfitAmount).toBe(125_000);
    expect(result.maxPurchasePrice).toBe(675_000);
  });

  it('markeert tegenstrijdige absolute winstvelden als Indicatief', () => {
    const result = residual({
      scenario: baseScenario({
        sale_target_margin_amount: 100_000,
        target_margin: 125_000,
      }),
    });
    expect(result.status).toBe('indicatief');
    expect(result.criticalIssues.join(' ')).toContain('Twee verschillende vaste doelwinsten');
  });

  it('trekt safety_margin exact één keer af', () => {
    const result = residual({
      scenario: baseScenario({
        sale_target_margin_percentage: 10,
        safety_margin: 50_000,
      }),
      sharedScenarioCosts: 100_000,
    });
    // 1.000.000 - 100.000 doelwinst - 100.000 projectkosten - 50.000 safety.
    expect(result.maxPurchasePrice).toBe(750_000);
    expect(result.acquisitionCostsAtMaxPurchase).toBe(50_000);
  });

  it('herberekent een procentuele aankoopfee tegen de kandidaat-koopsom', () => {
    const result = residual({
      scenario: baseScenario({
        sale_target_margin_percentage: 10,
        buyer_fee_method: 'percentage',
        buyer_fee_percentage: 1,
        buyer_fee_vat_percentage: 0,
      }),
      sharedScenarioCosts: 0,
    });
    expect(result.maxPurchasePrice).toBe(891_089);
    expect(result.acquisitionCostsAtMaxPurchase).toBe(8_911);
    expect(result.totalInvestmentAtMaxPurchase).toBe(900_000);
  });

  it('herberekent OVB tegen de kandidaat-koopsom', () => {
    const result = residual({
      scenario: baseScenario({
        ovb_mode: 'auto',
        transfer_tax_percentage: 10,
        sale_target_margin_percentage: 10,
      }),
      sharedScenarioCosts: 0,
    });
    expect(result.maxPurchasePrice).toBe(818_182);
    expect(result.transferTaxAtMaxPurchase).toBe(81_818);
    expect(result.totalInvestmentAtMaxPurchase).toBe(900_000);
  });

  it('vindt de hoogste hele euro die het bindende doel nog respecteert', () => {
    const result = residual({
      scenario: baseScenario({
        ovb_mode: 'auto',
        transfer_tax_percentage: 10,
        sale_target_margin_percentage: 10,
      }),
      sharedScenarioCosts: 0,
    });
    expect(result.converged).toBe(true);
    expect(result.iterations).toBeLessThan(64);
    const oneEuroHigher = result.maxPurchasePrice + 1;
    const ovbHigher = Math.round(oneEuroHigher * 0.1);
    expect(oneEuroHigher + ovbHigher).toBeGreaterThan(result.allowedTotalInvestment);
  });

  it('geeft €0 wanneer de uitgangspunten geen positieve koopsom dragen', () => {
    const result = residual({
      grossDevelopmentValue: 300_000,
      sharedScenarioCosts: 350_000,
      scenario: baseScenario({ sale_target_margin_amount: 25_000 }),
    });
    expect(result.maxPurchasePrice).toBe(0);
    expect(result.criticalIssues.join(' ')).toContain('geen positieve koopsom');
  });

  it('houdt zonder doelwinst een informatief residu, maar nooit Voor bieding', () => {
    const result = residual({ scenario: baseScenario() });
    expect(result.maxPurchasePrice).toBe(800_000);
    expect(result.bindingTarget).toBeNull();
    expect(result.status).toBe('indicatief');
  });
});

describe('componentstrategie voor transformatie en sloop-nieuwbouw', () => {
  it('neemt sloop/nieuwbouw als verkoopstrategie op en toont ontwikkelkosten bij investering', () => {
    const totals = aggregateStrategy([
      unit({
        strategy: 'sloop_nieuwbouw_verkopen',
        sale_price_total: 1_000_000,
        sale_costs_pct: 2,
        legal_costs: 10_000,
        transformation_costs: 300_000,
      }),
    ]);
    expect(totals.grossDevelopmentValue).toBe(1_000_000);
    expect(totals.componentDispositionCosts).toBe(30_000);
    expect(totals.componentDevelopmentCosts).toBe(300_000);
    expect(totals.netSaleProceeds).toBe(970_000);
    expect(totals.extraInvestmentCosts).toBe(300_000);
    expect(totals.scenarioValue).toBe(970_000);
  });

  it('neemt sloop/nieuwbouw als aanhoudstrategie op', () => {
    const totals = aggregateStrategy([
      unit({
        strategy: 'sloop_nieuwbouw_aanhouden',
        hold_valuation_method: 'handmatige_waarde',
        hold_value_manual: 900_000,
        transformation_costs: 250_000,
      }),
    ]);
    expect(totals.grossDevelopmentValue).toBe(900_000);
    expect(totals.componentDevelopmentCosts).toBe(250_000);
    expect(totals.extraInvestmentCosts).toBe(250_000);
  });
});

describe('OVB-verdeling op strategie', () => {
  it('gebruikt strategiewaarden als gewichten en laat de grondslagen optellen tot de koopsom', () => {
    const components = [
      comp({
        id: 'wonen',
        component_name: 'Wonen',
        component_type: 'woning',
        transfer_tax_allocation_method: 'strategy',
        transfer_tax_classification: 'woning_belegging',
      }),
      comp({
        id: 'winkel',
        component_name: 'Winkel',
        component_type: 'winkel',
        transfer_tax_allocation_method: 'strategy',
        transfer_tax_classification: 'niet_woning',
      }),
    ];
    const result = computeScenarioOvb(
      baseScenario({ purchase_price: 1_000_000, ovb_mode: 'per_component' }),
      components,
      null,
      'mixed_use',
      new Map([['wonen', 600_000], ['winkel', 400_000]]),
    );
    expect(result.perComponent.map((item) => item.basisValue)).toEqual([600_000, 400_000]);
    expect(result.perComponent.reduce((sum, item) => sum + item.basisValue, 0)).toBe(1_000_000);
    expect(result.totalOvb).toBe(89_600);
  });
});

describe('computeScenario residuele integratie', () => {
  const combinedContext = (scenarioOverrides: Record<string, unknown> = {}) => ({
    scenario: baseScenario({
      ovb_mode: 'per_component',
      sale_target_margin_percentage: 15,
      leading_valuation_track: 'auto',
      ...scenarioOverrides,
    }),
    components: [
      comp({
        id: 'voorhuis',
        component_name: 'Voorhuis',
        component_type: 'woning',
        transfer_tax_allocation_method: 'strategy',
        transfer_tax_classification: 'woning_belegging',
      }),
      comp({
        id: 'achterhuis',
        component_name: 'Achterhuis',
        component_type: 'niet_woning',
        transfer_tax_allocation_method: 'strategy',
        transfer_tax_classification: 'niet_woning',
      }),
    ],
    costs: [cost({ amount: 50_000, reliability_status: 'hoog' })],
    wwsUnits: [],
    strategyUnits: [
      unit({
        id: 'transformatie',
        component_id: 'voorhuis',
        unit_label: 'Transformatie',
        strategy: 'transformeren_verkopen',
        sale_price_total: 900_000,
        sale_costs_pct: 2,
        transformation_costs: 250_000,
      }),
      unit({
        id: 'nieuwbouw',
        component_id: 'achterhuis',
        unit_label: 'Sloop-nieuwbouw',
        strategy: 'sloop_nieuwbouw_verkopen',
        sale_price_total: 1_100_000,
        sale_costs_pct: 2,
        transformation_costs: 400_000,
      }),
    ],
    taxSettings: null,
    objectType: 'mixed_use' as const,
    objectArea: 500,
    propertyType: 'mixed_use' as const,
  });

  it('berekent zonder vraagprijs een leidende residuele maximale koopsom', () => {
    const outputs = computeScenario(combinedContext());
    expect(outputs.residual).not.toBeNull();
    expect(outputs.maxPurchasePrice).toBeGreaterThan(0);
    expect(outputs.leadingMaxBasis).toBe('strategie');
    expect(outputs.leadingMaxValue).toBe(outputs.maxPurchasePrice);
    expect(outputs.scoreLabel).toBe('Residueel bepaald');
    expect(outputs.conclusion).toContain('Geen vraagprijs');
    expect(outputs.residual?.status).toBe('voor_bieding');
  });

  it('verwerkt componentopbrengsten en ontwikkelkosten in de algemene verkoop-KPI’s', () => {
    const outputs = computeScenario(combinedContext({
      purchase_price: 1_000_000,
      ovb_mode: 'manual',
      transfer_tax_amount: 0,
    }));

    expect(outputs.grossSaleProceeds).toBe(2_000_000);
    expect(outputs.saleCostsTotal).toBe(40_000);
    expect(outputs.netSaleProceeds).toBe(1_960_000);
    expect(outputs.totalInvestment).toBe(1_700_000);
    expect(outputs.netMargin).toBe(260_000);
    expect(outputs.roi).toBe(15.29);
    expect(outputs.saleHasInput).toBe(true);
  });

  it('toont zonder ingevoerde koopsom wel opbrengst en kosten, maar geen misleidende ROI', () => {
    const outputs = computeScenario(combinedContext({
      ovb_mode: 'manual',
      transfer_tax_amount: 0,
    }));

    expect(outputs.netSaleProceeds).toBe(1_960_000);
    expect(outputs.totalInvestment).toBe(700_000);
    expect(outputs.netMargin).toBeNull();
    expect(outputs.roi).toBeNull();
  });

  it('laat ontbrekende sloop-/nieuwbouwkosten de status Indicatief maken', () => {
    const context = combinedContext();
    context.strategyUnits[1] = unit({
      ...context.strategyUnits[1],
      transformation_costs: 0,
    });
    const outputs = computeScenario(context);
    expect(outputs.residual?.status).toBe('indicatief');
    expect(outputs.residual?.criticalIssues.join(' ')).toContain('sloop- en nieuwbouwkosten');
  });

  it('telt scenario-exit niet op bij een actieve componentstrategie', () => {
    const outputs = computeScenario(combinedContext({
      sale_strategy: 'transformeren_verkopen',
      sale_price_total: 3_000_000,
    }));
    expect(outputs.residual?.source).toBe('componentstrategie');
    expect(outputs.residual?.grossDevelopmentValue).toBe(2_000_000);
    expect(outputs.residual?.status).toBe('indicatief');
    expect(outputs.residual?.criticalIssues.join(' ')).toContain('Scenario-exit en componentstrategie');
  });
});
