import type { Component, SellOffUnit } from './types';

/**
 * Feitelijk/juridisch onderdeel bij verkrijging. Dit model is uitsluitend
 * bedoeld voor aankoopprijsverdeling en OVB; toekomstige opbrengsten en
 * ontwikkelkosten blijven in sell_off_units / componentstrategie.
 */
export type AcquisitionComponent = {
  id: string;
  scenario_id: string;
  component_name: string;
  component_type: Component['component_type'];
  floor_or_location: string | null;
  surface_gbo: number | null;
  surface_vvo: number | null;
  surface_bvo: number | null;
  allocated_component_value: number | null;
  transfer_tax_allocation_method: Exclude<NonNullable<Component['transfer_tax_allocation_method']>, 'strategy'>;
  transfer_tax_classification: Component['transfer_tax_classification'];
  transfer_tax_percentage: number | null;
  transfer_tax_amount: number | null;
  transfer_tax_manual_override: boolean;
  source_note: string | null;
  reliability_status: 'laag' | 'middel' | 'hoog' | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type AcquisitionUnitLink = {
  id: string;
  scenario_id: string;
  acquisition_component_id: string;
  sell_off_unit_id: string;
  allocation_weight: number | null;
  created_at: string;
};

/** Minimale vorm die de OVB-rekenkern nodig heeft. */
export type TransferTaxComponent = Pick<
  Component,
  | 'id'
  | 'component_name'
  | 'component_type'
  | 'surface_gbo'
  | 'allocated_component_value'
  | 'transfer_tax_allocation_method'
  | 'transfer_tax_classification'
  | 'transfer_tax_percentage'
  | 'transfer_tax_amount'
  | 'transfer_tax_manual_override'
>;

export function linkedStrategyUnits(
  acquisitionComponentId: string,
  links: AcquisitionUnitLink[],
  units: SellOffUnit[],
): SellOffUnit[] {
  const ids = new Set(
    links
      .filter((link) => link.acquisition_component_id === acquisitionComponentId)
      .map((link) => link.sell_off_unit_id),
  );
  return units.filter((unit) => ids.has(unit.id));
}

export function usesSeparateAcquisitionStructure(
  acquisitionComponents: AcquisitionComponent[] | null | undefined,
): boolean {
  return (acquisitionComponents?.length ?? 0) > 0;
}
