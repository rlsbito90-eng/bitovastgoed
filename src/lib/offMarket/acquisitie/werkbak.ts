// Fase 1 — Werkbakken, subfilters, procesdatums en Werkvolgorde-sortering
// voor de Off-Market Radar Acquisitieselectie.
//
// Deze module bouwt bovenop de bestaande readiness/fase-logica
// (`bepaalSignaalReadiness`). Geen wijzigingen aan die logica; deze module
// interpreteert de resulterende fase samen met de actuele (niet-
// gearchiveerde) brieven en het toegevoegd_op-tijdstip uit de selectie.
//
// Belangrijke conventies:
//   - `updated_at` wordt NERGENS als procesdatum of sorteersleutel gebruikt.
//   - Historische events beïnvloeden actuele brieven niet: alle datums komen
//     uit de brief-record zelf (postdatum, printdatum, opvolgdatum,
//     responsdatum, created_at) of uit `toegevoegd_op` van de selectie.
//   - Wanneer betrouwbare informatie ontbreekt tonen we geen procesdatum
//     (`procesDatum = null`) en toont de UI een tekstueel alternatief.
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type {
  ReadinessFase,
  SignaalReadiness,
} from '@/lib/offMarket/acquisitie/readiness';
import { vandaagNl, isDatumInToekomstNl } from '@/lib/datum/nlDatum';

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

export type Werkbak = 'actie' | 'wachten' | 'afgehandeld';
export type WerkbakView = Werkbak | 'alles';

export type ActieSubfilter =
  | 'alle'
  | 'onderzoeken'
  | 'brief_voorbereiden'
  | 'printen_posten'
  | 'opvolgen';

/** Categorieën binnen Actie voor Werkvolgorde-sortering. */
export type ActieCategorie =
  | 'opvolging_verlopen'
  | 'opvolging_vandaag'
  | 'opvolging_plannen'
  | 'geprint_nog_posten'
  | 'gereed_voor_print'
  | 'concept_controleren'
  | 'brief_voorbereiden'
  | 'onderzoek';

export interface ProcesDatum {
  /** Machine-datum (YYYY-MM-DD) — bruikbaar voor sorteren. Null als er geen datum is. */
  iso: string | null;
  /** Compacte tekst voor rijweergave (bv. "Geprint 3 dagen geleden"). */
  label: string;
  /** Volledige tekst voor tooltip/aria-label (bv. "Geprint op 19 juli 2026"). */
  a11yLabel: string;
}

export interface WerkbakContext {
  werkbak: Werkbak;
  /** Alleen gevuld wanneer werkbak='actie'. */
  actieCategorie: ActieCategorie | null;
  /** Subfilter binnen Actie (alle/onderzoeken/brief_voorbereiden/printen_posten/opvolgen). */
  actieSubfilter: ActieSubfilter | null;
  /** Rijprocesdatum voor de contextuele tweede regel. */
  procesDatum: ProcesDatum | null;
}

// ---------------------------------------------------------------------
// Fase → werkbak-basismapping
// ---------------------------------------------------------------------

/** Uitputtende mapping ReadinessFase → default-werkbak (zonder extra context). */
export const FASE_WERKBAK: Record<ReadinessFase, Werkbak> = {
  onderzoek_nodig: 'actie',
  eigenaar_ontbreekt: 'actie',
  adres_ontbreekt: 'actie',
  brief_voorbereiden: 'actie',
  concept_gereed: 'actie',
  gereed_voor_print: 'actie',
  geprint: 'actie',
  gepost: 'actie', // wordt Wachten wanneer alle actieve brieven een toekomstige opvolgdatum hebben
  email_verzonden: 'actie', // idem
  opvolging_open: 'actie',
  afgerond: 'afgehandeld',
};

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function vandaagISO(): string {
  // Nederlandse werkdag (Europe/Amsterdam), correct rond middernacht.
  return vandaagNl();
}

function isDatumInToekomst(iso: string, vandaag = vandaagISO()): boolean {
  return isDatumInToekomstNl(iso, vandaag);
}

function actieveBrieven(brieven: OffMarketBrief[]): OffMarketBrief[] {
  return brieven.filter(b => !b.archived_at);
}

/**
 * Bepaal of een signaal met fase 'gepost' of 'email_verzonden' feitelijk
 * in de Wachten-werkbak thuishoort. Defensief: elke actuele brief moet
 * inhoudelijk beantwoord zijn óf zich in een echte wachttoestand
 * bevinden (verstuurd/gepost met toekomstige opvolgdatum). Een actief
 * concept, printactie, postactie of ontbrekende opvolgdatum bij een
 * andere geadresseerde blokkeert Wachten — het signaal hoort dan in Actie.
 */
