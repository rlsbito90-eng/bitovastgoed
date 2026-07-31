import type { SellOffUnit } from './types';
import {
  aggregateStrategy,
  HOLD_STRATEGIES,
  isComponentStrategyKey,
  SALE_STRATEGIES,
  type ComponentResult,
  type ComponentStrategyKey,
} from './componentStrategy';
import {
  analyzeComponentAllocationTiming,
  MAX_COMPONENT_TIMING_MONTH,
  type ResolvedComponentAllocationTiming,
} from './componentAllocationTiming';
import { resolveComponentAllocationWeighting } from './componentAllocationWeighting';

const DEVELOPMENT_STRATEGIES = new Set<ComponentStrategyKey>([
  'renoveren_verkopen',
  'renoveren_aanhouden',
  'splitsen_verkopen',
  'transformeren_verkopen',
  'transformeren_aanhouden',
  'sloop_nieuwbouw_verkopen',
  'sloop_nieuwbouw_aanhouden',
]);

export type ComponentCashflowMonth = {
  month: number;
  rentalIncome: number;
  grossSaleProceeds: number;
  terminalValue: number;
  developmentCosts: number;
  dispositionCosts: number;
  netCashflow: number;
  cumulativeCashflow: number;
};

export type ComponentCashflowPeriod = {
  periodIndex: number;
  label: string;
  fromMonth: number;
  toMonth: number;
  rentalIncome: number;
  grossSaleProceeds: number;
  terminalValue: number;
  developmentCosts: number;
  dispositionCosts: number;
  netCashflow: number;
};

export type ComponentCashflowTotals = {
  rentalIncome: number;
  grossSaleProceeds: number;
  terminalValue: number;
  developmentCosts: number;
  dispositionCosts: number;
  netCashflow: number;
};

export type ComponentPeriodicCashflowResult = {
  readyForPeriodicCashflow: boolean;
  readyForDiscounting: boolean;
  horizonMonths: number | null;
  monthly: ComponentCashflowMonth[];
  periods: ComponentCashflowPeriod[];
  totals: ComponentCashflowTotals;
  blockers: string[];
  discountingBlockers: string[];
  warnings: string[];
};

type MutableCashflowMonth = Omit<ComponentCashflowMonth, 'netCashflow' | 'cumulativeCashflow'>;

type UnitPlan = {
  unit: SellOffUnit;
  strategy: ComponentStrategyKey;
  timing: ResolvedComponentAllocationTiming;
  result: ComponentResult;
  effectiveWeight: number;
};

function raw(unit: SellOffUnit): Record<string, unknown> {
  return unit as unknown as Record<string, unknown>;
}

function finiteNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function labelFor(unit: SellOffUnit): string {
  const record = raw(unit);
  return (record.unit_label as string | null)?.trim()
    || (unit as unknown as { unit_name?: string }).unit_name?.trim()
    || 'Unit';
}

function validHorizon(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_COMPONENT_TIMING_MONTH) return null;
  return parsed;
}

function emptyTotals(): ComponentCashflowTotals {
  return {
    rentalIncome: 0,
    grossSaleProceeds: 0,
    terminalValue: 0,
    developmentCosts: 0,
    dispositionCosts: 0,
    netCashflow: 0,
  };
}

function emptyResult(
  horizonMonths: number | null,
  blockers: string[],
  discountingBlockers: string[],
  warnings: string[],
): ComponentPeriodicCashflowResult {
  return {
    readyForPeriodicCashflow: false,
    readyForDiscounting: false,
    horizonMonths,
    monthly: [],
    periods: [],
    totals: emptyTotals(),
    blockers,
    discountingBlockers,
    warnings,
  };
}

function addUnique(target: string[], message: string): void {
  if (!target.includes(message)) target.push(message);
}

