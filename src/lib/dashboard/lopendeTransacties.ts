import { PIPELINE_FASES } from '@/data/mock-data';
import { localDateKey } from '@/lib/tasks/workView';
import { dagSleutel } from '@/lib/dashboard/aandacht';

/**
 * Lopende transacties (dashboard D5, issue #570).
 *
 * Bron: de kandidatenpipeline (`object_pipeline`). Een traject is lopend vanaf "Bieding / prijsvoorstel"
 * tot en met "Transport / closing", op een object dat niet gearchiveerd, verwijderd of afgesloten is.
 * Per object één regel: de verst gevorderde kandidaat. Rangschikking:
 *  1. fase, verst eerst (volgorde van PIPELINE_FASES);
 *  2. eerstvolgende concrete mijlpaal (gewenste levering of volgende actie met datum), vroegste eerst;
 *  3. meest recente betekenisvolle activiteit.
 * Maximaal drie; minder trajecten worden niet aangevuld. Stilgevallen trajecten blijven op hun fase staan
 * met een label. Geen kanspercentages. Objecten on hold tellen niet mee (gepauzeerd).
 *
 * Volgende actie = kopergebonden: de volgende actie van de kandidaat, of een open taak gekoppeld aan
 * deze koper. Is die er niet, dan wordt een open taak op het object zonder koper of voor een andere
 * relatie apart getoond als "objectopvolging" — nooit als actie van de koper. Alleen kopergebonden
 * acties en de gewenste levering zijn mijlpaal; voor de rangschikking telt alleen een mijlpaal vandaag
 * of later (een verlopen datum is geen eerstvolgende mijlpaal).
 */

export const MAX_LOPENDE_TRANSACTIES = 3;
export const DREMPEL_STIL_DAGEN = 14;

const FASE_INDEX = new Map(PIPELINE_FASES.map((f, i) => [f.key as string, i]));
const FASE_LABEL = new Map(PIPELINE_FASES.map(f => [f.key as string, f.label]));
const EERSTE_LOPENDE = FASE_INDEX.get('indicatieve_bieding')!;
const LAATSTE_LOPENDE = FASE_INDEX.get('transport_closing')!;
const UITGESLOTEN_OBJECTSTATUSSEN = new Set(['verkocht', 'ingetrokken', 'afgevallen', 'on_hold']);
const AFGESLOTEN_TAAKSTATUSSEN = new Set(['afgerond', 'geannuleerd']);

export function isLopendeFase(fase: string): boolean {
  const i = FASE_INDEX.get(fase);
  return i != null && i >= EERSTE_LOPENDE && i <= LAATSTE_LOPENDE;
}

export interface TransactieObject {
  id: string;
  titel: string;
  status: string;
  isArchived?: boolean;
  softDeletedAt?: string | null;
  /** Gekoppelde eigenaar/verkoper (relaties.id), indien bekend. */
  eigenaarRelatieId?: string | null;
}