function heeftUitsluitendToekomstigeOpvolging(
  brieven: OffMarketBrief[],
  vandaag = vandaagISO(),
): boolean {
  const actief = actieveBrieven(brieven);
  if (actief.length === 0) return false;
  let heeftToekomstig = false;
  for (const b of actief) {
    const respons = b.responsstatus ?? null;
    // Inhoudelijk beantwoord: brief is klaar, telt niet mee voor Wachten.
    if (respons && respons !== 'geen_reactie') continue;

    // Alleen daadwerkelijk verzonden/geposte brieven kunnen "wachten".
    const status = b.status ?? null;
    const vs = (b.verzendstatus ?? '') as string;
    const isVerzonden = status === 'verstuurd' || vs === 'gepost' || vs === 'verzonden';
    if (!isVerzonden) return false; // concept, printactie of postactie nodig

    const opv = b.opvolgdatum ?? null;
    if (!opv) return false; // opvolgdatum ontbreekt → plannen, geen Wachten
    if (!isDatumInToekomst(opv, vandaag)) return false; // vandaag/verlopen → Actie
    heeftToekomstig = true;
  }
  return heeftToekomstig;
}

/** Eerstvolgende toekomstige opvolgdatum (zonder respons). */
function eerstvolgendeToekomstigeOpvolgdatum(
  brieven: OffMarketBrief[],
  vandaag = vandaagISO(),
): string | null {
  let laagste: string | null = null;
  for (const b of actieveBrieven(brieven)) {
    const opv = b.opvolgdatum ?? null;
    const respons = b.responsstatus ?? null;
    if (respons && respons !== 'geen_reactie') continue;
    if (!opv) continue;
    if (!isDatumInToekomst(opv, vandaag)) continue;
    if (laagste === null || opv < laagste) laagste = opv;
  }
  return laagste;
}

/** Vroegste openstaande opvolgdatum (<= vandaag) zonder respons. */
function vroegsteOpvolgdatumOpen(
  brieven: OffMarketBrief[],
  vandaag = vandaagISO(),
): string | null {
  let laagste: string | null = null;
  for (const b of actieveBrieven(brieven)) {
    const opv = b.opvolgdatum ?? null;
    const respons = b.responsstatus ?? null;
    if (respons && respons !== 'geen_reactie') continue;
    if (!opv) continue;
    if (opv > vandaag) continue;
    if (laagste === null || opv < laagste) laagste = opv;
  }
  return laagste;
}

/** Vroegste printdatum van actieve post-brieven die nog niet gepost zijn. */
function vroegstePrintdatum(brieven: OffMarketBrief[]): string | null {
  const kandidaten = actieveBrieven(brieven).filter(b => {
    const kanaal = (b.kanaal ?? 'post') as string;
    if (kanaal !== 'post') return false;
    if (b.status === 'verstuurd') return false;
    const vs = (b.verzendstatus ?? '') as string;
    return vs === 'geprint' || vs === 'in_envelop';
  });
  let laagste: string | null = null;
  for (const b of kandidaten) {
    const d = b.printdatum ?? null;
    if (!d) continue;
    if (laagste === null || d < laagste) laagste = d;
  }
  if (laagste) return laagste;
  // Fallback: created_at van meest recente kandidaat.
  const sorted = [...kandidaten].sort((a, b) =>
    (b.created_at ?? '').localeCompare(a.created_at ?? ''),
  );
  const c = sorted[0]?.created_at ?? null;
  return c ? c.slice(0, 10) : null;
}

/** Meest recente conceptdatum van actieve post-concepten. */
function conceptdatum(brieven: OffMarketBrief[]): string | null {
  const kandidaten = actieveBrieven(brieven).filter(b => {
    const kanaal = (b.kanaal ?? 'post') as string;
    return kanaal === 'post' && b.status === 'concept';
  });
  if (kandidaten.length === 0) return null;
  const sorted = [...kandidaten].sort((a, b) =>
    (b.created_at ?? '').localeCompare(a.created_at ?? ''),
  );
  const c = sorted[0]?.created_at ?? null;
  return c ? c.slice(0, 10) : null;
}

