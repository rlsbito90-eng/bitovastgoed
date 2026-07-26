// Componentstrategie per scenario.
// Pure rekenmodule voor sell_off_units met uitgebreide strategieën:
// verkopen, aanhouden, renoveren, splitsen, transformeren, handmatige waarde,
// later beslissen. Geen DB-calls. Geen UI-imports.

import type { SellOffUnit } from './types';

type ComponentStrategyDisposition = 'sale' | 'hold' | 'manual' | 'defer';

type ComponentStrategyMetadata = {
  label: string;
  disposition: ComponentStrategyDisposition;
  transformation: boolean;
};

/**
 * Centrale strategiebron voor labels én inhoudelijke classificatie.
 * Een nieuwe strategie wordt hier één keer geregistreerd; afgeleide exports
 * en alle validatiepaden volgen daarna automatisch.
 */
export const COMPONENT_STRATEGY_METADATA = {
  verkopen_leeg: {
    label: 'Verkopen (leeg)',
    disposition: 'sale',
    transformation: false,
  },
  verkopen_verhuurd: {
    label: 'Verkopen (verhuurd)',
    disposition: 'sale',
    transformation: false,
  },
  aanhouden: {
    label: 'Aanhouden',
    disposition: 'hold',
    transformation: false,
  },
  renoveren_verkopen: {
    label: 'Renoveren en verkopen',
    disposition: 'sale',
    transformation: false,
  },
  renoveren_aanhouden: {
    label: 'Renoveren en aanhouden',
    disposition: 'hold',
    transformation: false,
  },
  splitsen_verkopen: {
    label: 'Splitsen en verkopen',
    disposition: 'sale',
    transformation: false,
  },
  transformeren_verkopen: {
    label: 'Transformeren en verkopen',
    disposition: 'sale',
    transformation: true,
  },
  transformeren_aanhouden: {
    label: 'Transformeren en aanhouden',
    disposition: 'hold',
    transformation: true,
  },
  sloop_nieuwbouw_verkopen: {
    label: 'Slopen, nieuwbouwen en verkopen',
    disposition: 'sale',
    transformation: true,
  },
  sloop_nieuwbouw_aanhouden: {
    label: 'Slopen, nieuwbouwen en aanhouden',
    disposition: 'hold',
    transformation: true,
  },
  handmatige_waarde: {
    label: 'Handmatige waarde',
    disposition: 'manual',
    transformation: false,
  },
  later_beslissen: {
    label: 'Later beslissen',
    disposition: 'defer',
    transformation: false,
  },
} as const satisfies Record<string, ComponentStrategyMetadata>;

export type ComponentStrategyKey = keyof typeof COMPONENT_STRATEGY_METADATA;

const COMPONENT_STRATEGY_ENTRIES = Object.entries(COMPONENT_STRATEGY_METADATA) as Array<
  [ComponentStrategyKey, ComponentStrategyMetadata]
>;

export const STRATEGY_LABELS = Object.fromEntries(
  COMPONENT_STRATEGY_ENTRIES.map(([key, metadata]) => [key, metadata.label]),
) as Record<ComponentStrategyKey, string>;

export const SALE_STRATEGIES = COMPONENT_STRATEGY_ENTRIES
  .filter(([, metadata]) => metadata.disposition === 'sale')
  .map(([key]) => key);

export const HOLD_STRATEGIES = COMPONENT_STRATEGY_ENTRIES
  .filter(([, metadata]) => metadata.disposition === 'hold')
  .map(([key]) => key);

const COMPONENT_STRATEGY_KEYS = new Set<ComponentStrategyKey>(
  Object.keys(COMPONENT_STRATEGY_METADATA) as ComponentStrategyKey[],
);
const SALE_STRATEGY_KEYS = new Set<ComponentStrategyKey>(SALE_STRATEGIES);
const HOLD_STRATEGY_KEYS = new Set<ComponentStrategyKey>(HOLD_STRATEGIES);

export function isComponentStrategyKey(value: unknown): value is ComponentStrategyKey {
  return typeof value === 'string' && COMPONENT_STRATEGY_KEYS.has(value as ComponentStrategyKey);
}

