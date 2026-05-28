// Uitgebreide Golden Testcases voor Vastgoedrekenen.
//
// Doel: harde, exacte rekenkundige asserties op kritieke ketens —
// componentstrategie, scenariowaarde, max bieding, roundsAtAsking,
// aankoopfee incl. btw, OVB-modi, bouwkosten/btw, WWS, edge cases
// en betrouwbaarheid. Behoudt bestaande tests (compute.test.ts).

import { describe, it, expect } from 'vitest';
import { computeScenario, type ComputeContext } from '@/lib/vastgoedrekenen/compute';
import { computeAcquisitionCosts, computeTotalCosts } from '@/lib/vastgoedrekenen/investering';
import { computeScenarioOvb } from '@/lib/vastgoedrekenen/ovb';
import { computeSale } from '@/lib/vastgoedrekenen/verkoop';
import { aggregateStrategy } from '@/lib/vastgoedrekenen/componentStrategy';
import { getWwsCorrectedAnnualRent } from '@/lib/vastgoedrekenen/huur';
import {
  detectCaseType, getCaseRequirement, CASE_REQUIREMENTS, type CaseType,
} from '@/lib/vastgoedrekenen/validation/caseRequirements';
import { fieldStatus, readManualZeroFields } from '@/lib/vastgoedrekenen/validation/fieldStatus';
import { computeReliability } from '@/lib/vastgoedrekenen/validation/reliability';
import { buildNogTeControleren, type ValidationItem } from '@/lib/vastgoedrekenen/validation';
import { scen, comp, cost, unit } from './fixtures';
import type { WwsUnit } from '@/lib/vastgoedrekenen/types';

const baseCtx = (over: Partial<ComputeContext> = {}): ComputeContext => ({
  scenario: scen({}),
  components: [],
  costs: [],
  wwsUnits: [],
  strategyUnits: [],
  taxSettings: null,
  objectType: 'enkelvoudig',
  objectArea: 100,
  propertyType: 'residentieel',
  ...over,
});

const APPROX = 2; // €-marge voor afrondingen

