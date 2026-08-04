import type {
  BudgetSnapshot,
  CacheSnapshot,
  GatewayPlan,
  GatewayRequest,
  ProductPolicy,
} from './contracts';

export const KADASTER_PRODUCT_POLICIES: readonly ProductPolicy[] = [
  { product: 'bag_individuele_bevraging', costClass: 'free', unitPriceCents: 0, cacheTtlSeconds: 30 * 24 * 3600, containsOwnerPii: false, adminOnly: false, enabledInPreview: true, enabledInShadow: true, enabledInProduction: false },
  { product: 'objectinformatie_algemeen', costClass: 'free', unitPriceCents: 0, cacheTtlSeconds: 30 * 24 * 3600, containsOwnerPii: false, adminOnly: false, enabledInPreview: true, enabledInShadow: true, enabledInProduction: false },
  { product: 'objectinformatie_rechten', costClass: 'paid', unitPriceCents: 296, cacheTtlSeconds: 7 * 24 * 3600, containsOwnerPii: true, adminOnly: true, enabledInPreview: false, enabledInShadow: false, enabledInProduction: false },
  { product: 'objectinformatie_koopsom', costClass: 'paid', unitPriceCents: 45, cacheTtlSeconds: 30 * 24 * 3600, containsOwnerPii: false, adminOnly: true, enabledInPreview: false, enabledInShadow: false, enabledInProduction: false },
  { product: 'objectinformatie_woz', costClass: 'paid', unitPriceCents: 192, cacheTtlSeconds: 30 * 24 * 3600, containsOwnerPii: false, adminOnly: true, enabledInPreview: false, enabledInShadow: false, enabledInProduction: false },
  { product: 'objectinformatie_gemeentelijke_lasten', costClass: 'free', unitPriceCents: 0, cacheTtlSeconds: 30 * 24 * 3600, containsOwnerPii: false, adminOnly: false, enabledInPreview: true, enabledInShadow: true, enabledInProduction: false },
  { product: 'objectinformatie_buurtstatistieken', costClass: 'free', unitPriceCents: 0, cacheTtlSeconds: 30 * 24 * 3600, containsOwnerPii: false, adminOnly: false, enabledInPreview: true, enabledInShadow: true, enabledInProduction: false },
  { product: 'objectinformatie_omgeving', costClass: 'paid', unitPriceCents: 37, cacheTtlSeconds: 30 * 24 * 3600, containsOwnerPii: false, adminOnly: true, enabledInPreview: false, enabledInShadow: false, enabledInProduction: false },
] as const;