function spreadIntegerAmount(total: number, startMonth: number, endMonth: number): number[] {
  const count = endMonth - startMonth + 1;
  if (total <= 0 || count <= 0) return [];

  const base = Math.floor(total / count);
  let remainder = total - base * count;
  return Array.from({ length: count }, () => {
    const amount = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return amount;
  });
}

function periodForMonth(month: number): { periodIndex: number; label: string; fromMonth: number; toMonth: number } {
  if (month === 0) {
    return { periodIndex: 0, label: 'Maand 0', fromMonth: 0, toMonth: 0 };
  }
  const periodIndex = Math.ceil(month / 12);
  const fromMonth = (periodIndex - 1) * 12 + 1;
  const toMonth = periodIndex * 12;
  return {
    periodIndex,
    label: `Jaar ${periodIndex} · maand ${fromMonth}–${toMonth}`,
    fromMonth,
    toMonth,
  };
}

function aggregatePeriods(monthly: ComponentCashflowMonth[]): ComponentCashflowPeriod[] {
  const periods = new Map<number, ComponentCashflowPeriod>();

  for (const row of monthly) {
    const period = periodForMonth(row.month);
    const current = periods.get(period.periodIndex) ?? {
      ...period,
      rentalIncome: 0,
      grossSaleProceeds: 0,
      terminalValue: 0,
      developmentCosts: 0,
      dispositionCosts: 0,
      netCashflow: 0,
    };
    current.rentalIncome += row.rentalIncome;
    current.grossSaleProceeds += row.grossSaleProceeds;
    current.terminalValue += row.terminalValue;
    current.developmentCosts += row.developmentCosts;
    current.dispositionCosts += row.dispositionCosts;
    current.netCashflow += row.netCashflow;
    periods.set(period.periodIndex, current);
  }

  return Array.from(periods.values())
    .filter((period) => (
      period.rentalIncome
      + period.grossSaleProceeds
      + period.terminalValue
      + period.developmentCosts
      + period.dispositionCosts
    ) > 0)
    .sort((left, right) => left.periodIndex - right.periodIndex);
}

function buildPlans(units: SellOffUnit[]): {
  plans: UnitPlan[];
  blockers: string[];
  discountingBlockers: string[];
  warnings: string[];
} {
  const blockers: string[] = [];
  const discountingBlockers: string[] = [];
  const warnings: string[] = [];
  const allocation = resolveComponentAllocationWeighting(units);
  const timing = analyzeComponentAllocationTiming(
    units as unknown as Parameters<typeof analyzeComponentAllocationTiming>[0],
  );

  const totals = aggregateStrategy(units);
  const timingById = new Map(timing.units.map((unit) => [unit.unitId, unit]));
  const resultById = new Map(totals.perUnit.map((result) => [result.unitId, result]));

  for (const group of allocation.groups) {
    if (group.status === 'complete') continue;
    const label = group.labels[0] ?? group.componentKey;
    addUnique(
      blockers,
      `${label}: allocatiegroep moet exact 100% zijn voordat een periodieke kasstroom wordt opgebouwd.`,
    );
  }

  const plans: UnitPlan[] = [];
  for (const unit of units) {
    const record = raw(unit);
    const label = labelFor(unit);
    const strategyValue = record.strategy;
    if (!isComponentStrategyKey(strategyValue)) {
      addUnique(blockers, `${label}: kies eerst een geldige componentstrategie.`);
      continue;
    }
    if (strategyValue === 'later_beslissen') {
      addUnique(blockers, `${label}: 'Later beslissen' heeft nog geen modelleerbare kasstroom.`);
      continue;
    }
    if (strategyValue === 'handmatige_waarde') {
      addUnique(
        blockers,
        `${label}: een handmatige waarde heeft nog geen expliciete kasstroomtiming en wordt daarom niet ingepland.`,
      );
      continue;
    }

    const resolvedTiming = timingById.get(unit.id);
    const result = resultById.get(unit.id);
    if (!resolvedTiming || !result) {
      addUnique(blockers, `${label}: kasstroomgegevens konden niet worden afgeleid.`);
      continue;
    }

    const effectiveWeight = allocation.byUnitId.get(unit.id)?.effectiveWeight ?? 1;
    warnings.push(...result.warnings);
    plans.push({ unit, strategy: strategyValue, timing: resolvedTiming, result, effectiveWeight });
  }

  return { plans, blockers, discountingBlockers, warnings };
}

