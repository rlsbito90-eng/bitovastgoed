// OVB-berekeningen: classificatie → percentage → bedrag.
// Ondersteunt enkelvoudig én mixed-use (toerekening per component).

import type { Component, Scenario, TaxSettings } from './types';
import { VR_DEFAULTS } from './defaults';

/** Jaar waarvoor de meegeleverde standaard-OVB-tarieven gelden. */
export const OVB_RATES_YEAR = 2026;

import { VR_WOON_COMPONENT_TYPES } from './defaults';
const RESIDENTIAL_COMPONENT_TYPES = VR_WOON_COMPONENT_TYPES;
const COMMERCIAL_COMPONENT_TYPES = new Set<string>([
  'winkel', 'winkelruimte', 'kantoor', 'kantoorruimte',
  'bedrijfsruimte', 'bedrijfsunit', 'horeca', 'opslagruimte',
  'garagebox', 'maatschappelijk', 'ontwikkelgrond',
]);

/**
 * Leid OVB-classificatie af uit component_type wanneer expliciete
 * classificatie ontbreekt. Voorkomt dat woon-componenten in een
 * mixed-use object stilletjes 10,4% krijgen via de objectType-fallback.
 */
export function inferOvbClassificationFromComponentType(
  componentType: string | null | undefined,
): OvbClassification | null {
  const t = String(componentType ?? '').toLowerCase();
  if (RESIDENTIAL_COMPONENT_TYPES.has(t)) return 'woning_belegging';
  if (COMMERCIAL_COMPONENT_TYPES.has(t)) return 'niet_woning';
  return null;
}

export type OvbClassification =
  | 'eigen_woning'
  | 'woning_belegging'
  | 'niet_woning'
  | 'mixed_use'
  | 'vrijgesteld'
  | 'handmatig';

export function getOvbPercentage(
  classification: OvbClassification | null | undefined,
  settings: Pick<TaxSettings,
    'transfer_tax_primary_residence_percentage' |
    'transfer_tax_residential_investment_percentage' |
    'transfer_tax_non_residential_percentage'> | null,
  manualPct?: number | null,
  objectType?: 'residentieel' | 'commercieel' | 'mixed_use' | null,
): number {
  if (classification === 'handmatig' && typeof manualPct === 'number') return manualPct;
  if (classification === 'vrijgesteld') return 0;
  const s = settings ?? {
    transfer_tax_primary_residence_percentage: VR_DEFAULTS.ovbHoofdverblijfPct,
    transfer_tax_residential_investment_percentage: VR_DEFAULTS.ovbWoningBeleggingPct,
    transfer_tax_non_residential_percentage: VR_DEFAULTS.ovbNietWoningPct,
  };
  switch (classification) {
    case 'eigen_woning': return Number(s.transfer_tax_primary_residence_percentage);
    case 'woning_belegging': return Number(s.transfer_tax_residential_investment_percentage);
    case 'niet_woning': return Number(s.transfer_tax_non_residential_percentage);
    case 'mixed_use': return Number(s.transfer_tax_non_residential_percentage);
    default:
      if (objectType === 'commercieel') return Number(s.transfer_tax_non_residential_percentage);
      if (objectType === 'mixed_use') return Number(s.transfer_tax_non_residential_percentage);
      return Number(s.transfer_tax_residential_investment_percentage);
  }
}

export type OvbPerComponent = {
  id: string;
  amount: number;
  pct: number;
  /** Welke grondslag is gebruikt voor de berekening. */
  basisMethod: 'value' | 'm2' | 'manual' | 'strategy' | 'extern';
  /** De gebruikte EUR-grondslag (vóór percentage). */
  basisValue: number;
  /** True als allocation_method='value' maar toegerekende waarde ontbreekt of 0 is. */
  missingValueBasis: boolean;
  /** True als allocation_method='strategy' maar er geen strategiewaarde gevonden is. */
  missingStrategyBasis: boolean;
  /** True als allocation_method='manual' maar transfer_tax_amount ontbreekt. */
  missingManualAmount: boolean;
};

