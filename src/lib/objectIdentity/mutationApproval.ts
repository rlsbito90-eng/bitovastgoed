export type ObjectIdentityMutationProposalType =
  | 'link_existing_object'
  | 'create_new_object'
  | 'manual_review';

export interface MutationPackageApprovalInput {
  packageId: string;
  packageHash: string;
  proposalCount: number;
  proposalTypes: ObjectIdentityMutationProposalType[];
  sourceTypes: string[];
  environment: 'shadow' | 'production';
  reviewerId: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
  dryRun: boolean;
  writes: number;
  automaticMerges: number;
}

export interface MutationPackageApprovalIssue {
  code:
    | 'missing_package_id'
    | 'invalid_package_hash'
    | 'empty_package'
    | 'production_forbidden'
    | 'missing_reviewer'
    | 'missing_approval_timestamp'
    | 'missing_expiry'
    | 'expired_approval'
    | 'not_dry_run'
    | 'writes_detected'
    | 'automatic_merges_detected'
    | 'manual_review_in_mutation_scope';
  detail: string;
}

export interface MutationPackageApprovalResult {
  status: 'approval_ready' | 'approval_blocked';
  environment: 'shadow' | 'production';
  mutationAllowed: false;
  writes: 0;
  automaticMerges: 0;
  approvedProposalCount: number;
  issues: MutationPackageApprovalIssue[];
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function beoordeelObjectIdentityMutatiepakket(
  input: MutationPackageApprovalInput,
  now = new Date(),
): MutationPackageApprovalResult {
  const issues: MutationPackageApprovalIssue[] = [];

  if (!input.packageId.trim()) {
    issues.push({ code: 'missing_package_id', detail: 'Mutatiepakket heeft geen stabiel pakket-ID.' });
  }
  if (!SHA256_PATTERN.test(input.packageHash)) {
    issues.push({ code: 'invalid_package_hash', detail: 'Mutatiepakket vereist een SHA-256 hash in lowercase hex.' });
  }
  if (input.proposalCount <= 0) {
    issues.push({ code: 'empty_package', detail: 'Een leeg mutatiepakket kan niet worden goedgekeurd.' });
  }
  if (input.environment === 'production') {
    issues.push({ code: 'production_forbidden', detail: 'Deze Tranche B-poort staat uitsluitend shadowbeoordeling toe.' });
  }
  if (!input.reviewerId?.trim()) {
    issues.push({ code: 'missing_reviewer', detail: 'Een expliciete reviewer is verplicht.' });
  }
  if (!input.approvedAt) {
    issues.push({ code: 'missing_approval_timestamp', detail: 'Een expliciet goedkeuringsmoment is verplicht.' });
  }
  if (!input.expiresAt) {
    issues.push({ code: 'missing_expiry', detail: 'Goedkeuring moet een vervaldatum hebben.' });
  } else if (new Date(input.expiresAt).getTime() <= now.getTime()) {
    issues.push({ code: 'expired_approval', detail: 'De pakketgoedkeuring is verlopen.' });
  }
  if (!input.dryRun) {
    issues.push({ code: 'not_dry_run', detail: 'Alleen een dry-runpakket mag deze poort passeren.' });
  }
  if (input.writes !== 0) {
    issues.push({ code: 'writes_detected', detail: 'Het pakket bevat reeds databasewrites.' });
  }
  if (input.automaticMerges !== 0) {
    issues.push({ code: 'automatic_merges_detected', detail: 'Automatische samenvoegingen zijn niet toegestaan.' });
  }
  if (input.proposalTypes.includes('manual_review')) {
    issues.push({
      code: 'manual_review_in_mutation_scope',
      detail: 'Handmatige beoordelingsvoorstellen mogen niet in een uitvoerbaar mutatiepakket zitten.',
    });
  }

  return {
    status: issues.length === 0 ? 'approval_ready' : 'approval_blocked',
    environment: input.environment,
    mutationAllowed: false,
    writes: 0,
    automaticMerges: 0,
    approvedProposalCount: issues.length === 0 ? input.proposalCount : 0,
    issues,
  };
}