export function isSaleStrategy(value: unknown): value is ComponentStrategyKey {
  return isComponentStrategyKey(value) && SALE_STRATEGY_KEYS.has(value);
}

export function isHoldStrategy(value: unknown): value is ComponentStrategyKey {
  return isComponentStrategyKey(value) && HOLD_STRATEGY_KEYS.has(value);
}

export function isTransformationStrategy(value: unknown): value is ComponentStrategyKey {
  return isComponentStrategyKey(value) && COMPONENT_STRATEGY_METADATA[value].transformation;
}

export type ComponentBreakdown = {
  grossSaleValue: number;
  saleCosts: number;
  legalCosts: number;
  renovationCosts: number;
  splittingCosts: number;
  transformationCosts: number;
  totalCosts: number;
  netSaleProceeds: number;
  holdValue: number;
};

export type ComponentResult = {
  unitId: string;
  label: string;
  type: string | null;
  strategy: ComponentStrategyKey | null;
  contribution: number;
  /** Ontwikkelkosten die bij de investering horen en niet in de opbrengst worden gesaldeerd. */
  extraInvestmentCosts: number;
  breakdown: ComponentBreakdown;
  warnings: string[];
};

export type StrategyTotals = {
  enabled: boolean;
  holdValue: number;
  netSaleProceeds: number;
  scenarioValue: number;
  /** Bruto eindwaarde voor residueel rekenen: bruto verkoop + terminale holdwaarde. */
  grossDevelopmentValue: number;
  /** Verkoop- en juridische kosten van verkoopcomponenten. */
  componentDispositionCosts: number;
  /** Renovatie-, splitsings-, transformatie- en sloop/nieuwbouwkosten. */
  componentDevelopmentCosts: number;
  extraInvestmentCosts: number;
  mix: string;
  warnings: string[];
  perUnit: ComponentResult[];
};

