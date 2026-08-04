import type { GatewayEnvironment, GatewayObjectReference, GatewayProductCode } from '../kadasterGateway/contracts';

export type PaidProductCode = Extract<GatewayProductCode,
  | 'objectinformatie_rechten'
  | 'objectinformatie_koopsom'
  | 'objectinformatie_woz'
  | 'objectinformatie_omgeving'>;

export type PaidApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'consumed';
export type CostEventType = 'reservation' | 'charge' | 'release' | 'correction' | 'refund';

export interface PaidProductDefinition {
  product: PaidProductCode;
  unitPriceCents: number;
  containsOwnerPii: boolean;
  retentionDays: number;
  enabledInPreview: boolean;
  enabledInShadow: boolean;
  enabledInProduction: false;
}

export interface PaidPurchaseRequest {
  requestId: string;
  idempotencyKey: string;
  environment: GatewayEnvironment;
  actorUserId: string;
  actorRole: 'admin' | 'user';
  module: string;
  purpose: string;
  product: PaidProductCode;
  object: GatewayObjectReference;
  approvalId: string;
  requestedAt: string;
}

export interface PaidApproval {
  approvalId: string;
  product: PaidProductCode;
  environment: 'preview' | 'shadow';
  approvedByUserId: string;
  approvedAt: string;
  expiresAt: string;
  maximumUnitPriceCents: number;
  maximumUses: number;
  usedCount: number;
  objectReferenceHash: string;
  purpose: string;
  status: PaidApprovalStatus;
}

export interface PaidBudgetState {
  companyMonthlyLimitCents: number;
  companyMonthlyChargedCents: number;
  companyMonthlyReservedCents: number;
  userDailyLimitCents: number;
  userDailyChargedCents: number;
  userDailyReservedCents: number;
  userMonthlyLimitCents: number;
  userMonthlyChargedCents: number;
  userMonthlyReservedCents: number;
  hardBlock: boolean;
}

export interface PaidPurchasePlan {
  status: 'paid_ready' | 'paid_blocked';
  decision: 'reserve_and_execute' | 'blocked';
  reason: string;
  requestId: string;
  idempotencyKey: string;
  product: PaidProductCode;
  reservedCostCents: number;
  ownerPiiAllowed: boolean;
  providerCallAllowed: boolean;
  productionAllowed: false;
  browserProviderCallAllowed: false;
  auditRequired: true;
}

export interface PaidCostEvent {
  eventId: string;
  eventType: CostEventType;
  requestId: string;
  idempotencyKey: string;
  product: PaidProductCode;
  environment: 'preview' | 'shadow';
  actorUserId: string;
  amountCents: number;
  occurredAt: string;
  relatedEventId: string | null;
  approvalId: string;
  objectReferenceHash: string;
  immutable: true;
}

export interface ProviderPaidResult {
  requestId: string;
  providerRequestId: string;
  product: PaidProductCode;
  actualCostCents: number;
  resultReceivedAt: string;
  containsOwnerPii: boolean;
  payloadClassification: 'non_pii' | 'owner_pii';
}
