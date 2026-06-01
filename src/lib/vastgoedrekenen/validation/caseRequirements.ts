// Casustype-matrix voor Vastgoedrekenen.
//
// Definieert per casustype welke velden verplicht/optioneel zijn, welke
// defaults gelden en welke outputs relevant zijn. Centraal bestand zodat
// validation.ts, runAudit.ts en UI hetzelfde verwachten.
//
// Geen rekenlogica. Wijzigingen hier breken geen berekeningen.

import type { Scenario, Component, SellOffUnit } from '../types';

export type CaseType =
  | 'verhuurde_belegging'
  | 'leegstand'
  | 'mixed_use'
  | 'uitponden'
  | 'woningen_verkopen_winkels_houden'
  | 'alles_houden'
  | 'alles_verkopen'
  | 'renovatie_verkoop'
  | 'renovatie_verhuur'
  | 'transformatie_verkoop'
  | 'transformatie_verhuur'
  | 'bedrijfsunits'
  | 'woon_winkel'
  | 'onbekend';

export interface CaseRequirement {
  type: CaseType;
  label: string;
  /** Velden waarvan ontbreken een blokkerend issue is. */
  requiredFields: string[];
  /** Velden die de uitkomst betrouwbaarder maken maar niet blokkeren. */
  optionalFields: string[];
  /** Velden waar het systeem een defaultaanname doet als ze leeg zijn. */
  defaults: string[];
  /** Belangrijkste outputs voor dit casustype. */
  outputs: string[];
  /** Korte vastgoedkundige toelichting. */
  notes: string;
}

const BASE_REQUIRED = ['scenario.purchase_price', 'scenario.asking_price', 'scenario.strategy_type'];
const BASE_OPTIONAL = ['object.energy_label', 'object.woz', 'object.bouwjaar', 'object.area'];
const BASE_OUTPUTS = ['maximumBid', 'totalInvestment', 'differenceWithAskingPrice'];