// Toegang tot uitgebreide kolommen die nog niet in de DB-types staan.
// Lees alles via deze helper zodat we niet overal `any` hoeven te casten.
function f(u: SellOffUnit): Record<string, unknown> {
  return u as unknown as Record<string, unknown>;
}
function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function computeComponentStrategy(u: SellOffUnit): ComponentResult {
  const r = f(u);
  const strategy = (r.strategy as ComponentStrategyKey | null) ?? null;
  const label = (r.unit_label as string | null) ?? (u as unknown as { unit_name?: string }).unit_name ?? 'Unit';
  const type = (r.unit_type as string | null) ?? null;

  const surface = num(r.surface_gbo) || num(r.surface_vvo) || num(r.surface_bvo);
  const saleSrc = (r.sale_price_source as string | null) ?? 'totaal';
  const salePerM2 = num(r.sale_price_per_m2);
  const saleTotal = num(r.sale_price_total);

  const grossSale = saleSrc === 'per_m2'
    ? Math.round(salePerM2 * surface)
    : saleTotal;

  // Verkoopkosten: pct → absoluut; anders absoluut bedrag.
  const salePct = num(r.sale_costs_pct);
  const saleCostAbs = num(r.sale_costs_amount);
  const saleCosts = saleCostAbs > 0
    ? saleCostAbs
    : Math.round((grossSale * salePct) / 100);
  const legalCosts = num(r.legal_costs);
  const renovationCosts = num(r.renovation_costs);
  const splittingCosts = num(r.splitting_costs);
  const transformationCosts = num(r.transformation_costs);

  // Aanhouden waardering
  const holdMonthly = num(r.hold_monthly_rent);
  const holdAnnual = num(r.hold_annual_rent) || holdMonthly * 12;
  const valMethod = (r.hold_valuation_method as string | null) ?? 'BAR';
  const holdBar = num(r.hold_bar);
  const holdNar = num(r.hold_nar);
  const holdFactor = num(r.hold_factor);
  const holdManual = num(r.hold_value_manual);

  let holdValueCalc = 0;
  if (strategy && (HOLD_STRATEGIES.includes(strategy) || strategy === 'handmatige_waarde')) {
    if (valMethod === 'handmatige_waarde' || strategy === 'handmatige_waarde') {
      holdValueCalc = holdManual;
    } else if (valMethod === 'BAR' && holdBar > 0) {
      holdValueCalc = Math.round(holdAnnual / (holdBar / 100));
    } else if (valMethod === 'NAR' && holdNar > 0) {
      // gebruik dezelfde annuele huur als basis (NOI niet beschikbaar per unit)
      holdValueCalc = Math.round(holdAnnual / (holdNar / 100));
    } else if (valMethod === 'factor' && holdFactor > 0) {
      holdValueCalc = Math.round(holdAnnual * holdFactor);
    }
  }

  const breakdown: ComponentBreakdown = {
    grossSaleValue: grossSale,
    saleCosts,
    legalCosts,
    renovationCosts,
    splittingCosts,
    transformationCosts,
    totalCosts: saleCosts + legalCosts + renovationCosts + splittingCosts + transformationCosts,
    netSaleProceeds: 0,
    holdValue: holdValueCalc,
  };

  const warnings: string[] = [];
  let contribution = 0;
  let extraInvestmentCosts = 0;

  switch (strategy) {
    case 'verkopen_leeg':
    case 'verkopen_verhuurd':
    case 'renoveren_verkopen':
    case 'splitsen_verkopen':
    case 'transformeren_verkopen':
    case 'sloop_nieuwbouw_verkopen': {
      // Netto verkoopopbrengst = opbrengst na verkoop-/juridische kosten.
      // Ontwikkelkosten blijven zichtbaar aan de investeringszijde.
      breakdown.netSaleProceeds = Math.max(0, grossSale - saleCosts - legalCosts);
      contribution = breakdown.netSaleProceeds;
      extraInvestmentCosts = renovationCosts + splittingCosts + transformationCosts;
      if (grossSale <= 0) warnings.push(`${label}: verkoopwaarde ontbreekt.`);
      if (saleCosts <= 0 && grossSale > 0) warnings.push(`${label}: verkoopkosten ontbreken.`);
      if (strategy === 'splitsen_verkopen' && splittingCosts <= 0) warnings.push(`${label}: splitsingskosten ontbreken.`);
      if (strategy === 'transformeren_verkopen' && transformationCosts <= 0) warnings.push(`${label}: transformatiekosten ontbreken.`);
      if (strategy === 'sloop_nieuwbouw_verkopen' && transformationCosts <= 0) warnings.push(`${label}: sloop- en nieuwbouwkosten ontbreken.`);
      break;
    }
    case 'aanhouden':
    case 'renoveren_aanhouden':
    case 'transformeren_aanhouden':
    case 'sloop_nieuwbouw_aanhouden': {
      contribution = holdValueCalc;
      // Kosten voor renoveren/transformeren tellen bovenop de investering
      // (hold-waarde is exclusief deze kosten).
      extraInvestmentCosts = renovationCosts + transformationCosts;
      if (holdAnnual <= 0 && valMethod !== 'handmatige_waarde') warnings.push(`${label}: huur ontbreekt voor aanhouden.`);
      if (valMethod === 'BAR' && holdBar <= 0) warnings.push(`${label}: BAR ontbreekt.`);
      if (valMethod === 'NAR' && holdNar <= 0) warnings.push(`${label}: NAR ontbreekt.`);
      if (valMethod === 'factor' && holdFactor <= 0) warnings.push(`${label}: factor ontbreekt.`);
      if (strategy === 'renoveren_aanhouden' && renovationCosts <= 0) warnings.push(`${label}: renovatiekosten ontbreken.`);
      if (strategy === 'transformeren_aanhouden' && transformationCosts <= 0) warnings.push(`${label}: transformatiekosten ontbreken.`);
      if (strategy === 'sloop_nieuwbouw_aanhouden' && transformationCosts <= 0) warnings.push(`${label}: sloop- en nieuwbouwkosten ontbreken.`);
      break;
    }
    case 'handmatige_waarde': {
      contribution = holdManual;
      if (holdManual <= 0) warnings.push(`${label}: handmatige waarde ontbreekt.`);
      if (!(r.notes as string | null)?.trim()) warnings.push(`${label}: handmatige waarde gebruikt — leg onderbouwing vast.`);
      break;
    }
    case 'later_beslissen': {
      contribution = 0;
      warnings.push(`${label}: telt niet mee in de scenario-uitkomst.`);
      break;
    }
    default: {
      contribution = 0;
      warnings.push(`${label}: strategie nog niet gekozen.`);
    }
  }

  return { unitId: u.id, label, type, strategy, contribution, extraInvestmentCosts, breakdown, warnings };
}

