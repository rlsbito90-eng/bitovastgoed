import { getPropositionDefinition } from "../registry";
import type { PropositionNormalizedInput, SourceReference, ValidationIssue, ValidationResult } from "../types";
import type { PropositionInputAdapter, RenovateAndSellInput } from "./types";

export const RENOVATE_AND_SELL_COST_SOURCE = "proposition:renovate_and_sell";
export const RENOVATION_COST_KEY = `${RENOVATE_AND_SELL_COST_SOURCE}:renovation`;
export const OTHER_PROJECT_COST_KEY = `${RENOVATE_AND_SELL_COST_SOURCE}:other_project`;
export const TEMPORARY_INCOME_WARNING = "Geregistreerd, nog niet meegenomen in de berekening.";

export type RenovateAndSellScenarioPatch = {
  purchase_price: number;
  renovation_area_m2: number;
  project_duration_months: number | null;
  temporary_project_income: number | null;
  temporary_project_income_costs: number | null;
  financing_costs: number;
  unforeseen_percentage: number;
  sale_strategy: "renoveren_verkopen";
  sale_price_source: "total" | "per_m2";
  sale_price_total: number | null;
  sale_price_per_m2: number | null;
  sale_sellable_m2: number | null;
  sale_costs_percentage: number;
  sale_other_costs: number;
  sale_target_margin_amount: number;
  sale_target_margin_percentage: number;
  sale_target_roi_percentage: number;
};

export type RenovateAndSellCostInput = {
  ownershipKey: typeof RENOVATION_COST_KEY | typeof OTHER_PROJECT_COST_KEY;
  category: "bouwkosten" | "overig";
  description: string;
  amount: number;
  source: typeof RENOVATE_AND_SELL_COST_SOURCE;
};

export type RenovateAndSellNormalizedValues = {
  scenarioPatch: RenovateAndSellScenarioPatch;
  scenarioCosts: RenovateAndSellCostInput[];
  warnings: string[];
};

const finite = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function nonNegativeIssue(path: string, value: unknown): ValidationIssue | null {
  return finite(value) < 0 ? { path, message: `${path} mag niet negatief zijn.`, severity: "error" } : null;
}

function resolveRenovationCosts(input: RenovateAndSellInput): number {
  const legacy = input.renovationCosts;
  if (input.renovationCostBasis === "per_m2") {
    return Math.round(finite(input.renovationAreaM2) * finite(input.renovationCostsPerM2));
  }
  return finite(input.renovationCostsTotal ?? legacy);
}

function validate(input: RenovateAndSellInput): ValidationResult {
  const issues: ValidationIssue[] = [];
  const fields: Array<[string, unknown]> = [
    ["purchasePrice", input.purchasePrice ?? input.acquisitionBasis],
    ["renovationAreaM2", input.renovationAreaM2],
    ["renovationCostsTotal", input.renovationCostsTotal ?? input.renovationCosts],
    ["renovationCostsPerM2", input.renovationCostsPerM2],
    ["otherProjectCosts", input.otherProjectCosts],
    ["unforeseenPercentage", input.unforeseenPercentage],
    ["financingCosts", input.financingCosts],
    ["projectDurationMonths", input.projectDurationMonths ?? input.durationMonths],
    ["grossSaleValue", input.grossSaleValue ?? input.targetSaleValue],
    ["saleValuePerM2", input.saleValuePerM2],
    ["sellableAreaM2", input.sellableAreaM2],
    ["saleCostsPercentage", input.saleCostsPercentage],
    ["saleOtherCosts", input.saleOtherCosts ?? input.saleCosts],
    ["targetMarginAmount", input.targetMarginAmount],
    ["targetMarginPercentageOfGdv", input.targetMarginPercentageOfGdv],
    ["targetRoiPercentage", input.targetRoiPercentage],
    ["temporaryProjectIncome", input.temporaryProjectIncome ?? input.temporaryIncome],
    ["temporaryProjectIncomeCosts", input.temporaryProjectIncomeCosts],
  ];
  for (const [path, value] of fields) {
    if (value == null) continue;
    const issue = nonNegativeIssue(path, value);
    if (issue) issues.push(issue);
  }
  const duration = input.projectDurationMonths ?? input.durationMonths;
  if (duration != null && finite(duration) <= 0) {
    issues.push({ path: "projectDurationMonths", message: "projectDurationMonths moet groter dan 0 zijn.", severity: "error" });
  }
  if ((input.saleValueSource ?? "total") === "per_m2" && (finite(input.saleValuePerM2) <= 0 || finite(input.sellableAreaM2) <= 0)) {
    issues.push({ path: "saleValueSource", message: "Prijs per m² vereist een positieve prijs en verkoopbaar oppervlak.", severity: "error" });
  }
  return { valid: issues.every((issue) => issue.severity !== "error"), issues };
}