export interface TransactieKandidaat {
  id: string;
  objectId: string;
  relatieId: string;
  pipelineFase: string;
  gewensteLevering?: string | null;
  volgendeActie?: string | null;
  volgendeActieOmschrijving?: string | null;
  volgendeActieDatum?: string | null;
  laatsteContactdatum?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface TransactieBieding {
  objectId: string;
  relatieId: string;
  bedrag?: number | null;
  bieddatum: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactieContactMoment {
  objectId?: string | null;
  relatieId?: string | null;
  momentDate: string;
  isSystem: boolean;
}

export interface TransactieTaak {
  id: string;
  titel: string;
  objectId?: string | null;
  relatieId?: string | null;
  deadline?: string | null;
  status: string;
  softDeletedAt?: string | null;
}

export interface TransactieInvoer {
  objecten: TransactieObject[];
  kandidaten: TransactieKandidaat[];
  biedingen?: TransactieBieding[];
  contactMoments?: TransactieContactMoment[];
  taken?: TransactieTaak[];
  planDatumVoor?: (taak: TransactieTaak) => string | null | undefined;
  relatieNaam?: (relatieId: string) => string | null | undefined;
  /** Label voor een volgende-actietype (bijv. VOLGENDE_ACTIE_LABELS). */
  actieLabel?: (type: string) => string | null | undefined;
}

/** Eerstvolgende concrete mijlpaal, vandaag of later. */
export interface Mijlpaal {
  soort: 'levering' | 'actie';
  datum: string;
}

export interface VolgendeStap {
  tekst: string;
  datum: string | null;
  verlopen: boolean;
}

export interface ObjectOpvolging extends VolgendeStap {
  relatieId: string | null;
  relatieNaam: string | null;
  /** Alleen 'verkoper' als de relatie de gekoppelde eigenaar/verkoper van het object is. */
  rol: 'verkoper' | null;
}

export interface LopendeTransactie {
  objectId: string;
  objectTitel: string;
  kandidaatId: string;
  relatieId: string;
  koper: string | null;
  fase: string;
  faseLabel: string;
  /** Gewenste levering, alleen als bekend. */
  gewensteLevering: string | null;
  /** Eerstvolgende concrete mijlpaal vandaag of later (levering of kopergebonden actie met datum). */
  mijlpaal: Mijlpaal | null;
  /** Kopergebonden volgende actie, of null als er niets is vastgelegd. */
  volgendeActie: VolgendeStap | null;
  /** Algemene objectopvolging, alleen als er geen kopergebonden actie is. */
  objectOpvolging: ObjectOpvolging | null;
  laatsteActiviteit: string | null;
  /** Dagen zonder betekenisvolle activiteit, alleen boven de drempel. */
  stilDagen: number | null;
  /** Laatste bod van deze koper op dit object, als context. */
  laatsteBod: { bedrag: number | null; datum: string; status: string } | null;
}

export interface LopendeTransactiesOverzicht {
  items: LopendeTransactie[];
  /** Aantal objecten met een lopend traject (vóór de limiet van drie). */
  totaal: number;
}

function dagenTussen(van: string, tot: string): number {
  const [y1, m1, d1] = van.split('-').map(Number);
  const [y2, m2, d2] = tot.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

const laatsteDatum = (waarden: (string | null | undefined)[], vandaag: string) =>
  waarden.map(dagSleutel).filter((d): d is string => !!d && d <= vandaag).sort().pop() ?? null;

export function bepaalLopendeTransacties(invoer: TransactieInvoer, now: Date): LopendeTransactiesOverzicht {
  const vandaag = localDateKey(now);
  const objecten = new Map(invoer.objecten.map(o => [o.id, o]));
  const planDatum = invoer.planDatumVoor ?? (() => null);

  const kandidaatRegel = (k: TransactieKandidaat, object: TransactieObject): LopendeTransactie => {
    const biedingen = (invoer.biedingen ?? [])
      .filter(b => b.objectId === k.objectId && b.relatieId === k.relatieId && b.status !== 'concept')
      .sort((a, b) => (dagSleutel(b.bieddatum) ?? '').localeCompare(dagSleutel(a.bieddatum) ?? '') || b.createdAt.localeCompare(a.createdAt));
    const momenten = (invoer.contactMoments ?? []).filter(m =>
      !m.isSystem && m.objectId === k.objectId && (!m.relatieId || m.relatieId === k.relatieId));

    const laatsteActiviteit = laatsteDatum([
      k.laatsteContactdatum, k.createdAt, k.updatedAt,
      ...momenten.map(m => m.momentDate),
      ...biedingen.flatMap(b => [b.bieddatum, b.createdAt, b.updatedAt]),
    ], vandaag);
    const stil = laatsteActiviteit ? dagenTussen(laatsteActiviteit, vandaag) : null;

    // Open taken op dit object, met hun effectieve datum (verstreken deadline gaat voor op plandatum).
    const openTaken = (invoer.taken ?? [])
      .filter(t => t.objectId === k.objectId && !t.softDeletedAt && !AFGESLOTEN_TAAKSTATUSSEN.has(t.status))
      .map(t => {
        const deadline = dagSleutel(t.deadline);
        const plan = dagSleutel(planDatum(t));
        const datum = deadline && deadline < vandaag ? deadline : (plan ?? deadline);
        return { taak: t, datum };
      })
      .sort((a, b) => (a.datum ?? '9999').localeCompare(b.datum ?? '9999'));
    const stap = (tekst: string, datum: string | null): VolgendeStap => ({ tekst, datum, verlopen: !!datum && datum < vandaag });

    // Kopergebonden volgende actie: die van de kandidaat, anders een open taak voor deze koper.
    let volgendeActie: VolgendeStap | null = null;
    const actieDatum = dagSleutel(k.volgendeActieDatum);
    const actieTekst = k.volgendeActieOmschrijving?.trim()
      || (k.volgendeActie ? (invoer.actieLabel?.(k.volgendeActie) ?? k.volgendeActie) : null);
    if (actieTekst || actieDatum) {
      volgendeActie = stap(actieTekst ?? 'Volgende actie', actieDatum);
    } else {
      const voorKoper = openTaken.find(x => x.taak.relatieId === k.relatieId);
      if (voorKoper) volgendeActie = stap(voorKoper.taak.titel, voorKoper.datum);
    }

    // Algemene objectopvolging: taak zonder koper of voor een andere relatie; alleen als er geen
    // kopergebonden actie is, en apart gepresenteerd.
    let objectOpvolging: ObjectOpvolging | null = null;
    if (!volgendeActie) {
      const algemeen = openTaken.find(x => x.taak.relatieId !== k.relatieId);
      if (algemeen) {
        const relatieId = algemeen.taak.relatieId || null;
        objectOpvolging = {
          ...stap(algemeen.taak.titel, algemeen.datum),
          relatieId,
          relatieNaam: relatieId ? (invoer.relatieNaam?.(relatieId) || null) : null,
          rol: relatieId && object.eigenaarRelatieId && relatieId === object.eigenaarRelatieId ? 'verkoper' : null,
        };
      }
    }

    // Mijlpaal voor de rangschikking: alleen vandaag of later; verlopen datums tellen niet.
    const gewensteLevering = dagSleutel(k.gewensteLevering);
    const mijlpalen: Mijlpaal[] = [];
    if (gewensteLevering && gewensteLevering >= vandaag) mijlpalen.push({ soort: 'levering', datum: gewensteLevering });
    if (volgendeActie?.datum && volgendeActie.datum >= vandaag) mijlpalen.push({ soort: 'actie', datum: volgendeActie.datum });
    mijlpalen.sort((a, b) => a.datum.localeCompare(b.datum));

    const bod = biedingen[0];
    return {
      objectId: object.id,
      objectTitel: object.titel,
      kandidaatId: k.id,
      relatieId: k.relatieId,
      koper: invoer.relatieNaam?.(k.relatieId) || null,
      fase: k.pipelineFase,
      faseLabel: FASE_LABEL.get(k.pipelineFase) ?? k.pipelineFase,
      gewensteLevering,
      mijlpaal: mijlpalen[0] ?? null,
      volgendeActie,
      objectOpvolging,
      laatsteActiviteit,
      stilDagen: stil != null && stil > DREMPEL_STIL_DAGEN ? stil : null,
      laatsteBod: bod
        ? { bedrag: typeof bod.bedrag === 'number' && bod.bedrag > 0 ? bod.bedrag : null, datum: dagSleutel(bod.bieddatum) ?? bod.bieddatum, status: bod.status }
        : null,
    };
  };

  const vergelijk = (a: LopendeTransactie, b: LopendeTransactie) =>
    (FASE_INDEX.get(b.fase)! - FASE_INDEX.get(a.fase)!)
    || (a.mijlpaal?.datum ?? '9999-12-31').localeCompare(b.mijlpaal?.datum ?? '9999-12-31')
    || (b.laatsteActiviteit ?? '').localeCompare(a.laatsteActiviteit ?? '')
    || a.objectTitel.localeCompare(b.objectTitel, 'nl');

  // Per object de verst gevorderde kandidaat (zelfde rangschikking binnen het object).
  const perObject = new Map<string, LopendeTransactie>();
  for (const k of invoer.kandidaten) {
    if (!isLopendeFase(k.pipelineFase)) continue;
    const object = objecten.get(k.objectId);
    if (!object || object.isArchived || object.softDeletedAt || UITGESLOTEN_OBJECTSTATUSSEN.has(object.status)) continue;
    const regel = kandidaatRegel(k, object);
    const huidig = perObject.get(object.id);
    if (!huidig || vergelijk(regel, huidig) < 0) perObject.set(object.id, regel);
  }

  const alle = [...perObject.values()].sort(vergelijk);
  return { items: alle.slice(0, MAX_LOPENDE_TRANSACTIES), totaal: alle.length };
}
