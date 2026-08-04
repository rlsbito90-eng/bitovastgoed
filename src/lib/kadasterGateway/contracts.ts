export type GatewayEnvironment = 'preview' | 'shadow' | 'production';
export type GatewayProductCode =
  | 'bag_individuele_bevraging'
  | 'objectinformatie_algemeen'
  | 'objectinformatie_rechten'
  | 'objectinformatie_koopsom'
  | 'objectinformatie_woz'
  | 'objectinformatie_gemeentelijke_lasten'
  | 'objectinformatie_buurtstatistieken'
  | 'objectinformatie_omgeving';

export type GatewayCostClass = 'free' | 'paid';
export type GatewayDecision =
  | 'serve_cache'
  | 'serve_free_source'
  | 'allow_paid_call'
  | 'manual_approval_required'
  | 'blocked';

export interface GatewayActor {
  userId: string;
  role: 'admin' | 'user';
}

export interface GatewayObjectReference {
  crmObjectId?: string | null;
  bagVerblijfsobjectId?: string | null;
  bagPandId?: string | null;
  address?: string | null;
}

export interface GatewayRequest {
  requestId: string;
  environment: GatewayEnvironment;
  actor: GatewayActor;
  module: string;
  product: GatewayProductCode;
  object: GatewayObjectReference;
  purpose: string;
  forceRefresh?: boolean;
  explicitPaidApprovalId?: string | null;
}

export interface ProductPolicy {
  product: GatewayProductCode;
  costClass: GatewayCostClass;
  unitPriceCents: number;
  cacheTtlSeconds: number;
  containsOwnerPii: boolean;
  adminOnly: boolean;
  enabledInPreview: boolean;
  enabledInShadow: boolean;
  enabledInProduction: boolean;
}

export interface BudgetSnapshot {
  companyMonthlyLimitCents: number;
  companyMonthlySpentCents: number;
  userDailyLimitCents: number;
  userDailySpentCents: number;
  userMonthlyLimitCents: number;
  userMonthlySpentCents: number;
  warningThresholdPercent: number;
  hardBlock: boolean;
}

export interface CacheSnapshot {
  hit: boolean;
  cacheKey?: string;
  storedAt?: string;
  expiresAt?: string;
  sourceRequestId?: string;
}

export interface GatewayPlan {
  status: 'gateway_ready' | 'gateway_blocked';
  decision: GatewayDecision;
  reason: string;
  requestId: string;
  product: GatewayProductCode;
  estimatedCostCents: number;
  cacheKey: string;
  mayContactExternalProvider: boolean;
  mayExposeOwnerPii: boolean;
  requiresServerSecret: boolean;
  requiresExplicitPaidApproval: boolean;
  auditRequired: true;
  browserMayCallProviderDirectly: false;
  productionAllowed: boolean;
}

export interface GatewayAuditEvent {
  eventId: string;
  requestId: string;
  occurredAt: string;
  actorUserId: string;
  module: string;
  product: GatewayProductCode;
  environment: GatewayEnvironment;
  decision: GatewayDecision;
  estimatedCostCents: number;
  actualCostCents: number | null;
  cacheHit: boolean;
  cacheKey: string;
  externalProviderContacted: boolean;
  objectReferenceHash: string;
  approvalId: string | null;
  resultStatus: 'planned' | 'served' | 'failed' | 'blocked';
}
