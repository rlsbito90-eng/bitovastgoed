// Groepeer off-market brieven per geadresseerde en leid de campagnestap
// (brief_1 / brief_2 / brief_3) per geadresseerde af. Volledig client-side,
// gebaseerd op bestaande velden (`status`, `verzonden_op`, `created_at`).
//
// Belangrijke regel: briefnummering is **altijd per geadresseerde**.
// Bij één pand met 4 eigenaren krijgt iedere eigenaar Brief 1, nooit
// Brief 1 t/m Brief 4 op basis van globale recordvolgorde.
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { Taak } from '@/data/mock-data';
import { geadresseerdeKey, geadresseerdeDisplayNaam } from './geadresseerdeKey';

export type CampagneStap = 'brief_1' | 'brief_2' | 'brief_3';

export const CAMPAGNE_STAP_LABEL: Record<CampagneStap, string> = {
  brief_1: 'Brief 1',
  brief_2: 'Brief 2',
  brief_3: 'Brief 3',
};

export const STAP_VOLGORDE: CampagneStap[] = ['brief_1', 'brief_2', 'brief_3'];

export interface StapInhoud {
  /** Verstuurde brief voor deze stap (max. 1 per stap), indien aanwezig. */
  verstuurd: OffMarketBrief | null;
  /** Meest recente niet-verstuurde, niet-gearchiveerde conceptversie. */
  actiefConcept: OffMarketBrief | null;
  /** Oudere conceptversies (oudste eerst). Bevat de actieve niet. */
  oudereConcepten: OffMarketBrief[];
}

export interface GeadresseerdeGroep {
  key: string;
  naam: string;
  bedrijfsnaam: string | null;
  verzendadres: string | null;
  stappen: Record<CampagneStap, StapInhoud>;
  /** Alle brieven van deze geadresseerde (chronologisch oud→nieuw). */
  brieven: OffMarketBrief[];
}

const OPEN_TAAK_STATUSSEN = new Set(['open', 'in_uitvoering', 'wacht_op_reactie']);

function lege(): Record<CampagneStap, StapInhoud> {
  return {
    brief_1: { verstuurd: null, actiefConcept: null, oudereConcepten: [] },
    brief_2: { verstuurd: null, actiefConcept: null, oudereConcepten: [] },
    brief_3: { verstuurd: null, actiefConcept: null, oudereConcepten: [] },
  };
}

function asc(a: OffMarketBrief, b: OffMarketBrief): number {
  return (a.created_at ?? '').localeCompare(b.created_at ?? '');
}

/**
 * Bepaal welke campagnestap een brief krijgt **binnen** de chronologische
 * reeks van één geadresseerde.
 *
 * Regels:
 *  - Sorteer op `created_at` asc.
 *  - Start op `brief_1`.
 *  - Iedere verstuurde brief sluit de huidige stap af; vervolgrecords
 *    vallen in de volgende stap (cap op `brief_3`).
 *  - Concepten in dezelfde stap zijn conceptversies van die stap.
 */
function leidStappenAfVoorGeadresseerde(
  brieven: OffMarketBrief[],
): Record<CampagneStap, StapInhoud> {
  const out = lege();
  const stapIdx = { brief_1: 0, brief_2: 1, brief_3: 2 } as const;
  let huidig: CampagneStap = 'brief_1';

  // Verzamel concepten per stap; later wijzen we actief / ouder aan.
  const conceptenPerStap: Record<CampagneStap, OffMarketBrief[]> = {
    brief_1: [], brief_2: [], brief_3: [],
  };

  for (const b of [...brieven].sort(asc)) {
    if (b.status === 'verstuurd') {
      // Vul de eerste lege verstuurd-slot vanaf huidig.
      let plaats = huidig;
      while (out[plaats].verstuurd && stapIdx[plaats] < 2) {
        plaats = STAP_VOLGORDE[stapIdx[plaats] + 1];
      }
      out[plaats].verstuurd = b;
      // Volgende records vallen in de volgende stap (cap op brief_3).
      huidig = STAP_VOLGORDE[Math.min(stapIdx[plaats] + 1, 2)];
    } else {
      conceptenPerStap[huidig].push(b);
    }
  }

  // Meest recente concept per stap = actief; rest = oudere conceptversies.
  for (const stap of STAP_VOLGORDE) {
    const lijst = conceptenPerStap[stap];
    if (lijst.length === 0) continue;
    const gesorteerd = [...lijst].sort(asc); // oud → nieuw
    const actief = gesorteerd[gesorteerd.length - 1];
    out[stap].actiefConcept = actief;
    out[stap].oudereConcepten = gesorteerd.slice(0, -1);
  }

  return out;
}