export function buildComponentPeriodicCashflow(
  units: SellOffUnit[],
  timeHorizonMonths: number | null | undefined,
): ComponentPeriodicCashflowResult {
  const horizonMonths = validHorizon(timeHorizonMonths);
  const { plans, blockers, discountingBlockers, warnings } = buildPlans(units);

  if (units.length === 0) addUnique(blockers, 'Voeg eerst componentstrategieregels toe.');
  if (horizonMonths === null) {
    addUnique(
      blockers,
      `Stel een Quickscan-horizon in tussen 1 en ${MAX_COMPONENT_TIMING_MONTH} maanden.`,
    );
  }

  if (horizonMonths !== null) {
    for (const plan of plans) {
      const { timing, result, strategy, unit } = plan;
      const label = result.label;
      const isDevelopment = DEVELOPMENT_STRATEGIES.has(strategy);
      const isSale = SALE_STRATEGIES.includes(strategy);
      const isHold = HOLD_STRATEGIES.includes(strategy);

      if (isDevelopment) {
        if (timing.developmentStartMonth === null || timing.developmentEndMonth === null) {
          addUnique(blockers, `${label}: ontwikkelstart en oplevering zijn verplicht.`);
        } else {
          if (timing.developmentEndMonth < timing.developmentStartMonth) {
            addUnique(blockers, `${label}: oplevering kan niet vóór de ontwikkelstart liggen.`);
          }
          if (timing.developmentEndMonth > horizonMonths) {
            addUnique(blockers, `${label}: oplevering valt buiten de Quickscan-horizon.`);
          }
        }
      }

      if (isSale) {
        if (timing.saleReceiptMonth === null) {
          addUnique(blockers, `${label}: verkoopmaand ontbreekt.`);
        } else if (timing.saleReceiptMonth > horizonMonths) {
          addUnique(blockers, `${label}: verkoopmaand valt buiten de Quickscan-horizon.`);
        }
        if (result.breakdown.grossSaleValue <= 0) {
          addUnique(blockers, `${label}: bruto verkoopwaarde ontbreekt.`);
        }
      }

      if (isHold) {
        const record = raw(unit);
        const monthlyRent = finiteNumber(record.hold_monthly_rent)
          || finiteNumber(record.hold_annual_rent) / 12;
        if (timing.rentStartMonth === null) {
          addUnique(blockers, `${label}: huurstart ontbreekt.`);
        } else if (timing.rentStartMonth > horizonMonths) {
          addUnique(blockers, `${label}: huurstart valt buiten de Quickscan-horizon.`);
        }
        if (monthlyRent <= 0) addUnique(blockers, `${label}: maand- of jaarhuur ontbreekt.`);

        if (timing.terminalExitMonth === null) {
          addUnique(
            discountingBlockers,
            `${label}: vul een terminale exitmaand in om deze componentstroom later volledig te kunnen verdisconteren.`,
          );
        } else {
          if (timing.rentStartMonth !== null && timing.terminalExitMonth < timing.rentStartMonth) {
            addUnique(blockers, `${label}: terminale exit kan niet vóór de huurstart liggen.`);
          }
          if (timing.terminalExitMonth > horizonMonths) {
            addUnique(blockers, `${label}: terminale exit valt buiten de Quickscan-horizon.`);
          }
          if (result.breakdown.holdValue <= 0) {
            addUnique(blockers, `${label}: terminale behoudwaarde ontbreekt.`);
          }
        }
      }
    }
  }

  if (blockers.length > 0 || horizonMonths === null) {
    return emptyResult(horizonMonths, blockers, discountingBlockers, warnings);
  }

  const mutableRows: MutableCashflowMonth[] = Array.from(
    { length: horizonMonths + 1 },
    (_, month) => ({
      month,
      rentalIncome: 0,
      grossSaleProceeds: 0,
      terminalValue: 0,
      developmentCosts: 0,
      dispositionCosts: 0,
    }),
  );

  for (const plan of plans) {
    const { unit, strategy, timing, result, effectiveWeight } = plan;
    const isDevelopment = DEVELOPMENT_STRATEGIES.has(strategy);
    const isSale = SALE_STRATEGIES.includes(strategy);
    const isHold = HOLD_STRATEGIES.includes(strategy);

    if (isDevelopment && timing.developmentStartMonth !== null && timing.developmentEndMonth !== null) {
      const developmentCosts = result.breakdown.renovationCosts
        + result.breakdown.splittingCosts
        + result.breakdown.transformationCosts;
      const spread = spreadIntegerAmount(
        developmentCosts,
        timing.developmentStartMonth,
        timing.developmentEndMonth,
      );
      spread.forEach((amount, index) => {
        mutableRows[timing.developmentStartMonth! + index].developmentCosts += amount;
      });
      if (developmentCosts <= 0) {
        addUnique(warnings, `${result.label}: ontwikkelkosten zijn € 0 in de lineaire kasstroomspreiding.`);
      }
    }

    if (isSale && timing.saleReceiptMonth !== null) {
      const row = mutableRows[timing.saleReceiptMonth];
      row.grossSaleProceeds += result.breakdown.grossSaleValue;
      row.dispositionCosts += result.breakdown.saleCosts + result.breakdown.legalCosts;
    }

    if (isHold && timing.rentStartMonth !== null) {
      const record = raw(unit);
      const sourceMonthlyRent = finiteNumber(record.hold_monthly_rent)
        || finiteNumber(record.hold_annual_rent) / 12;
      const effectiveMonthlyRent = Math.round(sourceMonthlyRent * effectiveWeight);
      const rentEndExclusive = timing.terminalExitMonth ?? (horizonMonths + 1);
      for (let month = timing.rentStartMonth; month < rentEndExclusive && month <= horizonMonths; month += 1) {
        mutableRows[month].rentalIncome += effectiveMonthlyRent;
      }
      if (timing.terminalExitMonth !== null) {
        mutableRows[timing.terminalExitMonth].terminalValue += result.breakdown.holdValue;
      }
    }
  }

  let cumulativeCashflow = 0;
  const monthly: ComponentCashflowMonth[] = mutableRows.map((row) => {
    const netCashflow = row.rentalIncome
      + row.grossSaleProceeds
      + row.terminalValue
      - row.developmentCosts
      - row.dispositionCosts;
    cumulativeCashflow += netCashflow;
    return { ...row, netCashflow, cumulativeCashflow };
  });

  const totals = monthly.reduce<ComponentCashflowTotals>((sum, row) => ({
    rentalIncome: sum.rentalIncome + row.rentalIncome,
    grossSaleProceeds: sum.grossSaleProceeds + row.grossSaleProceeds,
    terminalValue: sum.terminalValue + row.terminalValue,
    developmentCosts: sum.developmentCosts + row.developmentCosts,
    dispositionCosts: sum.dispositionCosts + row.dispositionCosts,
    netCashflow: sum.netCashflow + row.netCashflow,
  }), emptyTotals());

  return {
    readyForPeriodicCashflow: true,
    readyForDiscounting: discountingBlockers.length === 0,
    horizonMonths,
    monthly,
    periods: aggregatePeriods(monthly),
    totals,
    blockers: [],
    discountingBlockers,
    warnings: Array.from(new Set(warnings)),
  };
}
