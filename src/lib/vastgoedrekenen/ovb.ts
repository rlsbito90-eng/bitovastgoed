// OVB-berekeningen: classificatie → percentage → bedrag.
// Ondersteunt enkelvoudig én mixed-use (toerekening per component).

import type { Component, Scenario, TaxSettings } from './types';
import { VR_DEFAULTS } from './defaults';

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
    case 'mixed_use': return Number(s.transfer_tax_non_residential_percentage); // fallback bij niet-toegerekend
    default:
      // Geen classificatie: kies default op basis van objecttype.
      // Residentieel → woning_belegging (8%), commercieel/BOG → niet_woning (10,4%).
      if (objectType === 'commercieel') return Number(s.transfer_tax_non_residential_percentage);
      if (objectType === 'mixed_use') return Number(s.transfer_tax_non_residential_percentage);
      return Number(s.transfer_tax_residential_investment_percentage);
  }
}

export function computeScenarioOvb(
  scenario: Pick<Scenario, 'purchase_price' | 'ovb_mode' | 'ovb_classification' | 'transfer_tax_percentage' | 'transfer_tax_amount'>,
  components: Component[],
  settings: TaxSettings | null,
  objectType?: 'residentieel' | 'commercieel' | 'mixed_use' | null,
): { totalOvb: number; perComponent: { id: string; amount: number; pct: number }[]; method: 'scenario' | 'per_component' | 'manual' } {
  const purchase = Number(scenario.purchase_price ?? 0);

  if (scenario.ovb_mode === 'manual' && scenario.transfer_tax_amount != null) {
    return { totalOvb: Number(scenario.transfer_tax_amount), perComponent: [], method: 'manual' };
  }

  if (scenario.ovb_mode === 'per_component' && components.length > 0) {
    const totalArea = components.reduce((s, c) => s + (c.surface_gbo ?? 0), 0);
    const perComponent = components.map((c) => {
      let basis = Number(c.allocated_component_value ?? 0);
      if (c.transfer_tax_allocation_method === 'm2' && totalArea > 0) {
        basis = (purchase * (c.surface_gbo ?? 0)) / totalArea;
      }
      if (c.transfer_tax_allocation_method === 'manual' && c.transfer_tax_amount != null) {
        return { id: c.id, amount: Number(c.transfer_tax_amount), pct: Number(c.transfer_tax_percentage ?? 0) };
      }
      const pct = c.transfer_tax_manual_override && c.transfer_tax_percentage != null
        ? Number(c.transfer_tax_percentage)
        : getOvbPercentage(c.transfer_tax_classification as OvbClassification | null, settings, null, objectType);
      const amount = Math.round((basis * pct) / 100);
      return { id: c.id, amount, pct };
    });
    return { totalOvb: perComponent.reduce((s, x) => s + x.amount, 0), perComponent, method: 'per_component' };
  }

  // auto / fallback
  const pct = scenario.transfer_tax_percentage != null
    ? Number(scenario.transfer_tax_percentage)
    : getOvbPercentage(scenario.ovb_classification as OvbClassification | null, settings, null, objectType);
  return { totalOvb: Math.round((purchase * pct) / 100), perComponent: [], method: 'scenario' };
}
