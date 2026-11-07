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
 * met een label. Geen kanspercentages.
 */

export const MAX_LOPENDE_TRANSACTIES = 3;
export const DREMPEL_STIL_DAGEN = 14;

const FASE_INDEX = new Map(PIPELINE_FASES.map((f, i) => [f.key as string, i]));
const FASE_LABEL = new Map(PIPELINE_FASES.map(f => [f.key as string, f.label]));
const EERSTE_LOPENDE = FASE_INDEX.get('indicatieve_bieding')!;
const LAATSTE_LOPENDE = FASE_INDEX.get('transport_closing')!;
const AFGESLOTEN_OBJECTSTATUSSEN = new Set(['verkocht', 'ingetrokken', 'afgevallen']);
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

export interface Mijlpaal {
  soort: 'levering' | 'actie';
  datum: string;
  verlopen: boolean;
}

export interface LopendeTransactie {
  objectId: string;
  objectTitel: string;
  objectOnHold: boolean;
  kandidaatId: string;
  relatieId: string;
  koper: string | null;
  fase: string;
  faseLabel: string;
  /** Gewenste levering, alleen als bekend. */
  gewensteLevering: string | null;
  /** Eerstvolgende concrete mijlpaal (levering of volgende actie met datum). */
  mijlpaal: Mijlpaal | null;
  /** Volgende actie, of null als er niets is vastgelegd. */
  volgendeActie: { tekst: string; datum: string | null } | null;
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

    // Volgende actie: die van de kandidaat; anders de vroegste open taak op dit object.
    let volgendeActie: LopendeTransactie['volgendeActie'] = null;
    const actieDatum = dagSleutel(k.volgendeActieDatum);
    const actieTekst = k.volgendeActieOmschrijving?.trim()
      || (k.volgendeActie ? (invoer.actieLabel?.(k.volgendeActie) ?? k.volgendeActie) : null);
    if (actieTekst || actieDatum) {
      volgendeActie = { tekst: actieTekst ?? 'Volgende actie', datum: actieDatum };
    } else {
      const taken = (invoer.taken ?? [])
        .filter(t => t.objectId === k.objectId && !t.softDeletedAt && !AFGESLOTEN_TAAKSTATUSSEN.has(t.status)
          && (!t.relatieId || t.relatieId === k.relatieId))
        .map(t => {
          const deadline = dagSleutel(t.deadline);
          const plan = dagSleutel(planDatum(t));
          const datum = deadline && deadline < vandaag ? deadline : (plan ?? deadline);
          return { tekst: t.titel, datum };
        })
        .sort((a, b) => (a.datum ?? '9999').localeCompare(b.datum ?? '9999'));
      if (taken[0]) volgendeActie = taken[0];
    }

    const gewensteLevering = dagSleutel(k.gewensteLevering);
    const kandidaten: Mijlpaal[] = [];
    if (gewensteLevering) kandidaten.push({ soort: 'levering', datum: gewensteLevering, verlopen: gewensteLevering < vandaag });
    if (volgendeActie?.datum) kandidaten.push({ soort: 'actie', datum: volgendeActie.datum, verlopen: volgendeActie.datum < vandaag });
    kandidaten.sort((a, b) => a.datum.localeCompare(b.datum));

    const bod = biedingen[0];
    return {
      objectId: object.id,
      objectTitel: object.titel,
      objectOnHold: object.status === 'on_hold',
      kandidaatId: k.id,
      relatieId: k.relatieId,
      koper: invoer.relatieNaam?.(k.relatieId) || null,
      fase: k.pipelineFase,
      faseLabel: FASE_LABEL.get(k.pipelineFase) ?? k.pipelineFase,
      gewensteLevering,
      mijlpaal: kandidaten[0] ?? null,
      volgendeActie,
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
    if (!object || object.isArchived || object.softDeletedAt || AFGESLOTEN_OBJECTSTATUSSEN.has(object.status)) continue;
    const regel = kandidaatRegel(k, object);
    const huidig = perObject.get(object.id);
    if (!huidig || vergelijk(regel, huidig) < 0) perObject.set(object.id, regel);
  }

  const alle = [...perObject.values()].sort(vergelijk);
  return { items: alle.slice(0, MAX_LOPENDE_TRANSACTIES), totaal: alle.length };
}
