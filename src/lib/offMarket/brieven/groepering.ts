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
import {
  EMAIL_STAP_VOLGORDE, EMAIL_STAP_LABEL, type EmailStap,
} from '@/lib/offMarket/email/emailProfielen';

export type CampagneStap = 'brief_1' | 'brief_2' | 'brief_3';

export const CAMPAGNE_STAP_LABEL: Record<CampagneStap, string> = {
  brief_1: 'Brief 1',
  brief_2: 'Brief 2',
  brief_3: 'Brief 3',
};

export const STAP_VOLGORDE: CampagneStap[] = ['brief_1', 'brief_2', 'brief_3'];

/** Label voor één campagnestap, ongeacht kanaal. */
export function stapLabel(stap: string | null | undefined): string {
  if (!stap) return '';
  if (stap in CAMPAGNE_STAP_LABEL) return (CAMPAGNE_STAP_LABEL as any)[stap];
  if (stap in EMAIL_STAP_LABEL) return (EMAIL_STAP_LABEL as any)[stap];
  return stap;
}

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
  /** Poststappen — brief_1/2/3. */
  stappen: Record<CampagneStap, StapInhoud>;
  /** E-mailstappen — email_1/2/3 (V2.2). */
  emailStappen: Record<EmailStap, StapInhoud>;
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

function legeEmail(): Record<EmailStap, StapInhoud> {
  return {
    email_1: { verstuurd: null, actiefConcept: null, oudereConcepten: [] },
    email_2: { verstuurd: null, actiefConcept: null, oudereConcepten: [] },
    email_3: { verstuurd: null, actiefConcept: null, oudereConcepten: [] },
  };
}

function isEmailBrief(b: OffMarketBrief): boolean {
  return (b.kanaal ?? 'post') === 'email';
}

/**
 * Leid e-mailstappen af voor één geadresseerde — onafhankelijk van
 * postnummering. Een verzonden e-mail telt als "verstuurd" voor die stap;
 * conceptversies vallen in de eerstvolgende lege stap (cap email_3).
 */
function leidEmailStappenAf(
  brieven: OffMarketBrief[],
): Record<EmailStap, StapInhoud> {
  const out = legeEmail();
  const stapIdx = { email_1: 0, email_2: 1, email_3: 2 } as const;
  const conceptenPerStap: Record<EmailStap, OffMarketBrief[]> = {
    email_1: [], email_2: [], email_3: [],
  };
  let huidig: EmailStap = 'email_1';
  const emailBrieven = brieven.filter(isEmailBrief).sort(asc);
  for (const b of emailBrieven) {
    // Respecteer expliciete campagne_stap wanneer aanwezig.
    const expliciet = typeof b.campagne_stap === 'string' && b.campagne_stap.startsWith('email_')
      ? (b.campagne_stap as EmailStap) : null;
    if (b.status === 'verstuurd') {
      let plaats: EmailStap = expliciet ?? huidig;
      while (out[plaats].verstuurd && stapIdx[plaats] < 2) {
        plaats = EMAIL_STAP_VOLGORDE[stapIdx[plaats] + 1];
      }
      out[plaats].verstuurd = b;
      huidig = EMAIL_STAP_VOLGORDE[Math.min(stapIdx[plaats] + 1, 2)];
    } else {
      const plaats: EmailStap = expliciet ?? huidig;
      conceptenPerStap[plaats].push(b);
    }
  }
  for (const stap of EMAIL_STAP_VOLGORDE) {
    const lijst = conceptenPerStap[stap];
    if (lijst.length === 0) continue;
    const gesorteerd = [...lijst].sort(asc);
    out[stap].actiefConcept = gesorteerd[gesorteerd.length - 1];
    out[stap].oudereConcepten = gesorteerd.slice(0, -1);
  }
  return out;
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
      stappen: leidStappenAfVoorGeadresseerde(oudOudst.filter((b) => !isEmailBrief(b))),
      emailStappen: leidEmailStappenAf(oudOudst),
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
  /** Aantal geadresseerden met verstuurde post-Brief 1. */
  brief1Verstuurd: number;
  /** Totaal aantal e-mails met status `verstuurd` (per geadresseerde gesommeerd, V2.2). */
  emailsVerstuurd: number;
  actieveConcepten: number;
  /** Aantal geadresseerden met een ingevulde responsstatus (≠ geen_reactie). */
  reacties: number;
  /** Aantal brieven met opvolgdatum waarop geen actieve respons is. */
  openOpvolgingen: number;
  /** Eerstvolgende open opvolgtaak voor dit signaal (datum YYYY-MM-DD). */
  eerstvolgendeOpvolging: { titel: string; deadline: string | null; taakId: string } | null;
}

export function samenvatting(
  groepen: GeadresseerdeGroep[],
  openTaken: Taak[],
  signaalId: string,
): BrievenSamenvatting {
  let brief1Verstuurd = 0;
  let emailsVerstuurd = 0;
  let actieveConcepten = 0;
  let reacties = 0;
  let openOpvolgingen = 0;
  for (const g of groepen) {
    for (const stap of STAP_VOLGORDE) {
      const s = g.stappen[stap];
      if (s.actiefConcept) actieveConcepten += 1;
    }
    if (g.stappen.brief_1.verstuurd) brief1Verstuurd += 1;
    for (const stap of EMAIL_STAP_VOLGORDE) {
      const s = g.emailStappen[stap];
      if (s.actiefConcept) actieveConcepten += 1;
      if (s.verstuurd) emailsVerstuurd += 1;
    }
    // Reacties + open opvolgingen op basis van briefvelden (V2).
    const heeftReactie = g.brieven.some((b: any) =>
      b.responsstatus && b.responsstatus !== 'geen_reactie',
    );
    if (heeftReactie) reacties += 1;
    const heeftOpenOpvolg = g.brieven.some((b: any) =>
      b.opvolgdatum && (!b.responsstatus || b.responsstatus === 'geen_reactie'),
    );
    if (heeftOpenOpvolg) openOpvolgingen += 1;
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
    emailsVerstuurd,
    actieveConcepten,
    reacties,
    openOpvolgingen,
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
