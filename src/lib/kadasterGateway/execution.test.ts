import { describe, expect, it, vi } from 'vitest';
import { executeTrancheCGateway } from './execution';
import type { GatewayExecutionDependencies } from './execution';
import type { GatewayPlan, GatewayRequest } from './contracts';

const request: GatewayRequest = {
  requestId: 'req-1', environment: 'shadow', actor: { userId: 'admin-1', role: 'admin' },
  module: 'pandenverkenner', product: 'bag_individuele_bevraging',
  object: { bagVerblijfsobjectId: '0363010000123456' }, purpose: 'objectcontrole',
};

const plan: GatewayPlan = {
  status: 'gateway_ready', decision: 'serve_free_source', reason: 'free_first_route',
  requestId: 'req-1', product: 'bag_individuele_bevraging', estimatedCostCents: 0,
  cacheKey: 'bag_individuele_bevraging:0363010000123456', mayContactExternalProvider: true,
  mayExposeOwnerPii: false, requiresServerSecret: true, requiresExplicitPaidApproval: false,
  auditRequired: true, browserMayCallProviderDirectly: false, productionAllowed: false,
};

function deps(): GatewayExecutionDependencies<{ id: string }> {
  return {
    now: () => '2026-08-04T19:00:00.000Z',
    hashObjectReference: vi.fn(async () => 'hash-1'),
    readCache: vi.fn(async () => null),
    writeCache: vi.fn(async () => undefined),
    callFreeProvider: vi.fn(async () => ({
      provider: 'bag', product: 'bag_individuele_bevraging', fetchedAt: '2026-08-04T19:00:00.000Z',
      data: { id: '0363010000123456' }, actualCostCents: 0,
    })),
    appendAudit: vi.fn(async () => undefined),
  };
}

describe('Tranche C gateway execution', () => {
  it('serveert uitsluitend gratis providerresultaten en auditeert', async () => {
    const d = deps();
    const result = await executeTrancheCGateway(request, plan, d);
    expect(result).toMatchObject({ status: 'served', source: 'free_provider', actualCostCents: 0 });
    expect(d.callFreeProvider).toHaveBeenCalledOnce();
    expect(d.writeCache).toHaveBeenCalledOnce();
    expect(d.appendAudit).toHaveBeenCalledOnce();
  });

  it('blokkeert productie vóór iedere provideractie', async () => {
    const d = deps();
    const result = await executeTrancheCGateway({ ...request, environment: 'production' }, plan, d);
    expect(result.status).toBe('blocked');
    expect(d.callFreeProvider).not.toHaveBeenCalled();
    expect(d.appendAudit).toHaveBeenCalledOnce();
  });

  it('weigert providerresultaat met kosten', async () => {
    const d = deps();
    d.callFreeProvider = vi.fn(async () => ({
      provider: 'bag', product: 'bag_individuele_bevraging', fetchedAt: '2026-08-04T19:00:00.000Z',
      data: { id: '0363010000123456' }, actualCostCents: 1,
    }));
    const result = await executeTrancheCGateway(request, plan, d);
    expect(result.status).toBe('failed');
    expect(d.writeCache).not.toHaveBeenCalled();
  });
});