function normalize(input: RenovateAndSellInput): PropositionNormalizedInput {
  const purchasePrice = finite(input.purchasePrice ?? input.acquisitionBasis);
  const grossSaleValue = finite(input.grossSaleValue ?? input.targetSaleValue);
  const saleOtherCosts = finite(input.saleOtherCosts ?? input.saleCosts);
  const duration = input.projectDurationMonths ?? input.durationMonths;
  const temporaryIncome = input.temporaryProjectIncome ?? input.temporaryIncome;
  const saleValueSource = input.saleValueSource ?? "total";
  const renovationCosts = resolveRenovationCosts(input);
  const otherProjectCosts = finite(input.otherProjectCosts);
  const warnings = temporaryIncome != null || input.temporaryProjectIncomeCosts != null
    ? [TEMPORARY_INCOME_WARNING]
    : [];

  const values: RenovateAndSellNormalizedValues = {
    scenarioPatch: {
      purchase_price: purchasePrice,
      renovation_area_m2: finite(input.renovationAreaM2),
      project_duration_months: duration == null ? null : finite(duration),
      temporary_project_income: temporaryIncome == null ? null : finite(temporaryIncome),
      temporary_project_income_costs: input.temporaryProjectIncomeCosts == null ? null : finite(input.temporaryProjectIncomeCosts),
      financing_costs: finite(input.financingCosts),
      unforeseen_percentage: finite(input.unforeseenPercentage),
      sale_strategy: "renoveren_verkopen",
      sale_price_source: saleValueSource,
      sale_price_total: saleValueSource === "total" ? grossSaleValue : null,
      sale_price_per_m2: saleValueSource === "per_m2" ? finite(input.saleValuePerM2) : null,
      sale_sellable_m2: saleValueSource === "per_m2" ? finite(input.sellableAreaM2) : null,
      sale_costs_percentage: finite(input.saleCostsPercentage),
      sale_other_costs: saleOtherCosts,
      sale_target_margin_amount: finite(input.targetMarginAmount),
      sale_target_margin_percentage: finite(input.targetMarginPercentageOfGdv),
      sale_target_roi_percentage: finite(input.targetRoiPercentage),
    },
    scenarioCosts: [
      {
        ownershipKey: RENOVATION_COST_KEY,
        category: "bouwkosten",
        description: "Renovatiekosten",
        amount: renovationCosts,
        source: RENOVATE_AND_SELL_COST_SOURCE,
      },
      {
        ownershipKey: OTHER_PROJECT_COST_KEY,
        category: "overig",
        description: "Overige projectkosten",
        amount: otherProjectCosts,
        source: RENOVATE_AND_SELL_COST_SOURCE,
      },
    ].filter((cost) => cost.amount > 0),
    warnings,
  };

  return {
    propositionType: "renovate_and_sell",
    values: values as unknown as Record<string, unknown>,
    sources: [...input.sources],
  };
}

export const RenovateAndSellInputAdapter: PropositionInputAdapter<RenovateAndSellInput> = {
  propositionType: "renovate_and_sell",
  schemaVersion: getPropositionDefinition("renovate_and_sell").schemaVersion,
  validate,
  normalize,
  describeSources: (input: RenovateAndSellInput): SourceReference[] => [...input.sources],
};

export function getRenovateAndSellNormalizedValues(normalized: PropositionNormalizedInput): RenovateAndSellNormalizedValues {
  return normalized.values as unknown as RenovateAndSellNormalizedValues;
}

export type AdapterOwnedCost = {
  ownership_key?: string | null;
  source_reference?: string | null;
  [key: string]: unknown;
};

/** Vervangt uitsluitend adapter-owned regels en behoudt alle handmatige kostenregels. */
export function mergeRenovateAndSellCosts<T extends AdapterOwnedCost>(
  existing: readonly T[],
  adapterCosts: readonly RenovateAndSellCostInput[],
  mapCost: (cost: RenovateAndSellCostInput) => T,
): T[] {
  const ownedKeys = new Set([RENOVATION_COST_KEY, OTHER_PROJECT_COST_KEY]);
  const manual = existing.filter((cost) => !ownedKeys.has(String(cost.ownership_key ?? cost.source_reference ?? "")));
  return [...manual, ...adapterCosts.map(mapCost)];
}
