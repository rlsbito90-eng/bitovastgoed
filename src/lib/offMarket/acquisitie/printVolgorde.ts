// V2 — Pure, deterministische sorteer-/groepeer­helper voor de bulk-
// briefvoorbereiding én de gecombineerde brief-PDF. Wordt ook in Fase 3
// hergebruikt voor de adreslabels, dus géén UI- of DB-koppeling.
//
// Volgorde:
//   1. Acquisitieselectie: toegevoegd_op ASC (oudste eerst);
//   2. Binnen één signaal: geadresseerde_key alfabetisch (val terug op
//      bedrijfsnaam/naam wanneer key ontbreekt);
//   3. campagne_stap volgens een vaste rangorde.

import { STAP_VOLGORDE, type CampagneStap } from '@/lib/offMarket/brieven/groepering';

const STAP_RANG: Record<string, number> = {
  brief_1: 1, brief_2: 2, brief_3: 3,
  email_1: 11, email_2: 12, email_3: 13,
};

export interface PrintItem<T = unknown> {
  /** id van het bovenliggende signaal — bepaalt de signaal-volgorde. */
  signaalId: string;
  /** ISO-timestamp van toevoeging aan de selectie. Mag null zijn. */
  toegevoegdOp: string | null;
  /** Stabiele geadresseerde-key. Mag null zijn. */
  geadresseerdeKey: string | null;
  /** Fallback voor geadresseerden zonder key. */
  geadresseerdeLabel?: string | null;
  /** Campagne-stap, bv. 'brief_1'. */
  campagneStap?: string | null;
  /** Vrije payload. */
  payload?: T;
}

function rangVoorStap(stap: string | null | undefined): number {
  if (!stap) return 99;
  return STAP_RANG[stap] ?? 99;
}

/**
 * Sorteer een lijst printitems deterministisch. Mutatievrij —
 * retourneert een nieuwe array.
 */
export function sorteerPrintItems<T>(items: PrintItem<T>[]): PrintItem<T>[] {
  return [...items].sort((a, b) => {
    // 1) selectie-volgorde (oudste toevoeging eerst)
    const ta = a.toegevoegdOp ?? '';
    const tb = b.toegevoegdOp ?? '';
    if (ta !== tb) return ta < tb ? -1 : 1;
    // tie-break op signaal-id zodat gelijke timestamps stabiel zijn
    if (a.signaalId !== b.signaalId) return a.signaalId < b.signaalId ? -1 : 1;
    // 2) geadresseerde
    const ga = (a.geadresseerdeKey ?? a.geadresseerdeLabel ?? '').toLowerCase();
    const gb = (b.geadresseerdeKey ?? b.geadresseerdeLabel ?? '').toLowerCase();
    if (ga !== gb) return ga < gb ? -1 : 1;
    // 3) campagne-stap
    return rangVoorStap(a.campagneStap) - rangVoorStap(b.campagneStap);
  });
}

export { STAP_VOLGORDE, type CampagneStap };
