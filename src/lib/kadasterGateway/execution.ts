import type { GatewayAuditEvent, GatewayPlan, GatewayRequest } from './contracts';

export interface GatewayProviderResult<T = unknown> {
  provider: 'bag' | 'kadaster';
  product: GatewayRequest['product'];
  fetchedAt: string;
  data: T;
  actualCostCents: number;
}

export interface GatewayExecutionDependencies<T = unknown> {
  now(): string;
  hashObjectReference(request: GatewayRequest): Promise<string>;
  readCache(cacheKey: string): Promise<GatewayProviderResult<T> | null>;
  writeCache(cacheKey: string, value: GatewayProviderResult<T>, ttlSeconds: number): Promise<void>;
  callFreeProvider(request: GatewayRequest): Promise<GatewayProviderResult<T>>;
  appendAudit(event: GatewayAuditEvent): Promise<void>;
}

export interface GatewayExecutionResult<T = unknown> {
  status: 'served' | 'blocked' | 'failed';
  source: 'cache' | 'free_provider' | 'none';
  requestId: string;
  data: T | null;
  estimatedCostCents: number;
  actualCostCents: number;
}

function event(
  request: GatewayRequest,
  plan: GatewayPlan,
  objectReferenceHash: string,
  occurredAt: string,
  resultStatus: GatewayAuditEvent['resultStatus'],
  actualCostCents: number | null,
  externalProviderContacted: boolean,
): GatewayAuditEvent {
  return {
    eventId: `${request.requestId}:${resultStatus}:${occurredAt}`,
    requestId: request.requestId,
    occurredAt,
    actorUserId: request.actor.userId,
    module: request.module,
    product: request.product,
    environment: request.environment,
    decision: plan.decision,
    estimatedCostCents: plan.estimatedCostCents,
    actualCostCents,
    cacheHit: plan.decision === 'serve_cache',
    cacheKey: plan.cacheKey,
    externalProviderContacted,
    objectReferenceHash,
    approvalId: request.explicitPaidApprovalId ?? null,
    resultStatus,
  };
}

export async function executeTrancheCGateway<T>(
  request: GatewayRequest,
  plan: GatewayPlan,
  dependencies: GatewayExecutionDependencies<T>,
): Promise<GatewayExecutionResult<T>> {
  const occurredAt = dependencies.now();
  const objectReferenceHash = await dependencies.hashObjectReference(request);

  if (request.environment === 'production' || plan.productionAllowed || plan.decision === 'allow_paid_call') {
    await dependencies.appendAudit(event(request, plan, objectReferenceHash, occurredAt, 'blocked', null, false));
    return { status: 'blocked', source: 'none', requestId: request.requestId, data: null, estimatedCostCents: plan.estimatedCostCents, actualCostCents: 0 };
  }

  if (plan.status !== 'gateway_ready') {
    await dependencies.appendAudit(event(request, plan, objectReferenceHash, occurredAt, 'blocked', null, false));
    return { status: 'blocked', source: 'none', requestId: request.requestId, data: null, estimatedCostCents: plan.estimatedCostCents, actualCostCents: 0 };
  }

  try {
    if (plan.decision === 'serve_cache') {
      const cached = await dependencies.readCache(plan.cacheKey);
      if (!cached) {
        await dependencies.appendAudit(event(request, plan, objectReferenceHash, occurredAt, 'failed', 0, false));
        return { status: 'failed', source: 'none', requestId: request.requestId, data: null, estimatedCostCents: 0, actualCostCents: 0 };
      }
      await dependencies.appendAudit(event(request, plan, objectReferenceHash, occurredAt, 'served', 0, false));
      return { status: 'served', source: 'cache', requestId: request.requestId, data: cached.data, estimatedCostCents: 0, actualCostCents: 0 };
    }

    if (plan.decision !== 'serve_free_source') {
      await dependencies.appendAudit(event(request, plan, objectReferenceHash, occurredAt, 'blocked', null, false));
      return { status: 'blocked', source: 'none', requestId: request.requestId, data: null, estimatedCostCents: plan.estimatedCostCents, actualCostCents: 0 };
    }

    const response = await dependencies.callFreeProvider(request);
    if (response.actualCostCents !== 0) throw new Error('Tranche C accepteert uitsluitend kosteloze providerresultaten.');
    await dependencies.writeCache(plan.cacheKey, response, 30 * 24 * 3600);
    await dependencies.appendAudit(event(request, plan, objectReferenceHash, occurredAt, 'served', 0, true));
    return { status: 'served', source: 'free_provider', requestId: request.requestId, data: response.data, estimatedCostCents: 0, actualCostCents: 0 };
  } catch {
    await dependencies.appendAudit(event(request, plan, objectReferenceHash, occurredAt, 'failed', null, plan.decision === 'serve_free_source'));
    return { status: 'failed', source: 'none', requestId: request.requestId, data: null, estimatedCostCents: plan.estimatedCostCents, actualCostCents: 0 };
  }
}
