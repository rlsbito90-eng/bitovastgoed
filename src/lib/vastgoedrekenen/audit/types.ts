// Types voor de Vastgoedrekenen Audit & Diagnostics laag.
// Pure types, geen runtime-code.

export type AuditStatus = 'ok' | 'warning' | 'error' | 'na';

export type AuditCategory =
  | 'save_state'        // A
  | 'object_data'       // B
  | 'scenario_settings' // C
  | 'components'        // D
  | 'wws_mapping'       // E
  | 'strategy_mapping'  // F
  | 'rent_source'       // G
  | 'wws'               // H
  | 'ovb'               // I
  | 'costs'             // J
  | 'exit'              // K
  | 'strategy_mix'      // L
  | 'engine'            // M
  | 'snapshot'          // N+O
  | 'max_bid'           // P
  | 'doable'            // Q
  | 'double_counting'   // R
  | 'onderbouwing'      // S
  | 'formatting'        // T
  | 'hinthamerstraat';  // testcase

export const CATEGORY_LABELS: Record<AuditCategory, string> = {
  save_state: 'Save-state',
  object_data: 'Objectdata',
  scenario_settings: 'Scenario-instellingen',
  components: 'Componenten',
  wws_mapping: 'Componenten → WWS',
  strategy_mapping: 'Componenten → Strategie',
  rent_source: 'Huurbron',
  wws: 'WWS',
  ovb: 'OVB',
  costs: 'Kosten',
  exit: 'Verkoop / exit',
  strategy_mix: 'Componentstrategie',
  engine: 'Rekenengine',
  snapshot: 'Snapshot & vergelijking',
  max_bid: 'Maximale bieding',
  doable: 'Rond te rekenen',
  double_counting: 'Dubbele tellingen',
  onderbouwing: 'Onderbouwing',
  formatting: 'NL-formattering',
  hinthamerstraat: 'Testcase Hinthamerstraat',
};

export interface AuditCheck {
  id: string;
  category: AuditCategory;
  status: AuditStatus;
  section: string;
  record?: string;
  field?: string;
  problem: string;
  advice?: string;
  technical?: string;
}

export interface SourceOfTruthRow {
  onderdeel: string;
  actieveBron: string;
  alternatieveBron?: string;
  risico: 'geen' | 'laag' | 'middel' | 'hoog';
  toelichting?: string;
}

export interface MaxBidExplainStep {
  label: string;
  formula?: string;
  value: number | string | null;
  note?: string;
}

export interface AuditReport {
  scenarioId: string;
  scenarioName: string;
  generatedAt: string;
  checks: AuditCheck[];
  sourcesOfTruth: SourceOfTruthRow[];
  maxBidExplain: MaxBidExplainStep[];
  summary: { ok: number; warning: number; error: number; na: number };
  conclusion: string;
}
