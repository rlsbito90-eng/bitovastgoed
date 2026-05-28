// Golden fixtures voor Vastgoedrekenen.
//
// Elke fixture levert een minimaal complete ComputeContext zodat
// computeScenario(...) deterministisch dezelfde uitkomst geeft.
// Gebruikt losse cast-helpers om los te staan van Supabase row-types.
//
// LET OP: deze fixtures dienen voor regressiebewaking. Wijzigingen in
// rekenlogica vragen om expliciete update van expected-waarden hieronder.

import type { ComputeContext } from '@/lib/vastgoedrekenen/compute';
import type { Scenario, Component, ScenarioCost, WwsUnit, SellOffUnit } from '@/lib/vastgoedrekenen/types';

type AnyRec = Record<string, unknown>;

function scen(overrides: AnyRec): Scenario {
  return {
    id: 's1',
    calculation_id: 'c1',
    scenario_name: 'Test',
    purchase_price: 0,
    asking_price: 0,
    notary_costs: 1500,
    broker_costs: 0,
    due_diligence_costs: 1500,
    safety_margin: 0,
    financing_costs: 0,
    transfer_tax_amount: 0,
    transfer_tax_classification: null,
    ovb_mode: 'auto',
    target_bar: 6,
    rent_choice: 'huidig',
    rent_source: 'handmatig',
    current_monthly_rent: 0,
    market_monthly_rent: 0,
    manual_corrected_monthly_rent: 0,
    vacancy_percentage: 5,
    operating_cost_percentage: 5,
    maintenance_reserve_percentage: 5,
    management_cost_percentage: 5,
    assumption_profile: 'normaal',
    assumptions_manual: false,
    assumptions_source: null,
    cost_structure: 'bruto',
    incentive_reserve: 0,
    mjop_present: 'onbekend',
    contract_checked: false,
    service_costs_checked: false,
    strategy_type: 'aanhouden',
    sale_strategy: 'geen_verkoop',
    bid_basis: 'huur',
    sale_price_total: 0,
    sale_price_per_m2: 0,
    sale_sellable_m2: 0,
    sale_price_per_unit: 0,
    sale_units_count: 0,
    sale_costs_percentage: 2,
    sale_other_costs: 0,
    sale_exit_value_manual: 0,
    sale_target_margin_amount: 0,
    sale_target_margin_percentage: 0,
    sale_target_roi_percentage: 0,
    sale_target_exit_value: 0,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  } as unknown as Scenario;
}

function comp(overrides: AnyRec): Component {
  return {
    id: 'k1',
    scenario_id: 's1',
    component_name: 'Component',
    component_type: 'woning',
    surface_gbo: 80,
    surface_vvo: 0,
    surface_bvo: 0,
    current_monthly_rent: 0,
    current_annual_rent: 0,
    market_monthly_rent: 0,
    has_contract: false,
    allocated_component_value: null,
    transfer_tax_classification: null,
    transfer_tax_manual_override: null,
    woz_value: null,
    energy_label: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  } as unknown as Component;
}

function cost(overrides: AnyRec): ScenarioCost {
  return {
    id: 'k-c1',
    scenario_id: 's1',
    label: 'Bouwkosten',
    amount: 0,
    contingency_percentage: 10,
    reliability_status: 'middel',
    vat_treatment: 'geen',
    vat_percentage: 0,
    vat_amount_manual: 0,
    vat_applicable: false,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  } as unknown as ScenarioCost;
}

function unit(overrides: AnyRec): SellOffUnit {
  return {
    id: 'u1',
    scenario_id: 's1',
    component_id: null,
    unit_label: 'Unit',
    unit_type: 'woning',
    strategy: 'verkopen_leeg',
    sale_price_source: 'totaal',
    sale_price_total: 0,
    sale_price_per_m2: 0,
    sale_costs_percentage: 2,
    hold_valuation_method: 'BAR',
    hold_monthly_rent: 0,
    hold_annual_rent: 0,
    hold_bar: 0,
    hold_nar: 0,
    hold_factor: 0,
    hold_value_manual: 0,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  } as unknown as SellOffUnit;
}

