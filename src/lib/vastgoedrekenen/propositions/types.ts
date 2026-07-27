export const PROPOSITION_TYPES = [
  "legacy_generic",
  "leased_investment",
  "vacant_commercial",
  "renovate_and_sell",
  "sell_off",
  "transformation",
  "demolition_newbuild",
  "rooftop_extension",
  "mixed_use",
  "portfolio",
  "leased_hotel",
  "operating_hotel",
  "land_development",
] as const;

export type PropositionType = (typeof PROPOSITION_TYPES)[number];

export const INTERVENTION_TYPES = [
  "none",
  "renovate",
  "transform",
  "split",
  "demolish_newbuild",
  "rooftop_extension",
] as const;
export type InterventionType = (typeof INTERVENTION_TYPES)[number];

export const DISPOSITION_TYPES = [
  "hold",
  "sell_vacant",
  "sell_tenanted",
  "sell",
  "defer",
] as const;
export type DispositionType = (typeof DISPOSITION_TYPES)[number];

export const PROPOSITION_SECTION_IDS = [
  "overview",
  "acquisition",
  "income",
  "operating_costs",
  "development_costs",
  "components",
  "residential_wws",
  "valuation",
  "residual_value",
  "sensitivity",
  "risks",
  "sources_and_assumptions",
  "audit",
] as const;
export type PropositionSectionId = (typeof PROPOSITION_SECTION_IDS)[number];

export const VALUATION_METHOD_IDS = [
  "rent_bar",
  "noi_nar",
  "rent_factor",
  "component_sale_value",
  "comparative_market",
  "scenario_exit",
  "residual_cost_profit",
  "residual_gdv_profit",
  "manual_value",
  "operating_cashflow",
  "exit_yield",
  "exit_multiple",
  "portfolio_aggregation",
] as const;
export type ValuationMethodId = (typeof VALUATION_METHOD_IDS)[number];

export type MetricCategoryId = string;

export interface PropositionValidationRule {
  id: string;
  message: string;
  severity: "error" | "warning" | "info";
}

export interface PropositionWarningRule {
  id: string;
  message: string;
}

export interface PropositionDefinition {
  type: PropositionType;
  label: string;
  description: string;
  supportedAssetTypes?: string[];
  sections: {
    required: PropositionSectionId[];
    recommended: PropositionSectionId[];
    optional: PropositionSectionId[];
    hiddenByDefault?: PropositionSectionId[];
  };
  allowedInterventions: InterventionType[];
  allowedDispositions: DispositionType[];
  leadingValuationMethods: ValuationMethodId[];
  applicableMetricCategories: MetricCategoryId[];
  validations: PropositionValidationRule[];
  warnings?: PropositionWarningRule[];
  schemaVersion: number;
}

export interface SourceReference {
  sourceType: string;
  reference: string;
  observedAt?: string;
  note?: string;
}

export interface ValidationIssue {
  path?: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface PropositionNormalizedInput {
  propositionType: PropositionType;
  values: Record<string, unknown>;
  sources: SourceReference[];
}
