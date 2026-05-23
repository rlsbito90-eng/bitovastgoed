// src/lib/derivations/matching.ts
//
// Centrale drempels en helpers voor matching-score interpretatie.
//
// Convenanten:
//   - Matchscore is altijd op een 0–100 schaal (zie `berekenMatchScore` in
//     `src/data/mock-data.ts`). Er is bewust GEEN conversie naar 0–5.
//   - "Sterke match" = score ≥ STRONG_MATCH_THRESHOLD.
//   - Notificatie-trigger (`NotificationsBell`), kandidaten-/topmatches-sectie
//     en eventuele rapporten gebruiken deze constante om consistent te blijven.
//
// Geen UI-dependencies.

/** Drempel waarboven een match als "sterk" geldt. 0–100 schaal. */
export const STRONG_MATCH_THRESHOLD = 70;

/** Optionele drempel voor "uitmuntende match" — gereserveerd voor latere UI. */
export const EXCELLENT_MATCH_THRESHOLD = 85;

/** Returnt `true` als score numeriek is en ≥ drempel. */
export function isStrongMatch(score: unknown, threshold: number = STRONG_MATCH_THRESHOLD): boolean {
  const n = typeof score === 'number' ? score : Number(score);
  return Number.isFinite(n) && n >= threshold;
}

/** Returnt `true` als score ≥ EXCELLENT_MATCH_THRESHOLD. */
export function isExcellentMatch(score: unknown): boolean {
  return isStrongMatch(score, EXCELLENT_MATCH_THRESHOLD);
}