export interface GoldenFixture {
  name: string;
  ctx: ComputeContext;
  /** Zachte regressie-controles: kijken of kerncijfers binnen verwachte buckets vallen. */
  expects: {
    /** Verwacht totalInvestment > 0. */
    investmentPositive?: boolean;
    /** Verwacht maximumBid in een minimale en maximale grens. */
    maxBidMin?: number;
    maxBidMax?: number;
    /** Verwachte bidBasisUsed (huur/verkoop). */
    bidBasis?: 'huur' | 'verkoop';
  };
}

const noTax = null;

export const GOLDEN_FIXTURES: GoldenFixture[] = [
  // 1. Simpele verhuurde belegging
  {
    name: 'Verhuurde belegging — woning',
    ctx: {
      scenario: scen({ purchase_price: 250_000, asking_price: 275_000, current_monthly_rent: 1500, target_bar: 6 }),
      components: [],
      costs: [],
      wwsUnits: [],
      strategyUnits: [],
      taxSettings: noTax,
      objectType: 'enkelvoudig',
      objectArea: 80,
      propertyType: 'residentieel',
    },
    expects: { investmentPositive: true, bidBasis: 'huur', maxBidMin: 100_000, maxBidMax: 400_000 },
  },
  // 2. Retailbelegging
  {
    name: 'Retailbelegging — winkel',
    ctx: {
      scenario: scen({ purchase_price: 600_000, asking_price: 650_000, current_monthly_rent: 4000, target_bar: 7, ovb_mode: 'commercieel' }),
      components: [comp({ component_type: 'winkel', surface_gbo: 120, current_monthly_rent: 4000 })],
      costs: [],
      wwsUnits: [],
      strategyUnits: [],
      taxSettings: noTax,
      objectType: 'enkelvoudig',
      objectArea: 120,
      propertyType: 'retail',
    },
    expects: { investmentPositive: true, bidBasis: 'huur', maxBidMin: 200_000, maxBidMax: 900_000 },
  },
  // 3. Mixed-use woon-/winkelpand
  {
    name: 'Mixed-use woon-/winkelpand',
    ctx: {
      scenario: scen({ purchase_price: 800_000, asking_price: 850_000, rent_source: 'componenten', target_bar: 6.5, ovb_mode: 'per_component' }),
      components: [
        comp({ id: 'k1', component_type: 'winkel', surface_gbo: 100, current_monthly_rent: 3000, allocated_component_value: 400_000 }),
        comp({ id: 'k2', component_type: 'woning', surface_gbo: 80, current_monthly_rent: 1300, allocated_component_value: 250_000 }),
        comp({ id: 'k3', component_type: 'woning', surface_gbo: 80, current_monthly_rent: 1300, allocated_component_value: 250_000 }),
      ],
      costs: [],
      wwsUnits: [],
      strategyUnits: [],
      taxSettings: noTax,
      objectType: 'mixed_use',
      objectArea: 260,
      propertyType: 'mixed_use',
    },
    expects: { investmentPositive: true, bidBasis: 'huur' },
  },
  // 4. Hinthamerstraat — woningen verkopen, winkels houden
  {
    name: 'Hinthamerstraat — woningen verkopen, winkels houden',
    ctx: {
      scenario: scen({
        purchase_price: 1_800_000, asking_price: 1_950_000, target_bar: 6.5,
        ovb_mode: 'per_component', rent_source: 'componenten',
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
        unit({ id: 'u3', component_id: 'won1', unit_type: 'woning', strategy: 'verkopen_leeg', sale_price_total: 235_000 }),
        unit({ id: 'u4', component_id: 'won2', unit_type: 'woning', strategy: 'verkopen_leeg', sale_price_total: 235_000 }),
        unit({ id: 'u5', component_id: 'won3', unit_type: 'woning', strategy: 'verkopen_leeg', sale_price_total: 235_000 }),
        unit({ id: 'u6', component_id: 'won4', unit_type: 'woning', strategy: 'verkopen_leeg', sale_price_total: 235_000 }),
        unit({ id: 'u7', component_id: 'won5', unit_type: 'woning', strategy: 'verkopen_leeg', sale_price_total: 235_000 }),
        unit({ id: 'u8', component_id: 'won6', unit_type: 'woning', strategy: 'verkopen_leeg', sale_price_total: 235_000 }),
      ],
      taxSettings: noTax,
      objectType: 'mixed_use',
      objectArea: 570,
      objectTitle: 'Hinthamerstraat',
      objectAddress: 'Hinthamerstraat, Den Bosch',
      propertyType: 'mixed_use',
    } as unknown as ComputeContext,
    expects: { investmentPositive: true },
  },
  // 5. Alles verkopen per unit
  {
    name: 'Alles verkopen per unit',
    ctx: {
      scenario: scen({
        purchase_price: 900_000, asking_price: 950_000,
        strategy_type: 'verkoop_per_unit', sale_strategy: 'verkoop_per_unit',
        bid_basis: 'verkoop', sale_target_roi_percentage: 12, sale_costs_percentage: 2,
      }),
      components: [],
      costs: [cost({ amount: 100_000 })],
      wwsUnits: [],
      strategyUnits: [
        unit({ id: 'u1', unit_type: 'woning', strategy: 'verkopen_leeg', sale_price_total: 300_000 }),
        unit({ id: 'u2', unit_type: 'woning', strategy: 'verkopen_leeg', sale_price_total: 300_000 }),
        unit({ id: 'u3', unit_type: 'woning', strategy: 'verkopen_leeg', sale_price_total: 300_000 }),
        unit({ id: 'u4', unit_type: 'woning', strategy: 'verkopen_leeg', sale_price_total: 300_000 }),
      ],
      taxSettings: noTax,
      objectType: 'enkelvoudig',
      objectArea: 320,
      propertyType: 'residentieel',
    },
    expects: { investmentPositive: true },
  },
  // 6. Renovatie + verkoop
  {
    name: 'Renovatie en verkoop',
    ctx: {
      scenario: scen({
        purchase_price: 350_000, asking_price: 380_000,
        strategy_type: 'renoveren', sale_strategy: 'verkopen_geheel',
        bid_basis: 'verkoop', sale_price_total: 600_000, sale_costs_percentage: 2,
        sale_target_margin_percentage: 15,
      }),
      components: [],
      costs: [cost({ amount: 120_000, contingency_percentage: 15, vat_treatment: 'pct_21', vat_percentage: 21 })],
      wwsUnits: [],
      strategyUnits: [],
      taxSettings: noTax,
      objectType: 'enkelvoudig',
      objectArea: 100,
      propertyType: 'residentieel',
    },
    expects: { investmentPositive: true, bidBasis: 'verkoop' },
  },
  // 7. Transformatie naar wonen
  {
    name: 'Transformatie naar wonen',
    ctx: {
      scenario: scen({
        purchase_price: 700_000, asking_price: 750_000,
        strategy_type: 'transformeren', sale_strategy: 'verkopen_geheel',
        bid_basis: 'verkoop', sale_price_total: 1_400_000, sale_costs_percentage: 2,
        sale_target_roi_percentage: 18,
      }),
      components: [],
      costs: [
        cost({ id: 'c1', label: 'Bouwkosten', amount: 350_000, contingency_percentage: 15, vat_treatment: 'pct_21', vat_percentage: 21 }),
        cost({ id: 'c2', label: 'Vergunningen', amount: 25_000, contingency_percentage: 10, vat_treatment: 'pct_21', vat_percentage: 21 }),
      ],
      wwsUnits: [],
      strategyUnits: [],
      taxSettings: noTax,
      objectType: 'enkelvoudig',
      objectArea: 250,
      propertyType: 'residentieel',
    },
    expects: { investmentPositive: true, bidBasis: 'verkoop' },
  },
  // 8. Bedrijfsunits
  {
    name: 'Bedrijfsunits',
    ctx: {
      scenario: scen({
        purchase_price: 1_200_000, asking_price: 1_300_000,
        strategy_type: 'bedrijfsunits_los', target_bar: 7.5, rent_source: 'componenten',
      }),
      components: [
        comp({ id: 'b1', component_type: 'bedrijfsruimte', surface_gbo: 200, current_monthly_rent: 1800 }),
        comp({ id: 'b2', component_type: 'bedrijfsruimte', surface_gbo: 200, current_monthly_rent: 1800 }),
        comp({ id: 'b3', component_type: 'bedrijfsruimte', surface_gbo: 200, current_monthly_rent: 1800 }),
      ],
      costs: [],
      wwsUnits: [],
      strategyUnits: [],
      taxSettings: noTax,
      objectType: 'enkelvoudig',
      objectArea: 600,
      propertyType: 'bedrijfsruimte',
    },
    expects: { investmentPositive: true, bidBasis: 'huur' },
  },
];