/**
 * Bron van de afrondingsdatum voor semantische labeling.
 *  - `respons`: laatste inhoudelijke responsdatum van een actieve brief.
 *  - `gearchiveerd`: fallback op `signaal.gearchiveerd_op` als er geen
 *    responsdatum bekend is.
 */
type AfrondingsBron = 'respons' | 'gearchiveerd';

interface Afronding {
  iso: string;
  bron: AfrondingsBron;
}

/**
 * Meest recente afrondingsdatum met expliciete bron. Retourneert `null`
 * wanneer er geen betrouwbare datum is; gebruik dan alleen de tekst
 * "Afgehandeld" in de UI (geen technische fallback op `created_at`).
 */
function afrondingsdatum(brieven: OffMarketBrief[], signaal: OffMarketSignaal): Afronding | null {
  const actief = actieveBrieven(brieven);
  let laatste: string | null = null;
  for (const b of actief) {
    const r = b.responsdatum ?? null;
    if (r && (!laatste || r > laatste)) laatste = r.slice(0, 10);
  }
  if (laatste) return { iso: laatste, bron: 'respons' };
  const gearchiveerd = (signaal as { gearchiveerd_op?: string | null }).gearchiveerd_op ?? null;
  if (gearchiveerd) return { iso: gearchiveerd.slice(0, 10), bron: 'gearchiveerd' };
  return null;
}

function relatiefLabel(iso: string): { relatief: string; volledig: string } {
  try {
    const d = parseISO(iso.length > 10 ? iso : `${iso}T12:00:00Z`);
    return {
      relatief: formatDistanceToNow(d, { addSuffix: true, locale: nl }),
      volledig: format(d, 'd MMMM yyyy', { locale: nl }),
    };
  } catch {
    return { relatief: iso, volledig: iso };
  }
}

function korteDatum(iso: string): string {
  try {
    const d = parseISO(iso.length > 10 ? iso : `${iso}T12:00:00Z`);
    return format(d, 'd MMM', { locale: nl });
  } catch {
    return iso;
  }
}

