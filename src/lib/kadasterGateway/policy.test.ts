import { describe, expect, it } from 'vitest';
import { createGatewayCacheKey, planKadasterGatewayRequest } from './policy';
import type { BudgetSnapshot, CacheSnapshot, GatewayRequest } from './contracts';

const budget: BudgetSnapshot = {
  companyMonthlyLimitCents: 10000,
  companyMonthlySpentCents: 0,
  userDailyLimitCents: 1000,
  userDailySpentCents: 0,
  userMonthlyLimitCents: 5000,
  userMonthlySpentCents: 0,
  warningThresholdPercent: 80,
  hardBlock: false,
};

const miss: CacheSnapshot = { hit: false };

function request(overrides: Partial<GatewayRequest> = {}): GatewayRequest {
  return {
    requestId: 'req-1',
    environment: 'shadow',
    actor: { userId: 'user-1', role: 'admin' },
    module: 'pandenverkenner',
    product: 'bag_individuele_bevraging',
    object: { bagVerblijfsobjectId: '0363010000123456' },
    purpose: 'objectcontrole',
    ...overrides,
  };
}

describe('Kadaster gateway policy', () => {
  it('blokkeert productie altijd', () => {
    expect(planKadasterGatewayRequest(request({ environment: 'production' }), budget, miss)).toMatchObject({
      status: 'gateway_blocked', decision: 'blocked', reason: 'productie_geblokkeerd', productionAllowed: false,
    });
  });

  it('routeert gratis BAG free-first', () => {
    expect(planKadasterGatewayRequest(request(), budget, miss)).toMatchObject({
      status: 'gateway_ready', decision: 'serve_free_source', estimatedCostCents: 0,
      mayContactExternalProvider: true, browserMayCallProviderDirectly: false,
    });
  });

  it('serveert geldige cache zonder providercall', () => {
    expect(planKadasterGatewayRequest(request(), budget, { hit: true })).toMatchObject({
      decision: 'serve_cache', estimatedCostCents: 0, mayContactExternalProvider: false,
    });
  });

  it('blokkeert alle betaalde producten tot Tranche D', () => {
    const result = planKadasterGatewayRequest(
      request({ product: 'objectinformatie_koopsom', explicitPaidApprovalId: 'approval-1' }), budget, miss,
    );
    expect(result).toMatchObject({
      status: 'gateway_blocked', decision: 'blocked', reason: 'product_niet_ingeschakeld_in_omgeving',
      estimatedCostCents: 45, mayContactExternalProvider: false,
    });
  });

  it('blokkeert eigenaarinformatie eveneens volledig', () => {
    const result = planKadasterGatewayRequest(
      request({ product: 'objectinformatie_rechten' }), budget, miss,
    );
    expect(result).toMatchObject({
      status: 'gateway_blocked', reason: 'product_niet_ingeschakeld_in_omgeving',
      mayExposeOwnerPii: false, mayContactExternalProvider: false,
    });
  });

  it('maakt deterministische cachekey met BAG-prioriteit', () => {
    expect(createGatewayCacheKey(request({
      object: { bagVerblijfsobjectId: ' 0363010000123456 ', address: 'Damrak 1 Amsterdam' },
    }))).toBe('bag_individuele_bevraging:0363010000123456');
  });
});
