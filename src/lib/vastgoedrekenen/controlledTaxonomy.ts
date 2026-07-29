export const CONTROLLED_TAXONOMY_SCHEMA_VERSION = 1 as const;

export type TaxonomyDimension =
  | 'asset_type'
  | 'strategy'
  | 'project_phase'
  | 'risk_class'
  | 'quality_level'
  | 'complexity'
  | 'location_type'
  | 'unit'
  | 'vat_treatment'
  | 'market_condition'
  | 'scenario_profile';

export type ControlledTaxonomyOption = {
  id: string;
  dimension_code: TaxonomyDimension;
  option_code: string;
  label: string;
  parent_dimension_code: TaxonomyDimension | null;
  parent_option_code: string | null;
  description: string | null;
  sort_order: number;
  active: boolean;
  version: number;
  system_managed: boolean;
  created_at: string;
  updated_at: string;
};

export type TaxonomyOptionLike = Pick<
  ControlledTaxonomyOption,
  'dimension_code' | 'option_code' | 'label' | 'active' | 'sort_order'
>;

export const TAXONOMY_DIMENSION_LABELS: Record<TaxonomyDimension, string> = {
  asset_type: 'Assettype',
  strategy: 'Strategie',
  project_phase: 'Projectfase',
  risk_class: 'Risicoklasse',
  quality_level: 'Kwaliteitsniveau',
  complexity: 'Complexiteit',
  location_type: 'Locatietype',
  unit: 'Eenheid',
  vat_treatment: 'Btw-behandeling',
  market_condition: 'Marktomstandigheid',
  scenario_profile: 'Scenarioprofiel',
};

export const UNIT_LEGACY_VALUES: Record<string, string> = {
  percent: '%',
  eur: '€',
  eur_m2_bvo: '€/m² BVO',
  eur_m2_gbo: '€/m² GBO',
  eur_m2_vvo: '€/m² VVO',
  eur_unit: '€/eenheid',
  eur_month: '€/maand',
  eur_year: '€/jaar',
  months: 'maanden',
  years: 'jaren',
  index: 'index',
};

export function taxonomyOptionsFor(
  options: readonly TaxonomyOptionLike[],
  dimension: TaxonomyDimension,
  includeInactive = false,
): TaxonomyOptionLike[] {
  return options
    .filter((option) => option.dimension_code === dimension && (includeInactive || option.active))
    .sort((left, right) => left.sort_order - right.sort_order || left.label.localeCompare(right.label, 'nl-NL'));
}

export function taxonomyLabel(
  options: readonly TaxonomyOptionLike[],
  dimension: TaxonomyDimension,
  code: string | null | undefined,
): string {
  if (!code) return '—';
  return options.find((option) => option.dimension_code === dimension && option.option_code === code)?.label ?? code;
}

export function taxonomyLabels(
  options: readonly TaxonomyOptionLike[],
  dimension: TaxonomyDimension,
  codes: readonly string[] | null | undefined,
): string[] {
  return (codes ?? []).map((code) => taxonomyLabel(options, dimension, code));
}

export function validateTaxonomyCodes(args: {
  options: readonly TaxonomyOptionLike[];
  dimension: TaxonomyDimension;
  codes: readonly string[] | null | undefined;
}): string[] {
  const allowed = new Set(
    taxonomyOptionsFor(args.options, args.dimension, true).map((option) => option.option_code),
  );
  return Array.from(new Set(args.codes ?? [])).filter((code) => !allowed.has(code));
}

export function legacyUnitValue(unitCode: string | null | undefined, fallback = ''): string {
  if (!unitCode) return fallback;
  return UNIT_LEGACY_VALUES[unitCode] ?? (fallback || unitCode);
}
