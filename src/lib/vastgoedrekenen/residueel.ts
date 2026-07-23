import type {
  Component,
  ResidualBindingTarget,
  ResidualComputation,
  Scenario,
  TaxSettings,
} from './types';
import { computeAcquisitionCosts } from './investering';
import { computeScenarioOvb } from './ovb';

type ResidualSource = 'componentstrategie' | 'scenario_exit';

export type ComputeResidualInput = {
  scenario: Scenario;
  components: Component[];
  taxSettings: TaxSettings | null;
  objectType: 'residentieel' | 'commercieel' | 'mixed_use';
  source: ResidualSource;
  grossDevelopmentValue: number;
  componentDispositionCosts: number;
  componentDevelopmentCosts: number;
  sharedScenarioCosts: number;
  financingCosts: number;
  strategyValueByComponentId?: Map<string, number>;
  criticalIssues?: string[];
  warnings?: string[];
};

type TargetCandidate = {
  bindingTarget: Exclude<ResidualBindingTarget, null>;
  allowedTotalInvestment: number;
};

const finiteNonNegative = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const unique = (values: string[]): string[] => [...new Set(values.filter(Boolean))];

function resolveTargets(
  scenario: Scenario,
  gdv: number,
): {
  candidates: TargetCandidate[];
  criticalIssues: string[];
  warnings: string[];
  hasExplicitTarget: boolean;
} {
  const rec = scenario as unknown as Record<string, unknown>;
  const profitOnCostPct = finiteNonNegative(rec.sale_target_roi_percentage);
  const profitOnGdvPct = finiteNonNegative(rec.sale_target_margin_percentage);
  const explicitAbsolute = finiteNonNegative(rec.sale_target_margin_amount);
  const legacyAbsolute = finiteNonNegative(rec.target_margin);
  const criticalIssues: string[] = [];
  const warnings: string[] = [];
  const candidates: TargetCandidate[] = [];

  if (profitOnCostPct > 0) {
    candidates.push({
      bindingTarget: 'winst_op_kosten',
      allowedTotalInvestment: gdv / (1 + profitOnCostPct / 100),
    });
  }

  if (profitOnGdvPct > 0) {
    if (profitOnGdvPct >= 100) {
      criticalIssues.push('Doelwinst op GDV moet lager zijn dan 100%.');
    } else {
      candidates.push({
        bindingTarget: 'winst_op_gdv',
        allowedTotalInvestment: gdv * (1 - profitOnGdvPct / 100),
      });
    }
  }

  if (explicitAbsolute > 0 && legacyAbsolute > 0 && explicitAbsolute !== legacyAbsolute) {
    criticalIssues.push('Twee verschillende vaste doelwinsten zijn ingevuld; kies één bedrag.');
  }
  const absolute = explicitAbsolute > 0 ? explicitAbsolute : legacyAbsolute;
  if (legacyAbsolute > 0 && explicitAbsolute <= 0) {
    warnings.push('Vaste doelwinst komt uit het legacyveld target_margin.');
  }
  if (absolute > 0) {
    candidates.push({
      bindingTarget: 'vaste_winst',
      allowedTotalInvestment: gdv - absolute,
    });
  }

  const hasExplicitTarget = candidates.length > 0;
  if (!hasExplicitTarget) {
    criticalIssues.push('Vul minimaal één doelwinst in: op kosten, op GDV of als vast bedrag.');
    // Een nulwinst-residu blijft informatief beschikbaar, maar kan nooit Voor bieding zijn.
    candidates.push({ bindingTarget: 'vaste_winst', allowedTotalInvestment: gdv });
  }

  return { candidates, criticalIssues, warnings, hasExplicitTarget };
}

/**
 * Bepaalt de hoogste gehele koopsom die alle actieve winstdoelen respecteert.
 * OVB, aankoopfee en notariskosten worden voor iedere kandidaat opnieuw berekend.
 */
