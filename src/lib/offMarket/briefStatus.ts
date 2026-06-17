// Afgeleide briefstatus voor een signaal — gebaseerd op `off_market_brieven`
// gegroepeerd per geadresseerde en op open opvolgtaken.
//
// Belangrijk: campagnestap (Brief 1 / 2 / 3) wordt **per geadresseerde**
// afgeleid via groepering, niet via globale recordvolgorde. De signaalstatus
// is een aggregaat over de meest gevorderde geadresseerde.
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { Taak } from '@/data/mock-data';
import {
  groepeerBrievenPerGeadresseerde, STAP_VOLGORDE,
  type CampagneStap,
} from '@/lib/offMarket/brieven/groepering';

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
 * Hoogst bereikte stap binnen een set brieven van één geadresseerde.
 * 0 = niets, 1 = brief1 concept, 2 = brief1 verstuurd, 3 = brief2 concept,
 * 4 = brief2 verstuurd (of hoger).
 */
function scoreVoorGroep(stappen: Record<CampagneStap, {
  verstuurd: OffMarketBrief | null;
  actiefConcept: OffMarketBrief | null;
}>): number {
  let score = 0;
  for (const stap of STAP_VOLGORDE) {
    const s = stappen[stap];
    if (s.verstuurd) {
      score = stap === 'brief_1' ? 2 : stap === 'brief_2' ? 4 : 4;
    } else if (s.actiefConcept) {
      const want = stap === 'brief_1' ? 1 : stap === 'brief_2' ? 3 : 3;
      if (want > score) score = want;
    }
  }
  return score;
}

/**
 * Leid briefstatus af uit brieven + open opvolgtaken (per signaal).
 *
 * - Werkt op de **gegroepeerde** view (per geadresseerde). De signaalstatus
 *   reflecteert de meest gevorderde geadresseerde.
 * - Wanneer Brief 1 verstuurd is en er een open Brief 2-opvolgtaak voor het
 *   signaal bestaat, wordt 'brief2_gepland' getoond (tenzij er al een
 *   Brief 2 concept of verstuurde Brief 2 is).
 * - Nooit globale Brief 4/5/6-logica: maximum is Brief 2 voor de
 *   signaalstatus.
 */
export function bepaalBriefStatus(
  brieven: OffMarketBrief[],
  taken: Taak[],
  signaalId: string,
): BriefStatus {
  const actieveBrieven = brieven.filter((b) => !b.archived_at);
  if (actieveBrieven.length === 0) {
    // Geen brieven; check eventueel open opvolgtaak (zelden zonder brieven).
    return 'geen';
  }
  const groepen = groepeerBrievenPerGeadresseerde(actieveBrieven);
  let hoogste = 0;
  for (const g of groepen) {
    const s = scoreVoorGroep(g.stappen);
    if (s > hoogste) hoogste = s;
  }

  const openBrief2 = taken.some(
    (t) =>
      t.offMarketSignaalId === signaalId &&
      OPEN_TAAK_STATUSSEN.has(t.status) &&
      isBrief2Taak(t),
  );

  switch (hoogste) {
    case 0: return 'geen';
    case 1: return 'brief1_concept';
    case 2: return openBrief2 ? 'brief2_gepland' : 'brief1_verstuurd';
    case 3: return 'brief2_concept';
    case 4: return 'brief2_verstuurd';
    default: return 'brief2_verstuurd';
  }
}

export function laatsteBrief(brieven: OffMarketBrief[]): OffMarketBrief | null {
  if (brieven.length === 0) return null;
  return brieven[0] ?? null;
}

export function laatsteVerstuurdeBrief(brieven: OffMarketBrief[]): OffMarketBrief | null {
  const sorted = [...brieven]
    .filter((b) => b.status === 'verstuurd' && b.verzonden_op)
    .sort((a, b) => (b.verzonden_op ?? '').localeCompare(a.verzonden_op ?? ''));
  return sorted[0] ?? null;
}
