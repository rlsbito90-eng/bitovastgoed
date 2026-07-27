import { computeScenario, type ComputeContext } from './compute';
import { buildScenarioComputeContext } from './computeContext';
import type { ComputedOutputs, Scenario, ScenarioCost, SellOffUnit } from './types';

export type SensitivityAdjustment = {
  revenuePct: number;
  developmentCostsPct: number;
};

function factorFromPct(pct: number): number {
  const value = Number.isFinite(pct) ? pct : 0;
  return Math.max(0, 1 + value / 100);
}

function scalePositiveField(record: Record<string, unknown>, field: string, factor: number): void {
  const current = Number(record[field] ?? 0);
  if (!Number.isFinite(current) || current <= 0) return;
  record[field] = Math.round(current * factor * 100) / 100;
}

/**
 * Past alleen concrete opbrengst-/eindwaarde-invoer aan. Rendementseisen,
 * verkoopkostenpercentages en oppervlakten blijven ongewijzigd.
 */
export function scaleScenarioRevenue(scenario: Scenario, pct: number): Scenario {
  const factor = factorFromPct(pct);
  const next = { ...(scenario as unknown as Record<string, unknown>) };
  for (const field of [
    'sale_price_total',
    'sale_price_per_m2',
    'sale_price_per_unit',
    'sale_exit_value_manual',
  ]) {
    scalePositiveField(next, field, factor);
  }
  return next as unknown as Scenario;
}

/**
 * Past verkoopwaarden en expliciete handmatige aanhoudwaarden per strategie-unit aan.
 * BAR/NAR/factor-waarderingen worden niet kunstmatig herschreven.
 */
export function scaleStrategyRevenue(units: SellOffUnit[], pct: number): SellOffUnit[] {
  const factor = factorFromPct(pct);
  return units.map((unit) => {
    const next = { ...(unit as unknown as Record<string, unknown>) };
    for (const field of ['sale_price_total', 'sale_price_per_m2', 'hold_value_manual']) {
      scalePositiveField(next, field, factor);
    }
    return next as unknown as SellOffUnit;
  });
}

/**
 * Past algemene projectkosten aan volgens hun actieve invoermethode.
 * Percentages en m²-grondslagen blijven intact; alleen het kostenniveau beweegt.
 */
export function scaleScenarioDevelopmentCosts(costs: ScenarioCost[], pct: number): ScenarioCost[] {
  const factor = factorFromPct(pct);
  return costs.map((cost) => {
    const next = { ...(cost as unknown as Record<string, unknown>) };
    const calcMode = String(next.calc_mode ?? 'totaal');
    if (calcMode === 'per_m2') scalePositiveField(next, 'amount_per_m2', factor);
    else scalePositiveField(next, 'amount', factor);
    if (String(next.vat_treatment ?? '') === 'handmatig') {
      scalePositiveField(next, 'vat_amount_manual', factor);
    }
    return next as unknown as ScenarioCost;
  });
}

/** Past uitsluitend ontwikkelkosten binnen de toekomstige componentstrategie aan. */
export function scaleStrategyDevelopmentCosts(units: SellOffUnit[], pct: number): SellOffUnit[] {
  const factor = factorFromPct(pct);
  return units.map((unit) => {
    const next = { ...(unit as unknown as Record<string, unknown>) };
    for (const field of ['renovation_costs', 'splitting_costs', 'transformation_costs']) {
      scalePositiveField(next, field, factor);
    }
    return next as unknown as SellOffUnit;
  });
}

export function applySensitivityAdjustment(
  scenario: Scenario,
  costs: ScenarioCost[],
  strategyUnits: SellOffUnit[],
  adjustment: SensitivityAdjustment,
): { scenario: Scenario; costs: ScenarioCost[]; strategyUnits: SellOffUnit[] } {
  const revenueAdjustedUnits = scaleStrategyRevenue(strategyUnits, adjustment.revenuePct);
  return {
    scenario: scaleScenarioRevenue(scenario, adjustment.revenuePct),
    costs: scaleScenarioDevelopmentCosts(costs, adjustment.developmentCostsPct),
    strategyUnits: scaleStrategyDevelopmentCosts(revenueAdjustedUnits, adjustment.developmentCostsPct),
  };
}

/**
 * Rekent één sensitiviteitscel door via exact dezelfde centrale rekencontext en
 * rekenkern als de normale scenarioberekening.
 */
export function computeSensitivityScenario(
  context: ComputeContext,
  adjustment: SensitivityAdjustment,
): ComputedOutputs {
  const adjusted = applySensitivityAdjustment(
    context.scenario,
    context.costs,
    context.strategyUnits ?? [],
    adjustment,
  );

  return computeScenario(buildScenarioComputeContext({
    ...context,
    scenario: adjusted.scenario,
    costs: adjusted.costs,
    strategyUnits: adjusted.strategyUnits,
  }));
}
