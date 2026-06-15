// Afgeleide briefstatus voor een signaal — gebaseerd op `off_market_brieven`
// en open opvolgtaken die met "Brief 2" in de titel zijn aangemaakt.
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { Taak } from '@/data/mock-data';

export type BriefStatus =
  | 'geen'
  | 'brief1_concept'
  | 'brief1_verstuurd'
  | 'brief2_gepland'
  | 'brief2_concept'
  | 'brief2_verstuurd';

export const BRIEFSTATUS_LABEL: Record<BriefStatus, string> = {
  geen: 'Geen brief',
  brief1_concept: 'Brief 1 concept',
  brief1_verstuurd: 'Brief 1 verstuurd',
  brief2_gepland: 'Brief 2 gepland',
  brief2_concept: 'Brief 2 concept',
  brief2_verstuurd: 'Brief 2 verstuurd',
};

const OPEN_TAAK_STATUSSEN = new Set(['open', 'in_uitvoering', 'wacht_op_reactie']);

function isBrief2Taak(t: Taak): boolean {
  const titel = (t.titel ?? '').toLowerCase();
  return titel.includes('brief 2') || titel.includes('brief opvolgen');
}

/**
 * Leid briefstatus af uit brieven + open opvolgtaken (per signaal).
 * - Geen brieven & geen open Brief 2-taak → 'geen'
 * - >=1 verstuurd: laatste verstuurd; als open Brief 2-taak bestaat na laatste
 *   verstuurde → 'brief2_gepland', anders 'brief1_verstuurd' (of 'brief2_verstuurd').
 * - Anders eerste concept.
 */
export function bepaalBriefStatus(
  brieven: OffMarketBrief[],
  taken: Taak[],
  signaalId: string,
): BriefStatus {
  const verstuurd = brieven.filter((b) => b.status === 'verstuurd');
  const concepten = brieven.filter((b) => b.status === 'concept');

  const openBrief2 = taken.some(
    (t) =>
      t.offMarketSignaalId === signaalId &&
      OPEN_TAAK_STATUSSEN.has(t.status) &&
      isBrief2Taak(t),
  );

  if (verstuurd.length >= 2) return 'brief2_verstuurd';

  if (verstuurd.length === 1) {
    // Brief 1 verstuurd. Is er al een concept voor brief 2?
    if (concepten.length > 0) return 'brief2_concept';
    if (openBrief2) return 'brief2_gepland';
    return 'brief1_verstuurd';
  }

  // Geen verstuurde brieven
  if (concepten.length > 0) return 'brief1_concept';
  return 'geen';
}

export function laatsteBrief(brieven: OffMarketBrief[]): OffMarketBrief | null {
  if (brieven.length === 0) return null;
  // brieven komen al `created_at` desc binnen — pak eerste.
  return brieven[0] ?? null;
}

export function laatsteVerstuurdeBrief(brieven: OffMarketBrief[]): OffMarketBrief | null {
  const sorted = [...brieven]
    .filter((b) => b.status === 'verstuurd' && b.verzonden_op)
    .sort((a, b) => (b.verzonden_op ?? '').localeCompare(a.verzonden_op ?? ''));
  return sorted[0] ?? null;
}
