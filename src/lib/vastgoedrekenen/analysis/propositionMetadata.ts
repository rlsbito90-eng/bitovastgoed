// Centrale mapping tussen de persistente Analysis-laag (real_estate_calculations)
// en de propositie-registry. Deze module bevat GEEN rekenlogica en wordt nooit
// aan computeScenario() doorgegeven.

import type { Database } from '@/integrations/supabase/types';
import {
  getPropositionLabel,
  resolvePropositionType,
  type PropositionType,
} from '../propositions';

/** Expliciete alias: de persistente Analysis-laag. */
export type PersistedCalculationAnalysis =
  Database['public']['Tables']['real_estate_calculations']['Row'];

/** Minimale vorm die de resolver nodig heeft (ook bruikbaar voor legacy rijen). */
export type PropositionMetadataSource = {
  proposition_type?: unknown;
  proposition_schema_version?: unknown;
};

export type PropositionMetadata = {
  propositionType: PropositionType;
  propositionSchemaVersion: number;
  propositionLabel: string;
  /** True wanneer de opgeslagen waarde ontbrak of onbekend was en is teruggevallen op legacy_generic. */
  fellBackToLegacy: boolean;
};

export const DEFAULT_PROPOSITION_TYPE: PropositionType = 'legacy_generic';
export const DEFAULT_PROPOSITION_SCHEMA_VERSION = 1;

/** Versie normaliseren: ontbrekend, niet-numeriek of <= 0 wordt minimaal 1. */
export function resolvePropositionSchemaVersion(value: unknown): number {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(numeric)) return DEFAULT_PROPOSITION_SCHEMA_VERSION;
  const rounded = Math.trunc(numeric);
  return rounded > 0 ? rounded : DEFAULT_PROPOSITION_SCHEMA_VERSION;
}

/** Enige plek waar propositiemetadata van een analyse wordt afgeleid. */
export function resolveAnalysisPropositionMetadata(
  source: PropositionMetadataSource | null | undefined,
): PropositionMetadata {
  const propositionType = resolvePropositionType(source?.proposition_type);
  const rawType = source?.proposition_type;
  const fellBackToLegacy =
    propositionType === DEFAULT_PROPOSITION_TYPE &&
    (typeof rawType !== 'string' || rawType.trim() !== DEFAULT_PROPOSITION_TYPE);
  return {
    propositionType,
    propositionSchemaVersion: resolvePropositionSchemaVersion(source?.proposition_schema_version),
    propositionLabel: getPropositionLabel(propositionType),
    fellBackToLegacy,
  };
}

/** Databasevelden voor insert/update van propositiemetadata (metadata-only). */
export function propositionPersistencePatch(input: {
  propositionType?: unknown;
  propositionSchemaVersion?: unknown;
}): { proposition_type: PropositionType; proposition_schema_version: number } {
  return {
    proposition_type: resolvePropositionType(input.propositionType),
    proposition_schema_version: resolvePropositionSchemaVersion(input.propositionSchemaVersion),
  };
}