// ============================================================
// 1. HINTHAMERSTRAAT — STRAKKE ASSERTIES
// ============================================================
describe('Hinthamerstraat — strakke componentstrategie-asserties', () => {
  // Setup: 6 woningen verkopen, 2 winkels aanhouden via BAR.
  const ctx: ComputeContext = {
    scenario: scen({
      purchase_price: 1_800_000,
      asking_price: 1_950_000,
      target_bar: 6.5,
      ovb_mode: 'per_component',
      rent_source: 'componenten',
      bid_basis: 'huur',
      sale_costs_percentage: 2,
    }),
    components: [
      comp({ id: 'w1', component_type: 'winkel', surface_gbo: 90, current_monthly_rent: 2500, allocated_component_value: 350_000 }),
      comp({ id: 'w2', component_type: 'winkel', surface_gbo: 90, current_monthly_rent: 2500, allocated_component_value: 350_000 }),
      comp({ id: 'won1', component_type: 'woning', surface_gbo: 65, allocated_component_value: 200_000 }),
      comp({ id: 'won2', component_type: 'woning', surface_gbo: 65, allocated_component_value: 200_000 }),
      comp({ id: 'won3', component_type: 'woning', surface_gbo: 65, allocated_component_value: 200_000 }),
      comp({ id: 'won4', component_type: 'woning', surface_gbo: 65, allocated_component_value: 200_000 }),
      comp({ id: 'won5', component_type: 'woning', surface_gbo: 65, allocated_component_value: 200_000 }),
      comp({ id: 'won6', component_type: 'woning', surface_gbo: 65, allocated_component_value: 200_000 }),
    ],
    costs: [cost({ label: 'Verbouwing woningen', amount: 200_000, contingency_percentage: 10 })],
    wwsUnits: [],
    strategyUnits: [
      unit({ id: 'u1', component_id: 'w1', unit_type: 'winkel', strategy: 'aanhouden', hold_valuation_method: 'BAR', hold_monthly_rent: 2500, hold_bar: 6.5 }),
      unit({ id: 'u2', component_id: 'w2', unit_type: 'winkel', strategy: 'aanhouden', hold_valuation_method: 'BAR', hold_monthly_rent: 2500, hold_bar: 6.5 }),
      ...[1, 2, 3, 4, 5, 6].map((i) => unit({
        id: `uw${i}`, component_id: `won${i}`, unit_type: 'woning',
        strategy: 'verkopen_leeg', sale_price_total: 235_000, sale_costs_pct: 2,
      })),
    ],
    taxSettings: null,
    objectType: 'mixed_use',
    objectArea: 570,
    propertyType: 'mixed_use',
  };
  const o = computeScenario(ctx);
  const strat = aggregateStrategy(ctx.strategyUnits ?? []);

  it('telt 6 verkoopcomponenten en 2 aanhoudcomponenten', () => {
    expect(strat.perUnit.filter((p) => p.strategy === 'verkopen_leeg')).toHaveLength(6);
    expect(strat.perUnit.filter((p) => p.strategy === 'aanhouden')).toHaveLength(2);
  });

  it('strategyMix bevat juiste tellingen', () => {
    expect(o.strategyMix).toContain('6×');
    expect(o.strategyMix).toContain('2×');
    expect(o.strategyMix).toContain('Verkopen (leeg)');
    expect(o.strategyMix).toContain('Aanhouden');
  });

  it('bruto verkoopwaarde woningen = 6 × 235.000 = 1.410.000', () => {
    const bruto = strat.perUnit.filter((p) => p.strategy === 'verkopen_leeg')
      .reduce((s, p) => s + p.breakdown.grossSaleValue, 0);
    expect(bruto).toBe(1_410_000);
  });

  it('verkoopkosten woningen = 6 × round(235.000 × 2%) = 28.200', () => {
    const sc = strat.perUnit.filter((p) => p.strategy === 'verkopen_leeg')
      .reduce((s, p) => s + p.breakdown.saleCosts, 0);
    expect(sc).toBe(28_200);
  });

  it('netto verkoopopbrengst woningen = bruto − verkoopkosten = 1.381.800', () => {
    expect(o.saleNetProceedsUnits).toBe(1_381_800);
  });

  it('jaarlijkse winkelhuur = 2 × 2500 × 12 = 60.000', () => {
    // per unit holdAnnual = 2500*12=30000 → ×2 = 60000
    // Niet direct exposed; controleer via holdValue: 60000 / 6.5% = 923.077 → ×2 = 1.846.154
    // Per unit: 30000 / 0.065 = 461538.46 → round 461538; ×2 = 923076
    expect(o.holdValue).toBe(923_076);
  });

  it('totale scenarioValue = saleNetProceeds + holdValue = 2.304.876', () => {
    expect(o.scenarioValue).toBe(1_381_800 + 923_076);
  });

  it('totalInvestment = aankoop + OVB + acq + kosten + financiering (identiteit)', () => {
    const sum = 1_800_000 + o.totalTransferTax + o.totalAcquisitionCosts + o.totalCosts + 0;
    // totalInvestment kan inclusief extraInvestmentCosts van strategy zijn
    expect(Math.abs(o.totalInvestment - (sum + strat.extraInvestmentCosts))).toBeLessThan(APPROX);
  });

  it('verschil met vraagprijs = maximumBid − asking_price (1.950.000)', () => {
    expect(Math.abs(o.differenceWithAskingPrice - (o.maximumBid - 1_950_000))).toBeLessThan(APPROX);
  });

  it('maxPurchasePrice en roundsAtAsking zijn gedefinieerd door strategie', () => {
    expect(o.maxPurchasePrice).not.toBeNull();
    expect(typeof o.roundsAtAsking).toBe('boolean');
    // Consistentie: roundsAtAsking ↔ maxPurchasePrice >= asking
    expect(o.roundsAtAsking).toBe((o.maxPurchasePrice ?? 0) >= 1_950_000);
  });
});

