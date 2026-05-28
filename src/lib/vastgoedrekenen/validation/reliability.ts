// Betrouwbaarheidsscore voor een scenario.
// Pure samenvatting bovenop bestaande validatie- en auditdata.

import type { ValidationItem } from '../validation';
import type { AuditReport } from '../audit/types';
import type { CaseRequirement } from './caseRequirements';

export type ReliabilityLevel = 'hoog' | 'middel' | 'laag' | 'niet_betrouwbaar';

export interface ReliabilityResult {
  level: ReliabilityLevel;
  label: string;
  reasons: string[];
  blockerCount: number;
  warningCount: number;
  infoCount: number;
}

const LABEL: Record<ReliabilityLevel, string> = {
  hoog: 'Betrouwbaarheid hoog',
  middel: 'Betrouwbaarheid middel',
  laag: 'Betrouwbaarheid laag',
  niet_betrouwbaar: 'Niet betrouwbaar',
};

export interface ReliabilityInput {
  validation: ValidationItem[];
  audit?: AuditReport | null;
  requirement?: CaseRequirement | null;
  /** Optioneel: handmatige waarden zonder onderbouwing. */
  manualWithoutSource?: boolean;
  /** Optioneel: dubbele waardebron actief (bv. scenario-verkoopwaarde + strategie). */
  dualSource?: boolean;
}

export function computeReliability(input: ReliabilityInput): ReliabilityResult {
  const reasons: string[] = [];
  const blockers = input.validation.filter((v) => v.level === 'blocker');
  const warnings = input.validation.filter((v) => v.level === 'warning');
  const infos = input.validation.filter((v) => v.level === 'info');

  const auditErrors = input.audit?.summary.error ?? 0;
  const auditWarnings = input.audit?.summary.warning ?? 0;

  const blockerCount = blockers.length + auditErrors;
  const warningCount = warnings.length + auditWarnings;
  const infoCount = infos.length;

  if (blockers.length > 0) reasons.push(`${blockers.length} blokkerende validatie-issue(s)`);
  if (auditErrors > 0) reasons.push(`${auditErrors} foutmelding(en) in audit`);
  if (auditWarnings > 0) reasons.push(`${auditWarnings} waarschuwing(en) in audit`);
  if (input.manualWithoutSource) reasons.push('Handmatige waarden zonder vastgelegde onderbouwing');
  if (input.dualSource) reasons.push('Dubbele waardebron actief — kies één leidende bron');
  if (input.requirement) reasons.push(`Casustype: ${input.requirement.label}`);

  let level: ReliabilityLevel;
  if (blockerCount > 0) level = 'niet_betrouwbaar';
  else if (warningCount >= 3 || input.manualWithoutSource || input.dualSource) level = 'laag';
  else if (warningCount > 0) level = 'middel';
  else level = 'hoog';

  return {
    level,
    label: LABEL[level],
    reasons,
    blockerCount,
    warningCount,
    infoCount,
  };
}

export function reliabilityBadgeClass(level: ReliabilityLevel): string {
  switch (level) {
    case 'hoog':
      return 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800';
    case 'middel':
      return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800';
    case 'laag':
      return 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-800';
    case 'niet_betrouwbaar':
      return 'bg-destructive/15 text-destructive border-destructive/40';
  }
}