export function computeScenarioOvb(
  scenario: Pick<Scenario, 'purchase_price' | 'ovb_mode' | 'ovb_classification' | 'transfer_tax_percentage' | 'transfer_tax_amount'>,
  components: Component[],
  settings: TaxSettings | null,
  objectType?: 'residentieel' | 'commercieel' | 'mixed_use' | null,
  /** Map componentId → afgeleide waarde uit componentstrategie (voor allocation_method='strategy'). */
  strategyValueByComponentId?: Map<string, number>,
): {
  totalOvb: number;
  perComponent: OvbPerComponent[];
  method: 'scenario' | 'per_component' | 'manual';
  /** Aantal componenten met ontbrekende grondslag (UI/audit). */
  missingBasisCount: number;
} {
  const purchase = Number(scenario.purchase_price ?? 0);

  if (scenario.ovb_mode === 'manual' && scenario.transfer_tax_amount != null) {
    return { totalOvb: Number(scenario.transfer_tax_amount), perComponent: [], method: 'manual', missingBasisCount: 0 };
  }

  if (scenario.ovb_mode === 'per_component' && components.length > 0) {
    const totalArea = components.reduce((s, c) => s + (c.surface_gbo ?? 0), 0);
    const totalStrategyValue = components.reduce(
      (sum, component) => sum + Math.max(0, strategyValueByComponentId?.get(component.id) ?? 0),
      0,
    );
    const perComponent: OvbPerComponent[] = components.map((c) => {
      const allocMethod = (c.transfer_tax_allocation_method ?? 'value') as OvbPerComponent['basisMethod'];

      // Handmatig bedrag: percentage is informatief.
      if (allocMethod === 'manual') {
        const hasAmount = c.transfer_tax_amount != null;
        return {
          id: c.id,
          amount: hasAmount ? Number(c.transfer_tax_amount) : 0,
          pct: Number(c.transfer_tax_percentage ?? 0),
          basisMethod: 'manual',
          basisValue: 0,
          missingValueBasis: false,
          missingStrategyBasis: false,
          missingManualAmount: !hasAmount,
        };
      }

      // Grondslag bepalen
      let basis = 0;
      let missingValueBasis = false;
      let missingStrategyBasis = false;
      if (allocMethod === 'm2') {
        if (totalArea > 0 && Number(c.surface_gbo ?? 0) > 0) {
          basis = (purchase * (c.surface_gbo ?? 0)) / totalArea;
        } else {
          missingValueBasis = true;
        }
      } else if (allocMethod === 'strategy') {
        const v = strategyValueByComponentId?.get(c.id);
        if (v != null && v > 0 && totalStrategyValue > 0) {
          // Strategiewaarde is uitsluitend de verdeelsleutel. De fiscale grondslag
          // blijft de kandidaat-koopsom en moet over alle componenten optellen tot purchase.
          basis = (purchase * v) / totalStrategyValue;
        } else {
          missingStrategyBasis = true;
        }
      } else if (allocMethod === 'extern') {
        basis = Number(c.allocated_component_value ?? 0);
      } else {
        // 'value' (default)
        basis = Number(c.allocated_component_value ?? 0);
        if (basis <= 0) missingValueBasis = true;
      }

      const effectiveClassification = (c.transfer_tax_classification as OvbClassification | null)
        ?? inferOvbClassificationFromComponentType(c.component_type);
      const pct = c.transfer_tax_manual_override && c.transfer_tax_percentage != null
        ? Number(c.transfer_tax_percentage)
        : getOvbPercentage(effectiveClassification, settings, null, objectType);
      const amount = Math.round((basis * pct) / 100);
      return {
        id: c.id,
        amount,
        pct,
        basisMethod: allocMethod,
        basisValue: Math.round(basis),
        missingValueBasis,
        missingStrategyBasis,
        missingManualAmount: false,
      };
    });
    const missingBasisCount = perComponent.filter((p) => p.missingValueBasis || p.missingStrategyBasis || p.missingManualAmount).length;
    return {
      totalOvb: perComponent.reduce((s, x) => s + x.amount, 0),
      perComponent,
      method: 'per_component',
      missingBasisCount,
    };
  }

  // auto / fallback
  const pct = scenario.transfer_tax_percentage != null
    ? Number(scenario.transfer_tax_percentage)
    : getOvbPercentage(scenario.ovb_classification as OvbClassification | null, settings, null, objectType);
  return { totalOvb: Math.round((purchase * pct) / 100), perComponent: [], method: 'scenario', missingBasisCount: 0 };
}