// ============================================================
// 2. AANKOOPFEE INCL. BTW
// ============================================================
describe('Aankoopfee incl. btw — exact effect op investering en maxBid', () => {
  const mk = (feePct: number) => baseCtx({
    scenario: scen({
      purchase_price: 1_950_000,
      asking_price: 2_000_000,
      current_monthly_rent: 10_000,
      target_bar: 6,
      ovb_mode: 'manual',
      transfer_tax_amount: 0, // neutraliseer OVB
      buyer_fee_percentage: feePct,
      buyer_fee_vat_percentage: 21,
    }),
  });

  const zonderFee = computeScenario(mk(0));
  const metFee = computeScenario(mk(1.5));

  it('fee base = 29.250 en btw = 6.143 bij 1,5% over € 1.950.000', () => {
    const acq = computeAcquisitionCosts(mk(1.5).scenario);
    expect(acq.buyerFeeBase).toBe(29_250);
    expect(acq.buyerFeeVat).toBe(6_143); // round(29250 * 0.21)
  });

  it('totalAcquisitionCosts stijgt met exact 35.393 (29.250 + 6.143)', () => {
    expect(metFee.totalAcquisitionCosts - zonderFee.totalAcquisitionCosts).toBe(35_393);
  });

  it('totalInvestment stijgt met exact 35.393', () => {
    expect(metFee.totalInvestment - zonderFee.totalInvestment).toBe(35_393);
  });

  it('maximumBid daalt met exact 35.393', () => {
    expect(zonderFee.maximumBid - metFee.maximumBid).toBe(35_393);
  });
});

