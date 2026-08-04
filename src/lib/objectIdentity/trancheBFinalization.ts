export type TrancheBEnvironment = 'shadow' | 'production';

export interface TrancheBApprovedPackage {
  packageId: string;
  packageHash: string;
  environment: TrancheBEnvironment;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
  proposedWrites: number;
  manualReviewItems: number;
}

export interface TrancheBExecutionBoundary {
  environment: TrancheBEnvironment;
  maxWrites: number;
  auditEnabled: boolean;
  rollbackEnabled: boolean;
  productionBlocked: boolean;
}

export interface TrancheBFinalizationResult {
  status: 'tranche_b_ready' | 'tranche_b_blocked';
  reasons: string[];
  executionAllowed: boolean;
  productionAllowed: false;
  requiresSeparateExecutionAuthorization: true;
  auditRequired: true;
  rollbackRequired: true;
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

function isValidDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export function finalizeTrancheB(
  approvedPackage: TrancheBApprovedPackage,
  boundary: TrancheBExecutionBoundary,
  now = new Date(),
): TrancheBFinalizationResult {
  const reasons: string[] = [];

  if (!approvedPackage.packageId.trim()) reasons.push('package_id_missing');
  if (!isSha256(approvedPackage.packageHash)) reasons.push('package_hash_invalid');
  if (!approvedPackage.approvedBy.trim()) reasons.push('reviewer_missing');
  if (!isValidDate(approvedPackage.approvedAt)) reasons.push('approved_at_invalid');
  if (!isValidDate(approvedPackage.expiresAt)) reasons.push('expires_at_invalid');

  if (
    isValidDate(approvedPackage.expiresAt) &&
    Date.parse(approvedPackage.expiresAt) <= now.getTime()
  ) {
    reasons.push('approval_expired');
  }

  if (approvedPackage.environment !== 'shadow') reasons.push('package_not_shadow');
  if (boundary.environment !== 'shadow') reasons.push('boundary_not_shadow');
  if (!boundary.productionBlocked) reasons.push('production_not_blocked');
  if (!boundary.auditEnabled) reasons.push('audit_missing');
  if (!boundary.rollbackEnabled) reasons.push('rollback_missing');
  if (approvedPackage.manualReviewItems > 0) reasons.push('manual_review_in_scope');
  if (approvedPackage.proposedWrites < 0) reasons.push('negative_write_count');
  if (boundary.maxWrites < 0) reasons.push('negative_write_limit');
  if (approvedPackage.proposedWrites > boundary.maxWrites) reasons.push('write_limit_exceeded');

  return {
    status: reasons.length === 0 ? 'tranche_b_ready' : 'tranche_b_blocked',
    reasons,
    executionAllowed: false,
    productionAllowed: false,
    requiresSeparateExecutionAuthorization: true,
    auditRequired: true,
    rollbackRequired: true,
  };
}

export interface TrancheBAuditEntry {
  packageId: string;
  sourceType: string;
  sourceId: string;
  action: 'link_existing_object' | 'propose_new_object';
  beforeObjectId: string | null;
  afterObjectId: string;
  bagVerblijfsobjectId: string | null;
  bagPandId: string | null;
}

export interface TrancheBRollbackEntry {
  sourceType: string;
  sourceId: string;
  restoreObjectId: string | null;
}

export function buildRollbackPlan(
  auditEntries: TrancheBAuditEntry[],
): TrancheBRollbackEntry[] {
  return auditEntries.map(entry => ({
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    restoreObjectId: entry.beforeObjectId,
  }));
}