function policyFor(request: GatewayRequest): ProductPolicy | undefined {
  return KADASTER_PRODUCT_POLICIES.find(item => item.product === request.product);
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function createGatewayCacheKey(request: GatewayRequest): string {
  const identity =
    normalize(request.object.bagVerblijfsobjectId) ||
    normalize(request.object.bagPandId) ||
    normalize(request.object.crmObjectId) ||
    normalize(request.object.address);
  return `${request.product}:${identity}`;
}

function environmentEnabled(policy: ProductPolicy, request: GatewayRequest): boolean {
  if (request.environment === 'preview') return policy.enabledInPreview;
  if (request.environment === 'shadow') return policy.enabledInShadow;
  return policy.enabledInProduction;
}

function hasObjectIdentity(request: GatewayRequest): boolean {
  return Boolean(
    normalize(request.object.bagVerblijfsobjectId) ||
      normalize(request.object.bagPandId) ||
      normalize(request.object.crmObjectId) ||
      normalize(request.object.address),
  );
}

function budgetAllows(policy: ProductPolicy, budget: BudgetSnapshot): boolean {
  if (policy.costClass === 'free') return true;
  if (budget.hardBlock) return false;
  return (
    budget.companyMonthlySpentCents + policy.unitPriceCents <= budget.companyMonthlyLimitCents &&
    budget.userDailySpentCents + policy.unitPriceCents <= budget.userDailyLimitCents &&
    budget.userMonthlySpentCents + policy.unitPriceCents <= budget.userMonthlyLimitCents
  );
}

export function planKadasterGatewayRequest(
  request: GatewayRequest,
  budget: BudgetSnapshot,
  cache: CacheSnapshot,
): GatewayPlan {
  const policy = policyFor(request);
  const cacheKey = createGatewayCacheKey(request);
  const blocked = (reason: string): GatewayPlan => ({
    status: 'gateway_blocked',
    decision: 'blocked',
    reason,
    requestId: request.requestId,
    product: request.product,
    estimatedCostCents: policy?.unitPriceCents ?? 0,
    cacheKey,
    mayContactExternalProvider: false,
    mayExposeOwnerPii: false,
    requiresServerSecret: true,
    requiresExplicitPaidApproval: policy?.costClass === 'paid',
    auditRequired: true,
    browserMayCallProviderDirectly: false,
    productionAllowed: false,
  });

  if (!policy) return blocked('onbekend_product');
  if (!request.requestId.trim()) return blocked('request_id_ontbreekt');
  if (!request.actor.userId.trim()) return blocked('actor_ontbreekt');
  if (!request.module.trim() || !request.purpose.trim()) return blocked('doel_of_module_ontbreekt');
  if (!hasObjectIdentity(request)) return blocked('objectidentiteit_ontbreekt');
  if (request.environment === 'production') return blocked('productie_geblokkeerd');
  if (!environmentEnabled(policy, request)) return blocked('product_niet_ingeschakeld_in_omgeving');
  if (policy.adminOnly && request.actor.role !== 'admin') return blocked('adminrol_verplicht');

  if (cache.hit && !request.forceRefresh) {
    return {
      status: 'gateway_ready', decision: 'serve_cache', reason: 'geldige_cache_hit', requestId: request.requestId,
      product: request.product, estimatedCostCents: 0, cacheKey, mayContactExternalProvider: false,
      mayExposeOwnerPii: policy.containsOwnerPii, requiresServerSecret: true,
      requiresExplicitPaidApproval: false, auditRequired: true, browserMayCallProviderDirectly: false,
      productionAllowed: false,
    };
  }

  if (policy.costClass === 'free') {
    return {
      status: 'gateway_ready', decision: 'serve_free_source', reason: 'free_first_route', requestId: request.requestId,
      product: request.product, estimatedCostCents: 0, cacheKey, mayContactExternalProvider: true,
      mayExposeOwnerPii: policy.containsOwnerPii, requiresServerSecret: true,
      requiresExplicitPaidApproval: false, auditRequired: true, browserMayCallProviderDirectly: false,
      productionAllowed: false,
    };
  }

  if (!budgetAllows(policy, budget)) return blocked('budget_blokkeert');
  if (!request.explicitPaidApprovalId?.trim()) {
    return {
      status: 'gateway_ready', decision: 'manual_approval_required', reason: 'betaalde_call_vereist_explicit_akkoord',
      requestId: request.requestId, product: request.product, estimatedCostCents: policy.unitPriceCents,
      cacheKey, mayContactExternalProvider: false, mayExposeOwnerPii: policy.containsOwnerPii,
      requiresServerSecret: true, requiresExplicitPaidApproval: true, auditRequired: true,
      browserMayCallProviderDirectly: false, productionAllowed: false,
    };
  }

  return {
    status: 'gateway_ready', decision: 'allow_paid_call', reason: 'betaalde_call_goedgekeurd_binnen_budget',
    requestId: request.requestId, product: request.product, estimatedCostCents: policy.unitPriceCents,
    cacheKey, mayContactExternalProvider: true, mayExposeOwnerPii: policy.containsOwnerPii,
    requiresServerSecret: true, requiresExplicitPaidApproval: true, auditRequired: true,
    browserMayCallProviderDirectly: false, productionAllowed: false,
  };
}
