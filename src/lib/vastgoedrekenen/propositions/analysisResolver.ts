import type { PropositionType } from './types';
import { resolvePropositionType } from './registry';

export interface AnalysisPropositionMetadata {
  propositionType: PropositionType;
  propositionSchemaVersion: number;
}

export interface PersistedAnalysisPropositionRow {
  proposition_type?: unknown;
  proposition_schema_version?: unknown;
}

export function resolvePropositionSchemaVersion(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 1;
}

export function resolveAnalysisProposition(
  row: PersistedAnalysisPropositionRow | null | undefined,
): AnalysisPropositionMetadata {
  return {
    propositionType: resolvePropositionType(row?.proposition_type),
    propositionSchemaVersion: resolvePropositionSchemaVersion(row?.proposition_schema_version),
  };
}