export const CASE_REQUIREMENTS: Record<CaseType, CaseRequirement> = {
  verhuurde_belegging: {
    type: 'verhuurde_belegging',
    label: 'Verhuurde belegging',
    requiredFields: [...BASE_REQUIRED, 'scenario.current_monthly_rent_or_components', 'scenario.target_bar'],
    optionalFields: [...BASE_OPTIONAL, 'scenario.market_monthly_rent', 'scenario.mjop_present'],
    defaults: ['scenario.vacancy_percentage', 'scenario.operating_cost_percentage', 'scenario.management_cost_percentage', 'scenario.maintenance_reserve_percentage'],
    outputs: [...BASE_OUTPUTS, 'noi', 'barTotalInvestment'],
    notes: 'Huur is leidend. Controleer huurcontract, indexatie en exploitatielasten.',
  },
  leegstand: {
    type: 'leegstand',
    label: 'Leegstaand object',
    requiredFields: [...BASE_REQUIRED, 'scenario.market_monthly_rent_or_sale_value'],
    optionalFields: [...BASE_OPTIONAL],
    defaults: ['scenario.vacancy_percentage'],
    outputs: BASE_OUTPUTS,
    notes: 'Geen lopende huur; bepaal eerst exit-strategie (verhuur of verkoop).',
  },
  mixed_use: {
    type: 'mixed_use',
    label: 'Mixed-use',
    requiredFields: [...BASE_REQUIRED, 'components', 'scenario.ovb_mode=per_component'],
    optionalFields: [...BASE_OPTIONAL, 'components.allocated_component_value'],
    defaults: ['scenario.vacancy_percentage'],
    outputs: [...BASE_OUTPUTS, 'totalTransferTax'],
    notes: 'OVB en exploitatie per componenttype scheiden. Zonder componenten geen correcte OVB-toerekening.',
  },
  uitponden: {
    type: 'uitponden',
    label: 'Uitponden / verkoop per unit',
    requiredFields: [...BASE_REQUIRED, 'strategyUnits.sale_price', 'scenario.sale_costs_percentage'],
    optionalFields: [...BASE_OPTIONAL, 'scenario.financing_costs'],
    defaults: ['scenario.sale_costs_percentage'],
    outputs: [...BASE_OUTPUTS, 'grossSaleProceeds', 'netSaleProceeds', 'roi'],
    notes: 'Verkoopwaarde per unit moet onderbouwd zijn (referenties / makelaars-opinie).',
  },
  woningen_verkopen_winkels_houden: {
    type: 'woningen_verkopen_winkels_houden',
    label: 'Woningen verkopen, commercieel houden',
    requiredFields: [...BASE_REQUIRED, 'strategyUnits.sale_price_woningen', 'strategyUnits.hold_rent_commercieel', 'strategyUnits.hold_bar_commercieel'],
    optionalFields: [...BASE_OPTIONAL, 'costs.bouwkosten'],
    defaults: ['scenario.sale_costs_percentage'],
    outputs: [...BASE_OUTPUTS, 'scenarioValue', 'holdValue', 'saleNetProceedsUnits'],
    notes: 'Dubbele bron: combineer geen scenario-verkoopwaarde met componentstrategie.',
  },
  alles_houden: {
    type: 'alles_houden',
    label: 'Alles houden',
    requiredFields: [...BASE_REQUIRED, 'rent_total', 'scenario.target_bar'],
    optionalFields: [...BASE_OPTIONAL],
    defaults: ['scenario.vacancy_percentage', 'scenario.operating_cost_percentage'],
    outputs: [...BASE_OUTPUTS, 'noi'],
    notes: 'Pure exploitatiecase — BAR/NAR is doorslaggevend.',
  },
  alles_verkopen: {
    type: 'alles_verkopen',
    label: 'Alles verkopen',
    requiredFields: [...BASE_REQUIRED, 'sale_proceeds', 'scenario.sale_costs_percentage'],
    optionalFields: [...BASE_OPTIONAL, 'costs.bouwkosten'],
    defaults: ['scenario.sale_costs_percentage'],
    outputs: [...BASE_OUTPUTS, 'netSaleProceeds', 'roi'],
    notes: 'Exit-tak bepaalt max bod. Controleer verkoopkosten en financieringskosten.',
  },
  renovatie_verkoop: {
    type: 'renovatie_verkoop',
    label: 'Renovatie + verkoop',
    requiredFields: [...BASE_REQUIRED, 'costs.bouwkosten', 'sale_proceeds'],
    optionalFields: [...BASE_OPTIONAL, 'costs.btw_treatment'],
    defaults: ['costs.contingency_percentage'],
    outputs: [...BASE_OUTPUTS, 'totalCosts', 'netSaleProceeds', 'roi'],
    notes: 'Bouwkosten leeg ≠ bouwkosten 0. Beoordeel btw-behandeling expliciet.',
  },
  renovatie_verhuur: {
    type: 'renovatie_verhuur',
    label: 'Renovatie + verhuur',
    requiredFields: [...BASE_REQUIRED, 'costs.bouwkosten', 'scenario.market_monthly_rent', 'scenario.target_bar'],
    optionalFields: [...BASE_OPTIONAL],
    defaults: ['scenario.vacancy_percentage'],
    outputs: [...BASE_OUTPUTS, 'totalCosts', 'noi'],
    notes: 'Markthuur na renovatie moet onderbouwd zijn (WWS of referenties).',
  },
  transformatie_verkoop: {
    type: 'transformatie_verkoop',
    label: 'Transformatie + verkoop',
    requiredFields: [...BASE_REQUIRED, 'costs.bouwkosten', 'sale_proceeds', 'costs.vergunningen'],
    optionalFields: [...BASE_OPTIONAL, 'costs.btw_treatment', 'costs.fasering'],
    defaults: ['costs.contingency_percentage'],
    outputs: [...BASE_OUTPUTS, 'totalCosts', 'netSaleProceeds'],
    notes: 'Transformatie kent hoog uitvoeringsrisico — overweeg zwaar profiel en hogere onvoorzien.',
  },
  transformatie_verhuur: {
    type: 'transformatie_verhuur',
    label: 'Transformatie + verhuur',
    requiredFields: [...BASE_REQUIRED, 'costs.bouwkosten', 'scenario.market_monthly_rent'],
    optionalFields: [...BASE_OPTIONAL, 'costs.btw_treatment'],
    defaults: ['costs.contingency_percentage'],
    outputs: [...BASE_OUTPUTS, 'totalCosts', 'noi'],
    notes: 'Combineert bouwrisico met huurrisico — gebruik conservatieve aannames.',
  },
  bedrijfsunits: {
    type: 'bedrijfsunits',
    label: 'Bedrijfsunits',
    requiredFields: [...BASE_REQUIRED, 'strategyUnits.sale_or_hold'],
    optionalFields: [...BASE_OPTIONAL],
    defaults: [],
    outputs: BASE_OUTPUTS,
    notes: 'Per unit kiezen verkoop of huur. Let op btw-positie van koper/huurder.',
  },
  woon_winkel: {
    type: 'woon_winkel',
    label: 'Woon-/winkelpand',
    requiredFields: [...BASE_REQUIRED, 'components', 'scenario.ovb_mode=per_component'],
    optionalFields: [...BASE_OPTIONAL],
    defaults: [],
    outputs: [...BASE_OUTPUTS, 'totalTransferTax'],
    notes: 'Splits OVB tussen wonen (2%) en commercieel (10,4%) via component-toerekening.',
  },
  onbekend: {
    type: 'onbekend',
    label: 'Onbekend casustype',
    requiredFields: BASE_REQUIRED,
    optionalFields: BASE_OPTIONAL,
    defaults: [],
    outputs: BASE_OUTPUTS,
    notes: 'Kies een strategie zodat het juiste vereistenpakket geldt.',
  },
};

