import type { PropositionType, SourceReference } from "../propositions/types";

/**
 * Ownership boundary:
 * - Object owns factual property data, documents, leases and legal/physical facts.
 * - Scenario owns assumptions, strategy, future values, costs and target profit.
 * - Deal owns commercial status, bids, fee, parties, deadlines and decisions.
 * - Vastgoedrekenen owns computed outputs, validations, sensitivities and engine version.
 * Snapshots capture the exact evidence used at a decision moment.
 */
export interface CalculationAnalysis {
  id: string;
  objectId: string;
  name: string;
  propositionType: PropositionType;
  propositionSchemaVersion: number;
  /** Centrale vraag die deze Quickscan moet beantwoorden. */
  analysisQuestion?: string | null;
  /** Waarderings-/analysepeildatum in YYYY-MM-DD-formaat. */
  valuationDate?: string | null;
  /** Totale beschouwde periode; nog niet gekoppeld aan DCF of financiering. */
  timeHorizonMonths?: number | null;
  createdAt: string;
  createdBy?: string;
}

export interface MetricRevisionReference {
  metricId: string;
  revisionId: string;
}

export interface AssumptionOverrideReference {
  path: string;
  reason: string;
  source?: SourceReference;
}

export interface ObjectFactSnapshot {
  objectId: string;
  capturedAt: string;
  sourceVersion?: string;
  facts: Record<string, unknown>;
}

export interface AssumptionSnapshot {
  scenarioId: string;
  capturedAt: string;
  assumptions: Record<string, unknown>;
  metricRevisions?: MetricRevisionReference[];
  overrides?: AssumptionOverrideReference[];
}

export interface EngineSnapshot {
  engineVersion: string;
  propositionType: PropositionType;
  propositionSchemaVersion: number;
  calculationRulesVersion?: string;
}

export interface CalculationSnapshot<TOutputs = Record<string, unknown>> {
  id: string;
  analysisId: string;
  scenarioId: string;
  createdAt: string;
  objectFacts: ObjectFactSnapshot;
  assumptions: AssumptionSnapshot;
  engine: EngineSnapshot;
  outputs: TOutputs;
}

export interface DecisionSnapshotReference {
  dealId: string;
  calculationSnapshotId: string;
  decisionType: string;
  decidedAt: string;
}
