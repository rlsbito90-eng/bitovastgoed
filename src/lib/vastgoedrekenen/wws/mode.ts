// WWS-modus per scenario / woonunit.
//
// Pure helpers: bepalen of een scenario WWS niet nodig heeft,
// slechts indicatief, of volledig vereist (Huurcommissie-check).
// Geen rekenlogica — alleen classificatie en advies.

import type { Scenario, Component, SellOffUnit, WwsUnit } from '../types';
import { SALE_STRATEGIES, HOLD_STRATEGIES, type ComponentStrategyKey } from '../componentStrategy';

export type WwsMode = 'niet_nodig' | 'indicatief' | 'volledig_vereist';

export const WWS_MODE_LABEL: Record<WwsMode, string> = {
  niet_nodig: 'Niet nodig',
  indicatief: 'Indicatief',
  volledig_vereist: 'Volledig vereist',
};

export const WWS_MODE_DESCRIPTION: Record<WwsMode, string> = {
  niet_nodig: 'Geen wooncomponenten of geen WWS-relevantie. WWS-analyse niet nodig.',
  indicatief:
    'Globale segmentindicatie volstaat (bv. uitponden/verkopen). Officiële Huurcommissie-check is niet kritiek.',
  volledig_vereist:
    'Aanhouden/verhuren of WWS-gecorrigeerde huur — een volledige Huurcommissie-check is nodig vóór harde bieding.',
};

export type WwsModeSource = 'auto' | 'handmatig';

export interface WwsModeSuggestion {
  mode: WwsMode;
  reasons: string[];
}

// Strategy-type sets uit calculation_scenarios.strategy_type
const RENT_FOCUSED_SCENARIO = new Set<string>([
  'renoveren_verhuren',
  'transformeren',
  'huur_optimaliseren',
  'belegging',
  'buy_fix_hold',
  'buy_transform_hold',
  'sale_leaseback',
]);

const SALE_FOCUSED_SCENARIO = new Set<string>([
  'uitponden',
  'verkopen_geheel',
  'verkoop_per_unit',
  'splitsen',
  'bedrijfsunits_los',
  'buy_fix_sell',
  'buy_split_sell',
  'buy_transform_sell',
]);

import { VR_WOON_COMPONENT_TYPES } from '../defaults';
const RESIDENTIAL_COMPONENT_TYPES = VR_WOON_COMPONENT_TYPES;

export interface WwsModeContext {
  scenario: Scenario;
  components: Component[];
  strategyUnits: SellOffUnit[];
  wwsUnits: WwsUnit[];
}

/**
 * Bepaal automatisch advies voor WWS-modus o.b.v. scenario- en strategiecontext.
 * Volgorde: blocker-regels (volledig vereist) → niet-nodig → indicatief default.
 */
export function suggestWwsMode(ctx: WwsModeContext): WwsModeSuggestion {
  const { scenario, components, strategyUnits, wwsUnits } = ctx;
  const reasons: string[] = [];

  const residentialComponents = components.filter((c) =>
    RESIDENTIAL_COMPONENT_TYPES.has(String(c.component_type ?? '')),
  );
  const hasResidential = residentialComponents.length > 0 || wwsUnits.length > 0;

  if (!hasResidential) {
    reasons.push('Geen wooncomponenten of WWS-units in scenario.');
    return { mode: 'niet_nodig', reasons };
  }

  const rentSource = String(scenario.rent_source ?? 'handmatig');
  const strategyType = String(scenario.strategy_type ?? 'belegging');

  // Componentstrategie: zijn er woonunits die aangehouden of verkocht worden?
  const residentialCompIds = new Set(residentialComponents.map((c) => c.id));
  const stratResidential = strategyUnits.filter((u) => {
    const r = u as unknown as Record<string, unknown>;
    if (RESIDENTIAL_COMPONENT_TYPES.has(String(u.unit_type ?? ''))) return true;
    const cid = r.component_id as string | null | undefined;
    return cid ? residentialCompIds.has(cid) : false;
  });
  const hasHoldResidential = stratResidential.some((u) => {
    const s = (u as unknown as { strategy?: ComponentStrategyKey | null }).strategy ?? null;
    return s ? HOLD_STRATEGIES.includes(s) : false;
  });
  const hasSaleResidential = stratResidential.some((u) => {
    const s = (u as unknown as { strategy?: ComponentStrategyKey | null }).strategy ?? null;
    return s ? SALE_STRATEGIES.includes(s) : false;
  });

  // ----- VOLLEDIG VEREIST -----
  if (rentSource === 'wws_gecorrigeerd') {
    reasons.push('Huurbron staat op "WWS-gecorrigeerd" — exacte WWS-huur is nodig.');
    return { mode: 'volledig_vereist', reasons };
  }
  if (hasHoldResidential) {
    reasons.push('Eén of meer wooncomponenten worden aangehouden/verhuurd.');
    return { mode: 'volledig_vereist', reasons };
  }
  if (RENT_FOCUSED_SCENARIO.has(strategyType)) {
    reasons.push(`Scenariostrategie "${strategyType}" is gericht op verhuur.`);
    return { mode: 'volledig_vereist', reasons };
  }

  // ----- INDICATIEF -----
  if (hasSaleResidential) {
    reasons.push('Wooncomponenten worden verkocht/uitgepond — segmentindicatie volstaat.');
    return { mode: 'indicatief', reasons };
  }
  if (SALE_FOCUSED_SCENARIO.has(strategyType)) {
    reasons.push(`Scenariostrategie "${strategyType}" is gericht op verkoop.`);
    return { mode: 'indicatief', reasons };
  }

  reasons.push('Wooncomponenten aanwezig zonder duidelijke verhuur- of verkoopkeuze.');
  return { mode: 'indicatief', reasons };
}

/**
 * Effectieve modus voor één unit: handmatige override (op unit of scenario) → suggestie.
 */
export function getEffectiveWwsMode(
  unit: WwsUnit | null,
  ctx: WwsModeContext,
): { mode: WwsMode; source: WwsModeSource; reasons: string[] } {
  const suggestion = suggestWwsMode(ctx);
  const unitMode = (unit as unknown as { wws_mode?: string | null } | null)?.wws_mode;
  if (unitMode && isWwsMode(unitMode)) {
    return { mode: unitMode, source: 'handmatig', reasons: ['Handmatig gekozen op woonunit.'] };
  }
  const scenarioMode = (ctx.scenario as unknown as { wws_mode_default?: string | null }).wws_mode_default;
  if (scenarioMode && isWwsMode(scenarioMode)) {
    return { mode: scenarioMode, source: 'handmatig', reasons: ['Handmatig gekozen op scenario.'] };
  }
  return { mode: suggestion.mode, source: 'auto', reasons: suggestion.reasons };
}

export function isWwsMode(v: unknown): v is WwsMode {
  return v === 'niet_nodig' || v === 'indicatief' || v === 'volledig_vereist';
}
