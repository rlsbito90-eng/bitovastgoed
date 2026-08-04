import { describe, expect, it } from 'vitest';
import type { PaidPurchasePlan, PaidPurchaseRequest, ProviderPaidResult } from './contracts';
import { createFailureRelease, createRefundEvent, createReservationEvent, settlePaidResult } from './ledger';

const request: PaidPurchaseRequest = {
  requestId: 'req-1', idempotencyKey: 'idem-1', environment: 'shadow',
  actorUserId: 'admin-1', actorRole: 'admin', module: 'objecten', purpose: 'objectcontrole',
  product: 'objectinformatie_koopsom', object: { bagPandId: '0363100012345678' },
  approvalId: 'approval-1', requestedAt: '2026-08-04T19:00:00Z',
};

const plan: PaidPurchasePlan = {
  status: 'paid_ready', decision: 'reserve_and_execute', reason: 'goedgekeurd_binnen_budget',
  requestId: 'req-1', idempotencyKey: 'idem-1', product: 'objectinformatie_koopsom',
  reservedCostCents: 45, ownerPiiAllowed: false, providerCallAllowed: true,
  productionAllowed: false, browserProviderCallAllowed: false, auditRequired: true,
};

const result: ProviderPaidResult = {
  requestId: 'req-1', providerRequestId: 'provider-1', product: 'objectinformatie_koopsom',
  actualCostCents: 45, resultReceivedAt: '2026-08-04T19:01:00Z',
  containsOwnerPii: false, payloadClassification: 'non_pii',
};

describe('Tranche D append-only kostenledger', () => {
  it('maakt een immutable reservering en definitieve charge', () => {
    const reservation = createReservationEvent(request, plan, 'hash-1', '2026-08-04T19:00:00Z');
    const events = settlePaidResult(request, reservation, result, '2026-08-04T19:01:00Z');
    expect(reservation).toMatchObject({ eventType: 'reservation', amountCents: 45, immutable: true });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ eventType: 'charge', amountCents: 45, relatedEventId: reservation.eventId });
  });

  it('geeft ongebruikte reservering vrij', () => {
    const reservation = createReservationEvent(request, { ...plan, reservedCostCents: 100 }, 'hash-1', '2026-08-04T19:00:00Z');
    const events = settlePaidResult(request, reservation, result, '2026-08-04T19:01:00Z');
    expect(events.map(event => event.eventType)).toEqual(['charge', 'release']);
    expect(events[1].amountCents).toBe(55);
  });

  it('boekt overschrijding als correctie zonder bestaande event te wijzigen', () => {
    const reservation = createReservationEvent(request, { ...plan, reservedCostCents: 40 }, 'hash-1', '2026-08-04T19:00:00Z');
    const events = settlePaidResult(request, reservation, result, '2026-08-04T19:01:00Z');
    expect(events[1]).toMatchObject({ eventType: 'correction', amountCents: 5 });
  });

  it('geeft volledige reservering vrij bij providerfout', () => {
    const reservation = createReservationEvent(request, plan, 'hash-1', '2026-08-04T19:00:00Z');
    expect(createFailureRelease(request, reservation, '2026-08-04T19:02:00Z')).toMatchObject({
      eventType: 'release', amountCents: 45, relatedEventId: reservation.eventId,
    });
  });

  it('maakt een afzonderlijke refund en bewaart de oorspronkelijke charge', () => {
    const reservation = createReservationEvent(request, plan, 'hash-1', '2026-08-04T19:00:00Z');
    const [charge] = settlePaidResult(request, reservation, result, '2026-08-04T19:01:00Z');
    const refund = createRefundEvent(charge, 45, '2026-08-04T20:00:00Z', 'provider-credit');
    expect(refund).toMatchObject({ eventType: 'refund', amountCents: 45, relatedEventId: charge.eventId });
    expect(charge.eventType).toBe('charge');
  });

  it('blokkeert inconsistente PII-classificatie', () => {
    const reservation = createReservationEvent(request, plan, 'hash-1', '2026-08-04T19:00:00Z');
    expect(() => settlePaidResult(request, reservation, { ...result, containsOwnerPii: true }, '2026-08-04T19:01:00Z'))
      .toThrow('pii_classification_mismatch');
  });
});