// ============================================================
// 3. OVB-MODI VERGELIJKING
// ============================================================
describe('OVB-modi — totalTransferTax verschilt correct per modus', () => {
  const purchase = 1_000_000;
  const baseScen = (over: Record<string, unknown>) => scen({
    purchase_price: purchase, asking_price: 1_050_000,
    current_monthly_rent: 6000, target_bar: 6,
    ...over,
  });

  it('auto / residentieel (woning_belegging fallback) → 8% = 80.000', () => {
    const ovb = computeScenarioOvb(baseScen({ ovb_mode: 'auto' }), [], null, 'residentieel');
    expect(ovb.totalOvb).toBe(80_000);
    expect(ovb.method).toBe('scenario');
  });

  it('auto met commerciële override percentage 10,4 → 104.000', () => {
    const ovb = computeScenarioOvb(
      baseScen({ ovb_mode: 'auto', transfer_tax_percentage: 10.4 }),
      [], null, 'commercieel',
    );
    expect(ovb.totalOvb).toBe(104_000);
  });

  it('manual override is leidend', () => {
    const ovb = computeScenarioOvb(
      baseScen({ ovb_mode: 'manual', transfer_tax_amount: 55_000 }),
      [], null, 'residentieel',
    );
    expect(ovb.totalOvb).toBe(55_000);
    expect(ovb.method).toBe('manual');
  });

  it('per_component telt component-OVB correct op', () => {
    const components = [
      comp({ id: 'a', component_type: 'woning', allocated_component_value: 600_000, transfer_tax_classification: 'woning_belegging' }),
      comp({ id: 'b', component_type: 'winkel', allocated_component_value: 400_000, transfer_tax_classification: 'niet_woning' }),
    ];
    const ovb = computeScenarioOvb(
      baseScen({ ovb_mode: 'per_component' }),
      components, null, 'mixed_use',
    );
    // 600.000 × 8% = 48.000 ; 400.000 × 10,4% = 41.600 → totaal 89.600
    expect(ovb.totalOvb).toBe(89_600);
    expect(ovb.method).toBe('per_component');
    expect(ovb.perComponent).toHaveLength(2);
  });

  // OVB 2026-tarieven — regressie tegen verkeerd 10,4% voor belegging.
  describe('OVB-tarieven 2026', () => {
    const purchase2 = 500_000;
    it('eigen woning / hoofdverblijf → 2%', () => {
      const ovb = computeScenarioOvb(
        scen({ purchase_price: purchase2, ovb_mode: 'auto', ovb_classification: 'eigen_woning' }),
        [], null, 'residentieel',
      );
      expect(ovb.totalOvb).toBe(10_000);
    });
    it('woning niet-hoofdverblijf / belegging → 8%', () => {
      const ovb = computeScenarioOvb(
        scen({ purchase_price: purchase2, ovb_mode: 'auto', ovb_classification: 'woning_belegging' }),
        [], null, 'residentieel',
      );
      expect(ovb.totalOvb).toBe(40_000);
    });
    it('niet-woning / commercieel → 10,4%', () => {
      const ovb = computeScenarioOvb(
        scen({ purchase_price: purchase2, ovb_mode: 'auto', ovb_classification: 'niet_woning' }),
        [], null, 'commercieel',
      );
      expect(ovb.totalOvb).toBe(52_000);
    });
    it('mixed-use per_component: wonen 8%, commercieel 10,4% — ook zonder expliciete classificatie', () => {
      const components = [
        // Geen expliciete classificatie → moet uit component_type worden afgeleid.
        comp({ id: 'w', component_type: 'woning', allocated_component_value: 300_000, transfer_tax_classification: null }),
        comp({ id: 'c', component_type: 'winkelruimte', allocated_component_value: 200_000, transfer_tax_classification: null }),
      ];
      const ovb = computeScenarioOvb(
        scen({ purchase_price: 500_000, ovb_mode: 'per_component' }),
        components, null, 'mixed_use',
      );
      const woon = ovb.perComponent.find((p) => p.id === 'w')!;
      const comm = ovb.perComponent.find((p) => p.id === 'c')!;
      expect(woon.pct).toBe(8);
      expect(comm.pct).toBe(10.4);
      expect(ovb.totalOvb).toBe(300_000 * 0.08 + 200_000 * 0.104);
    });

  it('totalInvestment volgt OVB-keuze (delta = OVB-delta)', () => {
    const a = computeScenario(baseCtx({
      scenario: baseScen({ ovb_mode: 'manual', transfer_tax_amount: 50_000 }),
    }));
    const b = computeScenario(baseCtx({
      scenario: baseScen({ ovb_mode: 'manual', transfer_tax_amount: 80_000 }),
    }));
    expect(b.totalInvestment - a.totalInvestment).toBe(30_000);
    expect(a.maximumBid - b.maximumBid).toBe(30_000);
  });
});

// ============================================================
// 4. ROUND TE REKENEN JA/NEE
// ============================================================
describe('roundsAtAsking — consistentie met maxPurchasePrice vs asking', () => {
  const mkStrategy = (asking: number, totaalUnitWaarde: number) => baseCtx({
    scenario: scen({ purchase_price: 1_000_000, asking_price: asking, target_bar: 6 }),
    strategyUnits: [
      unit({ id: 'h', strategy: 'aanhouden', hold_valuation_method: 'BAR', hold_monthly_rent: totaalUnitWaarde * 0.06 / 12, hold_bar: 6 }),
    ],
  });

  it('rond rekenen: lage vraagprijs → roundsAtAsking = true', () => {
    const o = computeScenario(mkStrategy(500_000, 2_000_000));
    expect(o.strategyEnabled).toBe(true);
    expect(o.maxPurchasePrice).not.toBeNull();
    expect(o.maxPurchasePrice!).toBeGreaterThanOrEqual(500_000);
    expect(o.roundsAtAsking).toBe(true);
  });

  it('rekent niet rond: hoge vraagprijs → roundsAtAsking = false', () => {
    const o = computeScenario(mkStrategy(5_000_000, 1_000_000));
    expect(o.roundsAtAsking).toBe(false);
    expect(o.maxPurchasePrice!).toBeLessThan(5_000_000);
  });

  it('differenceWithAskingPrice = maximumBid − vraagprijs (consistent label)', () => {
    const o = computeScenario(mkStrategy(2_000_000, 2_000_000));
    expect(o.differenceWithAskingPrice).toBe(o.maximumBid - 2_000_000);
  });
});

// ============================================================
// 5. VERKOOPKOSTEN EN NETTO VERKOOPOPBRENGST
// ============================================================
describe('Verkoop / unit-exit — bruto, kosten, netto', () => {
  const mk = (pct: number) => scen({
    purchase_price: 400_000, asking_price: 450_000,
    strategy_type: 'verkopen_geheel', sale_strategy: 'verkopen_geheel',
    bid_basis: 'verkoop', sale_price_total: 700_000,
    sale_costs_percentage: pct,
    sale_target_margin_amount: 50_000,
  });

  it('grossSaleProceeds = 700.000 en saleCostsTotal = 14.000 bij 2%', () => {
    const sale = computeSale(mk(2), 500_000, 400_000);
    expect(sale.grossSaleProceeds).toBe(700_000);
    expect(sale.saleCostsTotal).toBe(14_000);
    expect(sale.netSaleProceeds).toBe(686_000);
  });

  it('scenario gebruikt netto (na verkoopkosten) — wijziging pct schuift maxBid', () => {
    const a = computeScenario(baseCtx({ scenario: mk(2) }));
    const b = computeScenario(baseCtx({ scenario: mk(5) }));
    // 5% i.p.v. 2% → 21.000 extra kosten → netSale daalt met 21.000 → exit-based maxBid met 21.000.
    expect(a.netSaleProceeds! - b.netSaleProceeds!).toBe(21_000);
    expect(a.maximumBid - b.maximumBid).toBe(21_000);
    expect(a.bidBasisUsed).toBe('verkoop');
  });
});

// ============================================================
// 6. HOLDWAARDE (BAR)
// ============================================================
describe('Holdwaarde — BAR / NAR / factor', () => {
  it('BAR: jaarhuur 30.000 / 6% = 500.000', () => {
    const u = unit({ strategy: 'aanhouden', hold_valuation_method: 'BAR', hold_monthly_rent: 2500, hold_bar: 6 });
    const agg = aggregateStrategy([u]);
    expect(agg.holdValue).toBe(500_000);
  });

  it('Factor: jaarhuur × factor', () => {
    const u = unit({ strategy: 'aanhouden', hold_valuation_method: 'factor', hold_monthly_rent: 2000, hold_factor: 14 });
    const agg = aggregateStrategy([u]);
    expect(agg.holdValue).toBe(24_000 * 14);
  });

  it('BAR-wijziging beïnvloedt holdValue (lagere BAR → hogere waarde)', () => {
    const u1 = unit({ strategy: 'aanhouden', hold_valuation_method: 'BAR', hold_monthly_rent: 2500, hold_bar: 6 });
    const u2 = unit({ strategy: 'aanhouden', hold_valuation_method: 'BAR', hold_monthly_rent: 2500, hold_bar: 5 });
    expect(aggregateStrategy([u2]).holdValue).toBeGreaterThan(aggregateStrategy([u1]).holdValue);
  });

  it('Ontbrekende BAR bij aanhouden geeft waarschuwing', () => {
    const u = unit({ strategy: 'aanhouden', hold_valuation_method: 'BAR', hold_monthly_rent: 2500, hold_bar: 0 });
    const agg = aggregateStrategy([u]);
    expect(agg.warnings.some((w) => w.toLowerCase().includes('bar'))).toBe(true);
  });
});

// ============================================================
// 7. BOUWKOSTEN BTW-BEHANDELING
// ============================================================
describe('Bouwkosten btw — geen / 21% / verrekenbaar / handmatig', () => {
  // base = 100.000 + 10% onvoorzien = 110.000
  const mk = (over: Record<string, unknown>) => [cost({ amount: 100_000, contingency_percentage: 10, ...over })];

  it('geen btw → totalCosts = 110.000', () => {
    const t = computeTotalCosts(mk({ vat_treatment: 'geen' }), 10);
    expect(t.total).toBe(110_000);
    expect(t.vatTotal).toBe(0);
  });

  it('21% btw → totalCosts = 133.100 (110.000 + 23.100)', () => {
    const t = computeTotalCosts(mk({ vat_treatment: 'pct_21' }), 10);
    expect(t.vatTotal).toBe(23_100);
    expect(t.total).toBe(133_100);
  });

  it('verrekenbaar → totalCosts = 110.000 (geen btw als kosten)', () => {
    const t = computeTotalCosts(mk({ vat_treatment: 'verrekenbaar' }), 10);
    expect(t.vatTotal).toBe(0);
    expect(t.total).toBe(110_000);
  });

  it('handmatig met vat_amount_manual = 15.000 → totalCosts = 125.000', () => {
    const t = computeTotalCosts(mk({ vat_treatment: 'handmatig', vat_amount_manual: 15_000 }), 10);
    expect(t.vatTotal).toBe(15_000);
    expect(t.total).toBe(125_000);
  });

  it('totalInvestment in scenario stijgt 1:1 met btw-bedrag', () => {
    // scenario.unforeseen_percentage=10 zodat onvoorzien meegerekend wordt
    const ctxGeen = baseCtx({
      scenario: scen({ purchase_price: 500_000, asking_price: 550_000, current_monthly_rent: 3000, target_bar: 6, unforeseen_percentage: 10 }),
      costs: mk({ vat_treatment: 'geen' }),
    });
    const ctx21 = baseCtx({
      scenario: scen({ purchase_price: 500_000, asking_price: 550_000, current_monthly_rent: 3000, target_bar: 6, unforeseen_percentage: 10 }),
      costs: mk({ vat_treatment: 'pct_21' }),
    });
    const a = computeScenario(ctxGeen);
    const b = computeScenario(ctx21);
    expect(b.totalInvestment - a.totalInvestment).toBe(23_100);
    expect(a.maximumBid - b.maximumBid).toBe(23_100);
  });
});

// ============================================================
// 8. WWS — gecorrigeerde huur als bron
// ============================================================
describe('WWS — gecorrigeerde jaarhuur wordt gebruikt', () => {
  const wwsUnits: WwsUnit[] = [
    { id: 'w1', scenario_id: 's1', corrected_monthly_rent: 900, current_monthly_rent: 1400 } as unknown as WwsUnit,
    { id: 'w2', scenario_id: 's1', corrected_monthly_rent: 900, current_monthly_rent: 1400 } as unknown as WwsUnit,
  ];

  it('getWwsCorrectedAnnualRent telt corrected_monthly_rent × 12 op', () => {
    expect(getWwsCorrectedAnnualRent(wwsUnits)).toBe(2 * 900 * 12);
  });

  it('rent_source = wws_gecorrigeerd → correctedAnnualRent = WWS-jaarhuur', () => {
    const o = computeScenario(baseCtx({
      scenario: scen({
        purchase_price: 400_000, asking_price: 450_000,
        rent_source: 'wws_gecorrigeerd', rent_choice: 'huidig',
        current_monthly_rent: 1400, market_monthly_rent: 1600, target_bar: 6,
      }),
      wwsUnits,
    }));
    expect(o.wwsCorrectedAnnualRent).toBe(21_600);
    expect(o.correctedAnnualRent).toBe(21_600);
  });

  it('lagere WWS-huur (21.600) → lagere maxBid dan markthuur (24.000)', () => {
    const wws = computeScenario(baseCtx({
      scenario: scen({
        purchase_price: 400_000, asking_price: 450_000,
        rent_source: 'wws_gecorrigeerd', rent_choice: 'huidig',
        current_monthly_rent: 2000, target_bar: 6,
      }),
      wwsUnits,
    }));
    const markt = computeScenario(baseCtx({
      scenario: scen({
        purchase_price: 400_000, asking_price: 450_000,
        rent_source: 'handmatig', rent_choice: 'huidig',
        current_monthly_rent: 2000, target_bar: 6,
      }),
    }));
    expect(wws.correctedAnnualRent).toBe(21_600);
    expect(markt.correctedAnnualRent).toBe(24_000);
    expect(wws.maximumBid).toBeLessThan(markt.maximumBid);
  });
});

// ============================================================
// 9. EDGE CASE: ONTBREKEND VELD
// ============================================================
describe('Edge case — ontbrekende velden geven validatie/blocker', () => {
  it('verkoopcomponent zonder verkoopwaarde → blocker via aggregateStrategy + validatie', () => {
    const u = unit({ strategy: 'verkopen_leeg', sale_price_total: 0, sale_price_per_m2: 0 });
    const agg = aggregateStrategy([u]);
    expect(agg.warnings.some((w) => w.toLowerCase().includes('verkoopwaarde'))).toBe(true);
  });

  it('aanhoudcomponent zonder huur → waarschuwing', () => {
    const u = unit({ strategy: 'aanhouden', hold_valuation_method: 'BAR', hold_monthly_rent: 0, hold_annual_rent: 0, hold_bar: 6 });
    const agg = aggregateStrategy([u]);
    expect(agg.warnings.some((w) => w.toLowerCase().includes('huur'))).toBe(true);
  });

  it('mixed-use zonder per_component → validation warning', () => {
    const items = buildNogTeControleren({
      scenario: scen({ ovb_mode: 'auto' }),
      components: [],
      costs: [],
      wwsUnits: [],
      sellOffUnits: [],
      objectType: 'mixed_use',
      propertyType: 'mixed_use',
      hasWoz: true, hasEnergyLabel: true, hasBouwjaar: true,
    });
    expect(items.some((i) => i.message.toLowerCase().includes('mixed-use'))).toBe(true);
  });

  it('per_component zonder componentwaarde → blocker', () => {
    const items = buildNogTeControleren({
      scenario: scen({ ovb_mode: 'per_component' }),
      components: [comp({ id: 'x', allocated_component_value: null, surface_gbo: 0 })],
      costs: [], wwsUnits: [], sellOffUnits: [],
      objectType: 'mixed_use', propertyType: 'mixed_use',
      hasWoz: true, hasEnergyLabel: true, hasBouwjaar: true,
    });
    expect(items.some((i) => i.level === 'blocker')).toBe(true);
  });
});

// ============================================================
// 10. EDGE CASE: BEWUST €0 VS LEEG
// ============================================================
describe('fieldStatus — bewust €0 versus leeg/null', () => {
  it('null → leeg', () => {
    expect(fieldStatus(null)).toBe('leeg');
  });
  it('0 zonder marker → leeg (stille nul)', () => {
    expect(fieldStatus(0)).toBe('leeg');
  });
  it('0 met manualZeroMarker → bewust_nul', () => {
    expect(fieldStatus(0, { hasManualZeroMarker: true })).toBe('bewust_nul');
  });
  it('waarde > 0 met manualOverride → handmatig', () => {
    expect(fieldStatus(123, { manualOverride: true })).toBe('handmatig');
  });
  it('default flag → default', () => {
    expect(fieldStatus(5, { defaultUsed: true })).toBe('default');
  });
  it('readManualZeroFields leest array uit assumptions_source', () => {
    const set = readManualZeroFields({ manual_zero_fields: ['bouwkosten', 'financieringskosten'] });
    expect(set.has('bouwkosten')).toBe(true);
    expect(set.has('verkoopkosten')).toBe(false);
  });
  it('readManualZeroFields op null → lege set', () => {
    expect(readManualZeroFields(null).size).toBe(0);
  });
});

// ============================================================
// 11. RELIABILITY
// ============================================================
describe('computeReliability — niveau-bepaling', () => {
  const v = (level: ValidationItem['level'], message = 'x'): ValidationItem => ({ level, message });

  it('geen issues → hoog', () => {
    expect(computeReliability({ validation: [] }).level).toBe('hoog');
  });
  it('1 warning → middel', () => {
    expect(computeReliability({ validation: [v('warning')] }).level).toBe('middel');
  });
  it('3+ warnings → laag', () => {
    expect(computeReliability({ validation: [v('warning'), v('warning'), v('warning')] }).level).toBe('laag');
  });
  it('blocker → niet_betrouwbaar', () => {
    expect(computeReliability({ validation: [v('blocker')] }).level).toBe('niet_betrouwbaar');
  });
  it('manualWithoutSource → minstens laag', () => {
    const r = computeReliability({ validation: [], manualWithoutSource: true });
    expect(r.level).toBe('laag');
    expect(r.reasons.some((s) => s.toLowerCase().includes('handmatig'))).toBe(true);
  });
  it('dualSource → minstens laag + reden', () => {
    const r = computeReliability({ validation: [], dualSource: true });
    expect(r.level).toBe('laag');
    expect(r.reasons.some((s) => s.toLowerCase().includes('dubbele'))).toBe(true);
  });
});

// ============================================================
// 12. CASE REQUIREMENTS & DETECTIE
// ============================================================
describe('caseRequirements — elk casustype heeft verplichte velden', () => {
  it('alle casustypes hebben requiredFields + label', () => {
    const types: CaseType[] = Object.keys(CASE_REQUIREMENTS) as CaseType[];
    for (const t of types) {
      const r = getCaseRequirement(t);
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.requiredFields.length).toBeGreaterThan(0);
      expect(r.outputs.length).toBeGreaterThan(0);
    }
  });

  it('detectCaseType: verhuurde belegging bij enkelvoudig met huur', () => {
    const t = detectCaseType(
      scen({ current_monthly_rent: 1500 }), [], [], 'enkelvoudig',
    );
    expect(t).toBe('verhuurde_belegging');
  });

  it('detectCaseType: leegstand zonder huur en zonder strategie', () => {
    const t = detectCaseType(scen({}), [], [], 'enkelvoudig');
    expect(t).toBe('leegstand');
  });

  it('detectCaseType: woningen verkopen, winkels houden', () => {
    const units = [
      unit({ id: 'a', unit_type: 'woning', strategy: 'verkopen_leeg', sale_price_total: 200_000 }),
      unit({ id: 'b', unit_type: 'winkel', strategy: 'aanhouden', hold_monthly_rent: 2000, hold_bar: 6 }),
    ];
    const t = detectCaseType(scen({}), [], units, 'mixed_use');
    expect(t).toBe('woningen_verkopen_winkels_houden');
  });

  it('detectCaseType: transformatie_verkoop', () => {
    const t = detectCaseType(
      scen({ strategy_type: 'transformeren', sale_strategy: 'verkopen_geheel' }),
      [], [], 'enkelvoudig',
    );
    expect(t).toBe('transformatie_verkoop');
  });

  it('detectCaseType: bedrijfsunits', () => {
    const t = detectCaseType(scen({ strategy_type: 'bedrijfsunits_los' }), [], [], 'enkelvoudig');
    expect(t).toBe('bedrijfsunits');
  });
});
