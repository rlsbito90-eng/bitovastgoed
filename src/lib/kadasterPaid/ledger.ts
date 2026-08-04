import type { PaidCostEvent, PaidPurchasePlan, PaidPurchaseRequest, ProviderPaidResult } from './contracts';

function eventId(prefix: string, requestId: string, suffix: string): string {
  return `${prefix}:${requestId}:${suffix}`;
}

export function createReservationEvent(
  request: PaidPurchaseRequest,
  plan: PaidPurchasePlan,
  objectReferenceHash: string,
  occurredAt: string,
): PaidCostEvent {
  if (plan.status !== 'paid_ready' || plan.decision !== 'reserve_and_execute') {
    throw new Error('reservation_requires_paid_ready_plan');
  }
  if (request.environment !== 'shadow') throw new Error('reservation_requires_shadow');
  if (!objectReferenceHash.trim()) throw new Error('object_reference_hash_required');

  return {
    eventId: eventId('reservation', request.requestId, request.idempotencyKey),
    eventType: 'reservation', requestId: request.requestId,
    idempotencyKey: request.idempotencyKey, product: request.product,
    environment: 'shadow', actorUserId: request.actorUserId,
    amountCents: plan.reservedCostCents, occurredAt,
    relatedEventId: null, approvalId: request.approvalId,
    objectReferenceHash, immutable: true,
  };
}

export function settlePaidResult(
  request: PaidPurchaseRequest,
  reservation: PaidCostEvent,
  result: ProviderPaidResult,
  occurredAt: string,
): readonly PaidCostEvent[] {
  if (reservation.eventType !== 'reservation') throw new Error('reservation_event_required');
  if (reservation.requestId !== request.requestId || result.requestId !== request.requestId) {
    throw new Error('request_mismatch');
  }
  if (result.product !== request.product) throw new Error('product_mismatch');
  if (result.actualCostCents < 0) throw new Error('negative_actual_cost');
  if (result.containsOwnerPii !== (result.payloadClassification === 'owner_pii')) {
    throw new Error('pii_classification_mismatch');
  }

  const charge: PaidCostEvent = {
    eventId: eventId('charge', request.requestId, result.providerRequestId),
    eventType: 'charge', requestId: request.requestId,
    idempotencyKey: request.idempotencyKey, product: request.product,
    environment: 'shadow', actorUserId: request.actorUserId,
    amountCents: result.actualCostCents, occurredAt,
    relatedEventId: reservation.eventId, approvalId: request.approvalId,
    objectReferenceHash: reservation.objectReferenceHash, immutable: true,
  };

  const releaseAmount = reservation.amountCents - result.actualCostCents;
  if (releaseAmount === 0) return [charge];

  const adjustment: PaidCostEvent = {
    eventId: eventId(releaseAmount > 0 ? 'release' : 'correction', request.requestId, result.providerRequestId),
    eventType: releaseAmount > 0 ? 'release' : 'correction',
    requestId: request.requestId, idempotencyKey: request.idempotencyKey,
    product: request.product, environment: 'shadow', actorUserId: request.actorUserId,
    amountCents: Math.abs(releaseAmount), occurredAt,
    relatedEventId: reservation.eventId, approvalId: request.approvalId,
    objectReferenceHash: reservation.objectReferenceHash, immutable: true,
  };
  return [charge, adjustment];
}

export function createFailureRelease(
  request: PaidPurchaseRequest,
  reservation: PaidCostEvent,
  occurredAt: string,
): PaidCostEvent {
  if (reservation.eventType !== 'reservation' || reservation.requestId !== request.requestId) {
    throw new Error('matching_reservation_required');
  }
  return {
    eventId: eventId('release', request.requestId, 'failed'),
    eventType: 'release', requestId: request.requestId,
    idempotencyKey: request.idempotencyKey, product: request.product,
    environment: 'shadow', actorUserId: request.actorUserId,
    amountCents: reservation.amountCents, occurredAt,
    relatedEventId: reservation.eventId, approvalId: request.approvalId,
    objectReferenceHash: reservation.objectReferenceHash, immutable: true,
  };
}

export function createRefundEvent(
  originalCharge: PaidCostEvent,
  amountCents: number,
  occurredAt: string,
  reasonId: string,
): PaidCostEvent {
  if (originalCharge.eventType !== 'charge') throw new Error('charge_event_required');
  if (amountCents <= 0 || amountCents > originalCharge.amountCents) throw new Error('invalid_refund_amount');
  if (!reasonId.trim()) throw new Error('refund_reason_required');
  return {
    ...originalCharge,
    eventId: eventId('refund', originalCharge.requestId, reasonId),
    eventType: 'refund', amountCents, occurredAt,
    relatedEventId: originalCharge.eventId,
  };
}
