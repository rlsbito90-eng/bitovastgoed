import { describe, expect, it } from 'vitest';
import type { PaidApproval, PaidBudgetState, PaidPurchaseRequest } from './contracts';
import { planPaidPurchase } from './policy';

const budget: PaidBudgetState = {
  companyMonthlyLimitCents: 10000,
  companyMonthlyChargedCents: 0,
  companyMonthlyReservedCents: 0,
  userDailyLimitCents: 1000,
  userDailyChargedCents: 0,
  userDailyReservedCents: 0,
  userMonthlyLimitCents: 5000,
  userMonthlyChargedCents: 0,
  userMonthlyReservedCents: 0,
  hardBlock: false,
};

const request: PaidPurchaseRequest = {
  requestId: 'req-1', idempotencyKey: 'idem-1', environment: 'shadow',
  actorUserId: 'admin-1', actorRole: 'admin', module: 'pandenverkenner',
  purpose: 'objectcontrole', product: 'objectinformatie_koopsom',
  object: { bagVerblijfsobjectId: '0363010000123456' },
  approvalId: 'approval-1', requestedAt: '2026-08-04T19:00:00Z',
};

const approval: PaidApproval = {
  approvalId: 'approval-1', product: 'objectinformatie_koopsom', environment: 'shadow',
  approvedByUserId: 'admin-1', approvedAt: '2026-08-04T18:00:00Z',
  expiresAt: '2026-08-05T18:00:00Z', maximumUnitPriceCents: 45,
  maximumUses: 1, usedCount: 0, objectReferenceHash: 'hash-1',
  purpose: 'objectcontrole', status: 'approved',
};

const now = '2026-08-04T20:00:00Z';

describe('Tranche D betaald aankoopbeleid', () => {
  it('laat één expliciet goedgekeurde shadowaankoop binnen budget toe', () => {
    expect(planPaidPurchase(request, approval, budget, now)).toMatchObject({
      status: 'paid_ready', decision: 'reserve_and_execute', reservedCostCents: 45,
      providerCallAllowed: true, productionAllowed: false,
    });
  });

  it('blokkeert productie', () => {
    expect(planPaidPurchase({ ...request, environment: 'production' }, approval, budget, now)).toMatchObject({
      status: 'paid_blocked', reason: 'productie_geblokkeerd', providerCallAllowed: false,
    });
  });

  it('blokkeert zonder adminrol', () => {
    expect(planPaidPurchase({ ...request, actorRole: 'user' }, approval, budget, now)).toMatchObject({
      reason: 'adminrol_verplicht',
    });
  });

  it('blokkeert ontbrekende of verlopen goedkeuring', () => {
    expect(planPaidPurchase(request, null, budget, now)).toMatchObject({ reason: 'expliciete_goedkeuring_ontbreekt' });
    expect(planPaidPurchase(request, { ...approval, expiresAt: '2026-08-04T19:00:00Z' }, budget, now)).toMatchObject({
      reason: 'goedkeuring_verlopen',
    });
  });

  it('blokkeert budgetoverschrijding inclusief reserveringen', () => {
    expect(planPaidPurchase(request, approval, { ...budget, userDailyReservedCents: 990 }, now)).toMatchObject({
      reason: 'budget_blokkeert',
    });
  });

  it('blokkeert dubbele idempotency key', () => {
    expect(planPaidPurchase(request, approval, budget, now, new Set(['idem-1']))).toMatchObject({
      reason: 'idempotency_al_verwerkt', reservedCostCents: 0,
    });
  });

  it('vereist dat goedkeuring exact bij product, doel en prijs past', () => {
    expect(planPaidPurchase(request, { ...approval, purpose: 'anders' }, budget, now)).toMatchObject({ reason: 'goedkeuring_doel_mismatch' });
    expect(planPaidPurchase(request, { ...approval, maximumUnitPriceCents: 44 }, budget, now)).toMatchObject({ reason: 'prijs_boven_goedgekeurd_maximum' });
  });
});