export function groepeerBrievenPerGeadresseerde(
  brieven: OffMarketBrief[],
): GeadresseerdeGroep[] {
  const groepen = new Map<string, OffMarketBrief[]>();
  for (const b of brieven) {
    const k = geadresseerdeKey(b);
    const arr = groepen.get(k) ?? [];
    arr.push(b);
    groepen.set(k, arr);
  }

  const out: GeadresseerdeGroep[] = [];
  for (const [key, lijst] of groepen.entries()) {
    const oudOudst = [...lijst].sort(asc);
    const referentie = oudOudst[0];
    out.push({
      key,
      naam: geadresseerdeDisplayNaam(referentie),
      bedrijfsnaam: referentie.eigenaar_bedrijfsnaam ?? null,
      verzendadres: referentie.verzendadres ?? null,
      stappen: leidStappenAfVoorGeadresseerde(oudOudst),
      brieven: oudOudst,
    });
  }

  // Sorteer: geadresseerden met verstuurde Brief 1 eerst, daarna op naam.
  out.sort((a, b) => {
    const av = a.stappen.brief_1.verstuurd ? 0 : 1;
    const bv = b.stappen.brief_1.verstuurd ? 0 : 1;
    if (av !== bv) return av - bv;
    return a.naam.localeCompare(b.naam, 'nl');
  });
  return out;
}

// ---------------------------------------------------------------------
// Samenvatting voor de sectie-header
// ---------------------------------------------------------------------

export interface BrievenSamenvatting {
  aantalGeadresseerden: number;
  brief1Verstuurd: number;
  actieveConcepten: number;
  /** Eerstvolgende open opvolgtaak voor dit signaal (datum YYYY-MM-DD). */
  eerstvolgendeOpvolging: { titel: string; deadline: string | null; taakId: string } | null;
}

export function samenvatting(
  groepen: GeadresseerdeGroep[],
  openTaken: Taak[],
  signaalId: string,
): BrievenSamenvatting {
  let brief1Verstuurd = 0;
  let actieveConcepten = 0;
  for (const g of groepen) {
    for (const stap of STAP_VOLGORDE) {
      const s = g.stappen[stap];
      if (s.actiefConcept) actieveConcepten += 1;
    }
    if (g.stappen.brief_1.verstuurd) brief1Verstuurd += 1;
  }

  const open = openTaken
    .filter((t) => t.offMarketSignaalId === signaalId)
    .filter((t) => OPEN_TAAK_STATUSSEN.has(t.status))
    .filter((t) => !(t as any).softDeletedAt)
    .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
  const eerst = open[0] ?? null;

  return {
    aantalGeadresseerden: groepen.length,
    brief1Verstuurd,
    actieveConcepten,
    eerstvolgendeOpvolging: eerst
      ? { titel: eerst.titel, deadline: eerst.deadline || null, taakId: eerst.id }
      : null,
  };
}

/** Vind voor een specifieke geadresseerde-key de bestaande groep. */
export function groepVoorKey(
  groepen: GeadresseerdeGroep[],
  key: string,
): GeadresseerdeGroep | null {
  return groepen.find((g) => g.key === key) ?? null;
}

/** Stap waarvoor een nieuwe brief moet worden aangemaakt voor deze geadresseerde. */
export function volgendeStapVoor(groep: GeadresseerdeGroep | null): CampagneStap {
  if (!groep) return 'brief_1';
  for (const stap of STAP_VOLGORDE) {
    if (!groep.stappen[stap].verstuurd) return stap;
  }
  return 'brief_3';
}