const SALE_STRATS = new Set(['verkopen_leeg', 'verkopen_verhuurd', 'renoveren_verkopen', 'splitsen_verkopen', 'transformeren_verkopen']);
const HOLD_STRATS = new Set(['aanhouden', 'renoveren_aanhouden', 'transformeren_aanhouden']);

const COMMERCIAL_TYPES = new Set(['winkel', 'winkelruimte', 'kantoor', 'kantoorruimte', 'bedrijfsruimte', 'horeca']);
const RESIDENTIAL_TYPES = new Set(['woning', 'appartement', 'studio', 'kamer']);

/** Bepaalt het casustype op basis van scenario- en componentdata. */
export function detectCaseType(
  scenario: Scenario,
  components: Component[],
  strategyUnits: SellOffUnit[],
  objectType: 'enkelvoudig' | 'mixed_use'
): CaseType {
  const rec = scenario as unknown as Record<string, unknown>;
  const strat = String(scenario.strategy_type ?? '');
  const saleStrat = String(rec.sale_strategy ?? '');

  const woon = components.filter((c) => RESIDENTIAL_TYPES.has(String(c.component_type ?? '').toLowerCase()));
  const comm = components.filter((c) => COMMERCIAL_TYPES.has(String(c.component_type ?? '').toLowerCase()));
  const isMixed = objectType === 'mixed_use' || (woon.length > 0 && comm.length > 0);

  // Strategie-mix analyse
  if (strategyUnits.length > 0) {
    const sells = strategyUnits.filter((u) => SALE_STRATS.has(String((u as unknown as Record<string, unknown>).strategy ?? '')));
    const holds = strategyUnits.filter((u) => HOLD_STRATS.has(String((u as unknown as Record<string, unknown>).strategy ?? '')));
    if (sells.length > 0 && holds.length === 0) return 'uitponden';
    if (sells.length > 0 && holds.length > 0) {
      const sellsWoning = sells.every((u) => RESIDENTIAL_TYPES.has(String((u as unknown as Record<string, unknown>).unit_type ?? '').toLowerCase()));
      const holdsComm = holds.every((u) => COMMERCIAL_TYPES.has(String((u as unknown as Record<string, unknown>).unit_type ?? '').toLowerCase()));
      if (sellsWoning && holdsComm) return 'woningen_verkopen_winkels_houden';
    }
    if (holds.length > 0 && sells.length === 0) return 'alles_houden';
  }

  // Strategie-string driven
  if (['transformeren'].includes(strat)) {
    return saleStrat && saleStrat !== 'geen_verkoop' ? 'transformatie_verkoop' : 'transformatie_verhuur';
  }
  if (['renoveren', 'buy_fix_sell', 'buy_fix_rent'].includes(strat)) {
    return saleStrat && saleStrat !== 'geen_verkoop' ? 'renovatie_verkoop' : 'renovatie_verhuur';
  }
  if (['uitponden', 'splitsen', 'verkoop_per_unit', 'buy_split_sell'].includes(strat)) return 'uitponden';
  if (['verkopen_geheel', 'buy_transform_sell'].includes(strat)) return 'alles_verkopen';
  if (['bedrijfsunits_los'].includes(strat)) return 'bedrijfsunits';

  if (isMixed) {
    if (woon.length > 0 && comm.length === 1 && (comm[0].component_type ?? '').toLowerCase().includes('winkel')) return 'woon_winkel';
    return 'mixed_use';
  }

  const hasRent = Number(rec.current_monthly_rent ?? 0) > 0 || components.some((c) => Number(c.current_monthly_rent ?? 0) > 0);
  if (hasRent) return 'verhuurde_belegging';
  return 'leegstand';
}

export function getCaseRequirement(type: CaseType): CaseRequirement {
  return CASE_REQUIREMENTS[type];
}
