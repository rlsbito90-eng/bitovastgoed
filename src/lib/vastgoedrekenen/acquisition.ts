import type { Component, SellOffUnit } from './types';

export const ACQUISITION_COMPONENT_TYPE_LABELS = {
  woning: 'Woning',
  appartement: 'Appartement',
  studio: 'Studio',
  kamer: 'Kamer',
  winkelruimte: 'Winkelruimte',
  kantoorruimte: 'Kantoorruimte',
  bedrijfsruimte: 'Bedrijfsruimte',
  bedrijfsunit: 'Bedrijfsunit',
  opslagruimte: 'Opslagruimte',
  kelder: 'Kelder',
  parkeerplaats: 'Parkeerplaats',
  garagebox: 'Garagebox',
  berging: 'Berging',
  horeca: 'Horeca',
  maatschappelijk: 'Maatschappelijk',
  ontwikkelgrond: 'Ontwikkelgrond',
  woon_winkelpand: 'Woon-winkelpand',
  woon_kantoorpand: 'Woon-kantoorpand',
  woon_bedrijfspand: 'Woon-bedrijfspand',
  winkel_kantoorpand: 'Winkel-kantoorpand',
  mixed_use: 'Mixed-use / gecombineerd gebruik',
  mixed_use_overig: 'Ander gecombineerd gebruik',
  overig: 'Overig',
} as const;

export type AcquisitionComponentType = keyof typeof ACQUISITION_COMPONENT_TYPE_LABELS;

export const ACQUISITION_STRUCTURE_MIGRATION = '20260725153000_vastgoedrekenen_verkrijgingsstructuur.sql';

export type AcquisitionStructureStatus = 'available' | 'migration_required' | 'error';

type DbLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
} | null | undefined;

export function isAcquisitionStructureMigrationMissing(error: DbLikeError): boolean {
  const code = String(error?.code ?? '');
  if (code === '42P01' || code === 'PGRST205') return true;
  const raw = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const namesAcquisitionTable = raw.includes('calculation_acquisition_components')
    || raw.includes('calculation_acquisition_unit_links');
  const missingRelation = raw.includes('could not find the table')
    || raw.includes('schema cache')
    || raw.includes('does not exist')
    || raw.includes('undefined table');
  return namesAcquisitionTable && missingRelation;
}

export function acquisitionStructureStatusMessage(
  status: AcquisitionStructureStatus,
  errorMessage?: string | null,
): string | null {
  if (status === 'available') return null;
  if (status === 'migration_required') {
    return `De interface is bijgewerkt, maar de benodigde databasetabellen ontbreken. Voer Supabase-migratie ${ACQUISITION_STRUCTURE_MIGRATION} uit en ververs daarna deze pagina.`;
  }
  return errorMessage
    || 'De verkrijgingsstructuur kon niet uit de database worden geladen. Controleer de databaseverbinding en probeer het opnieuw.';
}

/**
 * Feitelijk/juridisch onderdeel bij verkrijging. Dit model is uitsluitend
 * bedoeld voor aankoopprijsverdeling en OVB; toekomstige opbrengsten en
 * ontwikkelkosten blijven in sell_off_units / componentstrategie.
 */
export type AcquisitionComponent = {
  id: string;
  scenario_id: string;
  component_name: string;
  component_type: AcquisitionComponentType;
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
