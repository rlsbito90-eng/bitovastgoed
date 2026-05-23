// src/lib/derivations/deal.ts
//
// Pure selectors voor dealflow/cockpit-data. Geen UI-dependencies.
//
// Functies:
//   - selectLeadDeal: kies de meest relevante actieve deal voor een object.
//   - calculateExpectedFee: gewogen verwachte fee Σ commissieBedrag × FASE_KANS.
//   - countKandidaten: unieke kandidaten uit pipeline-rijen + sterke matches,
//     zonder dubbeltelling (gededupliceerd op relatieId).
//   - getActivePipelineCandidates: filtert pipeline-rijen op actieve fases.

import { FASE_KANS, type Deal, type DealFase, type PipelineKandidaat, type MatchResult } from '@/data/mock-data';
import { STRONG_MATCH_THRESHOLD, isStrongMatch } from './matching';

// ── Fase-classificatie ──────────────────────────────────────────────────────

const INACTIEVE_FASES: ReadonlySet<DealFase> = new Set<DealFase>(['afgerond', 'afgevallen']);

/** Fases die als "actief" gelden voor lead-deal-selectie en gewogen fee. */
export function isActiveDealFase(fase: DealFase): boolean {
  return !INACTIEVE_FASES.has(fase);
}

// ── Lead deal ───────────────────────────────────────────────────────────────

/**
 * Kies de "lead deal" voor een object. Voorkeur:
 *   1. Actief (niet afgerond / afgevallen)
 *   2. Hoogste fasekans (verst in funnel)
 *   3. Recentste eerste contact
 *
 * Als er geen actieve deal is, valt de selector terug op de meest
 * recente niet-actieve deal zodat de cockpit altijd iets kan tonen.
 */
export function selectLeadDeal<T extends Deal>(
  deals: T[] | null | undefined,
  objectId: string,
): T | null {
  if (!Array.isArray(deals) || !objectId) return null;
  const own = deals.filter((d) => d.objectId === objectId && !d.softDeletedAt && !d.isArchived);
  if (own.length === 0) return null;

  const active = own.filter((d) => isActiveDealFase(d.fase));
  const pool = active.length > 0 ? active : own;

  return [...pool].sort((a, b) => {
    const ka = FASE_KANS[a.fase] ?? 0;
    const kb = FASE_KANS[b.fase] ?? 0;
    if (kb !== ka) return kb - ka;
    const ta = a.datumEersteContact ? Date.parse(a.datumEersteContact) : 0;
    const tb = b.datumEersteContact ? Date.parse(b.datumEersteContact) : 0;
    return tb - ta;
  })[0] ?? null;
}

// ── Verwachte fee ───────────────────────────────────────────────────────────

/**
 * Gewogen verwachte fee = Σ (commissieBedrag × FASE_KANS[fase]) over actieve deals.
 * Inactieve fases (afgerond/afgevallen) worden standaard uitgesloten.
 */
export function calculateExpectedFee(
  deals: Deal[] | null | undefined,
  options: { includeInactive?: boolean } = {},
): number {
  if (!Array.isArray(deals)) return 0;
  const list = options.includeInactive ? deals : deals.filter((d) => isActiveDealFase(d.fase));
  let sum = 0;
  for (const d of list) {
    const fee = typeof d.commissieBedrag === 'number' && Number.isFinite(d.commissieBedrag)
      ? d.commissieBedrag
      : 0;
    const kans = FASE_KANS[d.fase] ?? 0;
    sum += fee * kans;
  }
  return sum;
}

// ── Pipeline-helpers ────────────────────────────────────────────────────────

const PIPELINE_INACTIEVE_FASES: ReadonlySet<string> = new Set([
  'afgerond',
  'afgevallen',
  'niet_geinteresseerd',
]);

export function getActivePipelineCandidates<T extends PipelineKandidaat>(
  rows: T[] | null | undefined,
): T[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((r) => !PIPELINE_INACTIEVE_FASES.has(String(r.pipelineFase)));
}

// ── Kandidaatcount (gededupliceerd) ─────────────────────────────────────────

export interface CountKandidatenInput {
  /** Pipeline-rijen voor het object. */
  pipelineRows?: PipelineKandidaat[] | null;
  /** Match-resultaten (alle profielen × objecten). Filter op object-niveau gebeurt hier. */
  matches?: MatchResult[] | null;
  /** Object-id waarop gefilterd wordt voor matches en pipeline. */
  objectId?: string;
  /** Drempel voor "sterke match". Default `STRONG_MATCH_THRESHOLD` (70). */
  threshold?: number;
  /** Alleen actieve pipeline-rijen meetellen. Default true. */
  onlyActivePipeline?: boolean;
}

export interface KandidaatCount {
  total: number;
  fromPipeline: number;
  fromMatches: number;
  uniekeRelaties: string[];
}

/**
 * Tel unieke kandidaten voor één object:
 *   - actieve pipeline-rijen (relatieId)
 *   - sterke matches (score ≥ drempel) voor hetzelfde object
 * Dedupliceert op `relatieId`.
 */
export function countKandidaten(input: CountKandidatenInput): KandidaatCount {
  const threshold = input.threshold ?? STRONG_MATCH_THRESHOLD;
  const onlyActive = input.onlyActivePipeline ?? true;
  const objectId = input.objectId;

  const pipelineRows = onlyActive
    ? getActivePipelineCandidates(input.pipelineRows ?? [])
    : (input.pipelineRows ?? []);
  const filteredPipeline = objectId
    ? pipelineRows.filter((r) => r.objectId === objectId)
    : pipelineRows;

  const pipelineRelaties = new Set<string>();
  for (const r of filteredPipeline) {
    if (r.relatieId) pipelineRelaties.add(r.relatieId);
  }

  const matchRelaties = new Set<string>();
  const matches = Array.isArray(input.matches) ? input.matches : [];
  for (const m of matches) {
    if (objectId && (m as { objectId?: string }).objectId !== objectId) continue;
    if (!isStrongMatch(m.score, threshold)) continue;
    const relId = (m as { relatieId?: string }).relatieId;
    if (relId) matchRelaties.add(relId);
  }

  const unie = new Set<string>([...pipelineRelaties, ...matchRelaties]);
  return {
    total: unie.size,
    fromPipeline: pipelineRelaties.size,
    fromMatches: matchRelaties.size,
    uniekeRelaties: [...unie],
  };
}