export function computeResidualBid(input: ComputeResidualInput): ResidualComputation | null {
  const gdv = Math.round(finiteNonNegative(input.grossDevelopmentValue));
  if (gdv <= 0) return null;

  const targets = resolveTargets(input.scenario, gdv);
  const binding = targets.candidates.reduce((current, candidate) => (
    candidate.allowedTotalInvestment < current.allowedTotalInvestment ? candidate : current
  ));
  const allowedTotalInvestment = Math.max(0, binding.allowedTotalInvestment);
  const targetProfitAmount = Math.max(0, Math.round(gdv - allowedTotalInvestment));

  const disposition = Math.round(finiteNonNegative(input.componentDispositionCosts));
  const development = Math.round(finiteNonNegative(input.componentDevelopmentCosts));
  const shared = Math.round(finiteNonNegative(input.sharedScenarioCosts));
  const financing = Math.round(finiteNonNegative(input.financingCosts));
  const nonAcquisitionCosts = disposition + development + shared + financing;

  const baseCriticalIssues = unique([
    ...(input.criticalIssues ?? []),
    ...targets.criticalIssues,
  ]);
  const baseWarnings = unique([
    ...(input.warnings ?? []),
    ...targets.warnings,
  ]);

  const evaluate = (purchasePrice: number) => {
    const candidateScenario = {
      ...input.scenario,
      purchase_price: purchasePrice,
    } as Scenario;
    const ovb = computeScenarioOvb(
      candidateScenario,
      input.components,
      input.taxSettings,
      input.objectType,
      input.strategyValueByComponentId,
    );
    const acquisition = computeAcquisitionCosts(candidateScenario);
    const totalInvestment = purchasePrice
      + ovb.totalOvb
      + acquisition.totalAcquisitionCosts
      + nonAcquisitionCosts;
    return { purchasePrice, ovb, acquisition, totalInvestment };
  };

  let low = 0;
  let high = Math.max(0, Math.floor(Math.min(gdv, allowedTotalInvestment)));
  let best = evaluate(0);
  let iterations = 0;

  if (best.totalInvestment <= allowedTotalInvestment) {
    while (low <= high && iterations < 64) {
      iterations += 1;
      const middle = Math.floor((low + high) / 2);
      const evaluated = evaluate(middle);
      if (evaluated.totalInvestment <= allowedTotalInvestment) {
        best = evaluated;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
  }

  const converged = iterations < 64;
  const criticalIssues = [...baseCriticalIssues];
  if (!converged) criticalIssues.push('De residuele solver is niet geconvergeerd.');
  if (best.ovb.missingBasisCount > 0) {
    criticalIssues.push(`OVB-grondslag ontbreekt voor ${best.ovb.missingBasisCount} component(en).`);
  }
  if (
    input.scenario.ovb_mode === 'per_component'
    && best.ovb.perComponent.length > 0
    && best.ovb.perComponent.every((component) => component.basisMethod !== 'manual')
  ) {
    const allocatedBasis = best.ovb.perComponent.reduce((sum, component) => sum + component.basisValue, 0);
    if (Math.abs(allocatedBasis - best.purchasePrice) > 1) {
      criticalIssues.push('De OVB-grondslagen per component tellen niet op tot de residuele koopsom.');
    }
  }
  if (best.purchasePrice <= 0 && nonAcquisitionCosts + targetProfitAmount >= gdv) {
    criticalIssues.push('De uitgangspunten dragen geen positieve koopsom.');
  }

  const profitAtMaxPurchase = gdv - best.totalInvestment;
  const profitOnCostPct = best.totalInvestment > 0
    ? Number(((profitAtMaxPurchase / best.totalInvestment) * 100).toFixed(2))
    : null;
  const profitOnGdvPct = gdv > 0
    ? Number(((profitAtMaxPurchase / gdv) * 100).toFixed(2))
    : null;

  return {
    source: input.source,
    grossDevelopmentValue: gdv,
    componentDispositionCosts: disposition,
    componentDevelopmentCosts: development,
    sharedScenarioCosts: shared,
    financingCosts: financing,
    targetProfitAmount,
    bindingTarget: targets.hasExplicitTarget ? binding.bindingTarget : null,
    allowedTotalInvestment: Math.max(0, Math.round(allowedTotalInvestment)),
    maxPurchasePrice: best.purchasePrice,
    transferTaxAtMaxPurchase: best.ovb.totalOvb,
    acquisitionCostsAtMaxPurchase: best.acquisition.totalAcquisitionCosts,
    totalInvestmentAtMaxPurchase: best.totalInvestment,
    profitAtMaxPurchase,
    profitOnCostPct,
    profitOnGdvPct,
    status: criticalIssues.length === 0 ? 'voor_bieding' : 'indicatief',
    criticalIssues: unique(criticalIssues),
    warnings: baseWarnings,
    iterations,
    converged,
  };
}
