import type {
  PaidApproval,
  PaidBudgetState,
  PaidProductDefinition,
  PaidPurchasePlan,
  PaidPurchaseRequest,
} from './contracts';

export const PAID_PRODUCT_DEFINITIONS: readonly PaidProductDefinition[] = [
  { product: 'objectinformatie_rechten', unitPriceCents: 296, containsOwnerPii: true, retentionDays: 30, enabledInPreview: false, enabledInShadow: true, enabledInProduction: false },
  { product: 'objectinformatie_koopsom', unitPriceCents: 45, containsOwnerPii: false, retentionDays: 365, enabledInPreview: false, enabledInShadow: true, enabledInProduction: false },
  { product: 'objectinformatie_woz', unitPriceCents: 192, containsOwnerPii: false, retentionDays: 365, enabledInPreview: false, enabledInShadow: true, enabledInProduction: false },
  { product: 'objectinformatie_omgeving', unitPriceCents: 37, containsOwnerPii: false, retentionDays: 365, enabledInPreview: false, enabledInShadow: true, enabledInProduction: false },
] as const;

function productFor(request: PaidPurchaseRequest): PaidProductDefinition | undefined {
  return PAID_PRODUCT_DEFINITIONS.find(item => item.product === request.product);
}

function hasObjectIdentity(request: PaidPurchaseRequest): boolean {
  return Boolean(
    request.object.bagVerblijfsobjectId?.trim() ||
    request.object.bagPandId?.trim() ||
    request.object.crmObjectId?.trim() ||
    request.object.address?.trim(),
  );
}

function budgetAllows(price: number, budget: PaidBudgetState): boolean {
  if (budget.hardBlock) return false;
  return (
    budget.companyMonthlyChargedCents + budget.companyMonthlyReservedCents + price <= budget.companyMonthlyLimitCents &&
    budget.userDailyChargedCents + budget.userDailyReservedCents + price <= budget.userDailyLimitCents &&
    budget.userMonthlyChargedCents + budget.userMonthlyReservedCents + price <= budget.userMonthlyLimitCents
  );
}

export function planPaidPurchase(
  request: PaidPurchaseRequest,
  approval: PaidApproval | null,
  budget: PaidBudgetState,
  nowIso: string,
  existingIdempotencyKeys: ReadonlySet<string> = new Set(),
): PaidPurchasePlan {
  const product = productFor(request);
  const blocked = (reason: string, cost = product?.unitPriceCents ?? 0): PaidPurchasePlan => ({
    status: 'paid_blocked', decision: 'blocked', reason,
    requestId: request.requestId, idempotencyKey: request.idempotencyKey,
    product: request.product, reservedCostCents: cost,
    ownerPiiAllowed: false, providerCallAllowed: false,
    productionAllowed: false, browserProviderCallAllowed: false, auditRequired: true,
  });

  if (!product) return blocked('onbekend_betaald_product');
  if (request.environment === 'production') return blocked('productie_geblokkeerd');
  if (request.environment !== 'shadow') return blocked('uitsluitend_shadow_toegestaan');
  if (!product.enabledInShadow) return blocked('product_niet_ingeschakeld');
  if (request.actorRole !== 'admin') return blocked('adminrol_verplicht');
  if (!request.requestId.trim() || !request.idempotencyKey.trim()) return blocked('request_of_idempotency_ontbreekt');
  if (!request.module.trim() || !request.purpose.trim()) return blocked('module_of_doel_ontbreekt');
  if (!hasObjectIdentity(request)) return blocked('objectidentiteit_ontbreekt');
  if (existingIdempotencyKeys.has(request.idempotencyKey)) return blocked('idempotency_al_verwerkt', 0);
  if (!approval) return blocked('expliciete_goedkeuring_ontbreekt');
  if (approval.approvalId !== request.approvalId) return blocked('goedkeuring_mismatch');
  if (approval.status !== 'approved') return blocked('goedkeuring_niet_actief');
  if (approval.environment !== 'shadow' || approval.product !== request.product) return blocked('goedkeuring_scope_mismatch');
  if (approval.purpose !== request.purpose) return blocked('goedkeuring_doel_mismatch');
  if (new Date(approval.expiresAt).getTime() <= new Date(nowIso).getTime()) return blocked('goedkeuring_verlopen');
  if (approval.usedCount >= approval.maximumUses) return blocked('goedkeuring_verbruikt');
  if (product.unitPriceCents > approval.maximumUnitPriceCents) return blocked('prijs_boven_goedgekeurd_maximum');
  if (!budgetAllows(product.unitPriceCents, budget)) return blocked('budget_blokkeert');

  return {
    status: 'paid_ready', decision: 'reserve_and_execute', reason: 'goedgekeurd_binnen_budget',
    requestId: request.requestId, idempotencyKey: request.idempotencyKey,
    product: request.product, reservedCostCents: product.unitPriceCents,
    ownerPiiAllowed: product.containsOwnerPii,
    providerCallAllowed: true, productionAllowed: false,
    browserProviderCallAllowed: false, auditRequired: true,
  };
}