function volledigeDatum(iso: string): string {
  try {
    const d = parseISO(iso.length > 10 ? iso : `${iso}T12:00:00Z`);
    return format(d, 'd MMMM yyyy', { locale: nl });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------
// Hoofdfunctie
// ---------------------------------------------------------------------

export interface BepaalWerkbakInput {
  signaal: OffMarketSignaal;
  readiness: SignaalReadiness;
  brieven: OffMarketBrief[];
  toegevoegdOp: string | null;
  /** Alleen voor tests — override "vandaag". */
  vandaag?: string;
}

export function bepaalWerkbakContext(input: BepaalWerkbakInput): WerkbakContext {
  const { signaal, readiness, brieven, vandaag = vandaagISO() } = input;
  const fase = readiness.fase;
  const baseWerkbak = FASE_WERKBAK[fase];

  // 1) Afgehandeld
  if (baseWerkbak === 'afgehandeld') {
    const iso = afrondingsdatum(brieven, signaal);
    return {
      werkbak: 'afgehandeld',
      actieCategorie: null,
      actieSubfilter: null,
      procesDatum: iso
        ? {
            iso,
            label: `Reactie op ${korteDatum(iso)}`,
            a11yLabel: `Reactie op ${volledigeDatum(iso)}`,
          }
        : {
            iso: null,
            label: 'Afgehandeld',
            a11yLabel: 'Afgehandeld',
          },
    };
  }

  // 2) Gepost / email_verzonden — mogelijk Wachten
  if ((fase === 'gepost' || fase === 'email_verzonden')
      && heeftUitsluitendToekomstigeOpvolging(brieven, vandaag)) {
    const iso = eerstvolgendeToekomstigeOpvolgdatum(brieven, vandaag);
    return {
      werkbak: 'wachten',
      actieCategorie: null,
      actieSubfilter: null,
      procesDatum: iso
        ? {
            iso,
            label: `Wachten tot ${korteDatum(iso)}`,
            a11yLabel: `Wachten tot ${volledigeDatum(iso)}`,
          }
        : null,
    };
  }

  // 3) Actie — bepaal categorie + subfilter + procesdatum
  const { categorie, subfilter, procesDatum } = bepaalActie(
    fase, brieven, vandaag,
  );
  return {
    werkbak: 'actie',
    actieCategorie: categorie,
    actieSubfilter: subfilter,
    procesDatum,
  };
}

function bepaalActie(
  fase: ReadinessFase,
  brieven: OffMarketBrief[],
  vandaag: string,
): { categorie: ActieCategorie; subfilter: ActieSubfilter; procesDatum: ProcesDatum | null } {
  switch (fase) {
    case 'onderzoek_nodig':
    case 'eigenaar_ontbreekt':
    case 'adres_ontbreekt':
      return {
        categorie: 'onderzoek',
        subfilter: 'onderzoeken',
        procesDatum: {
          iso: null,
          label: 'Nog niet onderzocht',
          a11yLabel: 'Nog niet onderzocht',
        },
      };

    case 'brief_voorbereiden':
      return {
        categorie: 'brief_voorbereiden',
        subfilter: 'brief_voorbereiden',
        procesDatum: {
          iso: null,
          label: 'Nog geen concept',
          a11yLabel: 'Nog geen concept',
        },
      };

    case 'concept_gereed': {
      const iso = conceptdatum(brieven);
      return {
        categorie: 'concept_controleren',
        subfilter: 'brief_voorbereiden',
        procesDatum: iso
          ? {
              iso,
              label: `Concept ${relatiefLabel(iso).relatief}`,
              a11yLabel: `Concept op ${volledigeDatum(iso)}`,
            }
          : {
              iso: null,
              label: 'Concept controleren',
              a11yLabel: 'Concept controleren',
            },
      };
    }

    case 'gereed_voor_print': {
      const iso = conceptdatum(brieven);
      return {
        categorie: 'gereed_voor_print',
        subfilter: 'printen_posten',
        procesDatum: iso
          ? {
              iso,
              label: `Klaar voor print · concept ${relatiefLabel(iso).relatief}`,
              a11yLabel: `Klaar voor print, concept op ${volledigeDatum(iso)}`,
            }
          : {
              iso: null,
              label: 'Klaar voor print',
              a11yLabel: 'Klaar voor print',
            },
      };
    }

    case 'geprint': {
      const iso = vroegstePrintdatum(brieven);
      return {
        categorie: 'geprint_nog_posten',
        subfilter: 'printen_posten',
        procesDatum: iso
          ? {
              iso,
              label: `Geprint ${relatiefLabel(iso).relatief}`,
              a11yLabel: `Geprint op ${volledigeDatum(iso)}`,
            }
          : {
              iso: null,
              label: 'Geprint',
              a11yLabel: 'Geprint',
            },
      };
    }

    case 'opvolging_open': {
      const iso = vroegsteOpvolgdatumOpen(brieven, vandaag);
      const isVandaag = iso === vandaag;
      const cat: ActieCategorie = isVandaag ? 'opvolging_vandaag' : 'opvolging_verlopen';
      return {
        categorie: cat,
        subfilter: 'opvolgen',
        procesDatum: iso
          ? {
              iso,
              label: isVandaag ? 'Opvolgen vandaag' : `Opvolgen sinds ${korteDatum(iso)}`,
              a11yLabel: isVandaag
                ? 'Opvolgen vandaag'
                : `Opvolgen sinds ${volledigeDatum(iso)}`,
            }
          : {
              iso: null,
              label: 'Opvolgen',
              a11yLabel: 'Opvolgen',
            },
      };
    }

    case 'gepost':
    case 'email_verzonden':
      // Geen toekomstige opvolgdatum (anders zou het Wachten zijn):
      // opvolging plannen.
      return {
        categorie: 'opvolging_plannen',
        subfilter: 'opvolgen',
        procesDatum: {
          iso: null,
          label: fase === 'email_verzonden' ? 'E-mail verzonden · opvolging plannen' : 'Gepost · opvolging plannen',
          a11yLabel: fase === 'email_verzonden' ? 'E-mail verzonden, opvolging plannen' : 'Gepost, opvolging plannen',
        },
      };

    case 'afgerond':
      // Onbereikbaar hier — afgerond is 'afgehandeld' werkbak.
      return {
        categorie: 'onderzoek',
        subfilter: 'alle',
        procesDatum: null,
      };
  }
}

// ---------------------------------------------------------------------
// Werkvolgorde-sortering
// ---------------------------------------------------------------------

/** Categorie-rang binnen Actie (lager = hoger prioriteit). */
const ACTIE_RANG: Record<ActieCategorie, number> = {
  opvolging_verlopen: 10,
  opvolging_vandaag: 20,
  opvolging_plannen: 30,
  geprint_nog_posten: 40,
  gereed_voor_print: 50,
  concept_controleren: 60,
  brief_voorbereiden: 70,
  onderzoek: 80,
};

/** Werkbak-rang voor sortering binnen "Alles". */
const WERKBAK_RANG: Record<Werkbak, number> = {
  actie: 0,
  wachten: 100,
  afgehandeld: 200,
};

export interface SorteerRij {
  signaalId: string;
  toegevoegdOp: string | null;
  ctx: WerkbakContext;
  procesDatumIsoWachten: string | null;
}

/**
 * Werkvolgorde-sortering. Sorteert een lijst rijen binnen één zichtbare view.
 *
 * Regels per werkbak:
 *   - actie: primary = ACTIE_RANG(categorie); tsA = procesdatum ASC
 *     (oudste openstaand eerst); tsB = toegevoegd_op ASC; tsC = id.
 *   - wachten: primary = 0; tsA = eerstvolgende opvolgdatum ASC; tsB = toegevoegd_op ASC.
 *   - afgehandeld: primary = 0; tsA = afrondingsdatum DESC; tsB = toegevoegd_op DESC.
 *   - alles: eerst op werkbak (actie < wachten < afgehandeld), daarna volgens
 *     de eigen regels van die werkbak.
 */
export function sorteerWerkvolgorde(view: WerkbakView, rijen: SorteerRij[]): SorteerRij[] {
  const arr = [...rijen];
  arr.sort((a, b) => vergelijk(view, a, b));
  return arr;
}

function vergelijk(view: WerkbakView, a: SorteerRij, b: SorteerRij): number {
  if (view === 'alles') {
    const wa = WERKBAK_RANG[a.ctx.werkbak];
    const wb = WERKBAK_RANG[b.ctx.werkbak];
    if (wa !== wb) return wa - wb;
    // Binnen dezelfde werkbak: gebruik werkbak-specifieke sort
    return vergelijk(a.ctx.werkbak, a, b);
  }
  if (view === 'actie') {
    const ra = a.ctx.actieCategorie ? ACTIE_RANG[a.ctx.actieCategorie] : 999;
    const rb = b.ctx.actieCategorie ? ACTIE_RANG[b.ctx.actieCategorie] : 999;
    if (ra !== rb) return ra - rb;
    // Oudste procesdatum eerst (verlopen opvolging: verst verstreken eerst).
    const da = a.ctx.procesDatum?.iso ?? '';
    const db = b.ctx.procesDatum?.iso ?? '';
    if (da !== db) return da.localeCompare(db);
    const ta = a.toegevoegdOp ?? '';
    const tb = b.toegevoegdOp ?? '';
    if (ta !== tb) return ta.localeCompare(tb);
    return a.signaalId.localeCompare(b.signaalId);
  }
  if (view === 'wachten') {
    const da = a.procesDatumIsoWachten ?? a.ctx.procesDatum?.iso ?? '';
    const db = b.procesDatumIsoWachten ?? b.ctx.procesDatum?.iso ?? '';
    if (da !== db) return da.localeCompare(db);
    const ta = a.toegevoegdOp ?? '';
    const tb = b.toegevoegdOp ?? '';
    if (ta !== tb) return ta.localeCompare(tb);
    return a.signaalId.localeCompare(b.signaalId);
  }
  // afgehandeld: meest recente afronding eerst.
  const da = a.ctx.procesDatum?.iso ?? '';
  const db = b.ctx.procesDatum?.iso ?? '';
  if (da !== db) return db.localeCompare(da);
  const ta = a.toegevoegdOp ?? '';
  const tb = b.toegevoegdOp ?? '';
  if (ta !== tb) return tb.localeCompare(ta);
  return a.signaalId.localeCompare(b.signaalId);
}

// ---------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------

export const WERKBAK_LABEL: Record<WerkbakView, string> = {
  actie: 'Actie',
  wachten: 'Wachten',
  afgehandeld: 'Afgehandeld',
  alles: 'Alles',
};

export const ACTIE_SUBFILTER_LABEL: Record<ActieSubfilter, string> = {
  alle: 'Alle acties',
  onderzoeken: 'Onderzoeken',
  brief_voorbereiden: 'Brief voorbereiden',
  printen_posten: 'Printen & posten',
  opvolgen: 'Opvolgen',
};

// ---------------------------------------------------------------------
// Toegevoegd-op relatief label
// ---------------------------------------------------------------------

export function toegevoegdOpLabel(iso: string | null): { relatief: string; volledig: string } | null {
  if (!iso) return null;
  return relatiefLabel(iso);
}