export function aggregateStrategy(units: SellOffUnit[]): StrategyTotals {
  if (!units || units.length === 0) {
    return {
      enabled: false,
      holdValue: 0,
      netSaleProceeds: 0,
      scenarioValue: 0,
      grossDevelopmentValue: 0,
      componentDispositionCosts: 0,
      componentDevelopmentCosts: 0,
      extraInvestmentCosts: 0,
      mix: '',
      warnings: [],
      perUnit: [],
    };
  }
  const perUnit = units.map(computeComponentStrategy);
  let holdValue = 0;
  let netSaleProceeds = 0;
  let grossDevelopmentValue = 0;
  let componentDispositionCosts = 0;
  let componentDevelopmentCosts = 0;
  let extraInvestmentCosts = 0;
  const warnings: string[] = [];
  const mixCount: Record<string, number> = {};
  for (const r of perUnit) {
    if (r.strategy && SALE_STRATEGIES.includes(r.strategy)) {
      netSaleProceeds += r.contribution;
      grossDevelopmentValue += r.breakdown.grossSaleValue;
      componentDispositionCosts += r.breakdown.saleCosts + r.breakdown.legalCosts;
      componentDevelopmentCosts += r.breakdown.renovationCosts
        + r.breakdown.splittingCosts
        + r.breakdown.transformationCosts;
    } else if (r.strategy && (HOLD_STRATEGIES.includes(r.strategy) || r.strategy === 'handmatige_waarde')) {
      holdValue += r.contribution;
      grossDevelopmentValue += r.breakdown.holdValue;
      if (HOLD_STRATEGIES.includes(r.strategy)) {
        componentDevelopmentCosts += r.breakdown.renovationCosts + r.breakdown.transformationCosts;
      }
    }
    extraInvestmentCosts += r.extraInvestmentCosts;
    warnings.push(...r.warnings);
    const key = r.strategy ?? 'onbekend';
    mixCount[key] = (mixCount[key] ?? 0) + 1;
  }
  const mix = Object.entries(mixCount)
    .map(([k, n]) => `${n}× ${STRATEGY_LABELS[k as ComponentStrategyKey] ?? k}`)
    .join(', ');
  return {
    enabled: true,
    holdValue,
    netSaleProceeds,
    scenarioValue: holdValue + netSaleProceeds,
    grossDevelopmentValue,
    componentDispositionCosts,
    componentDevelopmentCosts,
    extraInvestmentCosts,
    mix,
    warnings,
    perUnit,
  };
}

/** Default strategie op basis van componenttype voor "Importeer uit componenten". */
export function defaultStrategyForType(type: string | null | undefined): ComponentStrategyKey {
  switch ((type ?? '').toLowerCase()) {
    case 'woning':
    case 'appartement':
    case 'studio':
    case 'kamer':
      return 'verkopen_leeg';
    case 'winkel':
    case 'winkelruimte':
    case 'kantoor':
    case 'kantoorruimte':
    case 'bedrijfsruimte':
    case 'bedrijfsunit':
    case 'horeca':
      return 'aanhouden';
    case 'parkeerplaats':
    case 'garagebox':
    case 'berging':
    case 'kelder':
    case 'opslagruimte':
      return 'later_beslissen';
    default:
      return 'later_beslissen';
  }
}

/** Hybride preset: woningen verkopen leeg, commercieel aanhouden. */
export function hybridStrategyForType(type: string | null | undefined): ComponentStrategyKey {
  const t = (type ?? '').toLowerCase();
  if (['woning', 'appartement', 'studio', 'kamer'].includes(t)) return 'verkopen_leeg';
  if (['winkel', 'winkelruimte', 'kantoor', 'kantoorruimte', 'bedrijfsruimte', 'bedrijfsunit', 'horeca'].includes(t)) return 'aanhouden';
  return 'later_beslissen';
}
