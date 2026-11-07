import type { Bieding, BiedingStatus } from '@/lib/biedingen/types';
import { OPEN_BIEDING_STATUSSEN } from '@/lib/biedingen/status';
import { localDateKey } from '@/lib/tasks/workView';

/**
 * Aandacht nodig (dashboard D3).
 *
 * Toont per object hoogstens één regel: het belangrijkste signaal plus een concrete vervolgstap.
 * Alleen signalen die betrouwbaar uit bestaande CRM-gegevens volgen:
 *  1. open bieding (ontvangen, in behandeling, tegenvoorstel gedaan, aangepast bod gevraagd; geen concept);
 *  2. geen betekenisvolle activiteit: > 14 dagen, of > 7 dagen bij een object met een open bieding;
 *  3. geen kandidaat gekoppeld (alleen beschikbaar / onder optie).
 * Staat er al opvolging gepland (taak of volgende actie bij een kandidaat, vandaag of later) en is er
 * niets achterstallig, dan valt het object weg — behalve bij een open bieding. De vroegste stap wordt de
 * vervolgstap; een verstreken harde deadline gaat voor op een latere plandatum.
 * Objecten die on hold staan, komen in een aparte lijst.
 */

export const DREMPEL_GEEN_ACTIVITEIT_DAGEN = 14;
export const DREMPEL_GEEN_ACTIVITEIT_MET_BOD_DAGEN = 7;

export type AandachtSignaal = 'open_bieding' | 'geen_activiteit' | 'geen_kandidaat' | 'on_hold';

export interface AandachtObject {
  id: string;
  titel: string;
  status: string;
  datumToegevoegd?: string | null;
  isArchived?: boolean;
  softDeletedAt?: string | null;
}

export interface AandachtKandidaat {
  objectId: string;
  relatieId: string;
  pipelineFase: string;
  laatsteContactdatum?: string | null;
  volgendeActieOmschrijving?: string | null;
  volgendeActieDatum?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AandachtContactMoment {
  objectId?: string | null;
  momentDate: string;
  isSystem: boolean;
}

export interface AandachtTaak {
  id: string;
  titel: string;
  objectId?: string | null;
  deadline?: string | null;
  status: string;
  softDeletedAt?: string | null;
}

export interface AandachtDeal {
  objectId: string;
  fase: string;
  isArchived?: boolean;
}

export interface AandachtMatch {
  objectId: string;
  relatieId: string;
}

export interface AandachtInvoer {
  objecten: AandachtObject[];
  kandidaten: AandachtKandidaat[];
  biedingen: Pick<Bieding, 'id' | 'objectId' | 'relatieId' | 'bedrag' | 'bieddatum' | 'status' | 'richting' | 'geldigTot' | 'createdAt' | 'updatedAt'>[];
  contactMoments: AandachtContactMoment[];
  taken: AandachtTaak[];
  deals?: AandachtDeal[];
  /** Matches uit geregistreerde, actieve zoekprofielen (getAllMatchesFromData). */
  matches: AandachtMatch[];
  /** Aantal actieve geregistreerde zoekprofielen. */
  aantalZoekprofielen: number;
  /** Plandatum van een taak (Taken-module); valt anders terug op de deadline. */
  planDatumVoor?: (taak: AandachtTaak) => string | null | undefined;
  /** Naam van de partij achter een bieding; null als onbekend. */
  relatieNaam?: (relatieId: string) => string | null | undefined;
}

/** Bekende gegevens van de getoonde open bieding; ontbrekende velden blijven null. */
export interface AandachtBod {
  bedrag: number | null;
  relatieId: string | null;
  partij: string | null;
  bieddatum: string | null;
  geldigTot: string | null;
}

export interface AandachtItem {
  objectId: string;
  titel: string;
  signaal: AandachtSignaal;
  /** Korte kop, bijv. "Open bieding" of "16 dagen geen activiteit". */
  label: string;
  /** Wat er precies speelt. */
  toelichting: string;
  /** Concrete vervolgstap, zonder het voorvoegsel "Volgende actie:". */
  volgendeActie: string;
  /** Aantal overige signalen op hetzelfde object. */
  extraSignalen: number;
  /** Korte koppen van die overige signalen. */
  overigeSignalen: string[];
  /** Dagen sinds de laatste betekenisvolle activiteit (null = geen datum bekend). */
  dagenStil: number | null;
  /** Alleen bij signaal open_bieding. */
  bod?: AandachtBod;
}

export interface AandachtOverzicht {
  items: AandachtItem[];
  onHold: AandachtItem[];
}

const ACTIEVE_OBJECTSTATUSSEN = new Set(['te_beoordelen', 'beschikbaar', 'onder_optie']);
const KANDIDAAT_ZOEKEN_STATUSSEN = new Set(['beschikbaar', 'onder_optie']);
const AFGESLOTEN_FASES = new Set(['afgerond', 'afgevallen']);
const AFGESLOTEN_TAAKSTATUSSEN = new Set(['afgerond', 'geannuleerd']);
const OPEN_STATUSSEN = new Set<BiedingStatus>(OPEN_BIEDING_STATUSSEN);

/** Normaliseert een datum of tijdstempel naar een lokale YYYY-MM-DD, of null. */
export function dagSleutel(waarde: string | null | undefined): string | null {
  if (!waarde) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(waarde)) return waarde;
  const d = new Date(waarde);
  return Number.isNaN(d.getTime()) ? null : localDateKey(d);
}

function dagenTussen(van: string, tot: string): number {
  const [y1, m1, d1] = van.split('-').map(Number);
  const [y2, m2, d2] = tot.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

const meervoud = (n: number, enkel: string, meer: string) => `${n} ${n === 1 ? enkel : meer}`;

function korteDatum(sleutel: string): string {
  const [y, m, d] = sleutel.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

function bodIsVerlopen(b: { geldigTot?: string | null }, vandaag: string): boolean {
  const tot = dagSleutel(b.geldigTot);
  return !!tot && tot < vandaag;
}

function biedingSignaal(b: AandachtInvoer['biedingen'][number]): { label: string; volgendeActie: string } {
  const zonderBedrag = !(typeof b.bedrag === 'number' && b.bedrag > 0);
  if (zonderBedrag) {
    return b.status === 'tegenvoorstel_gedaan'
      ? { label: 'Tegenvoorstel zonder bedrag', volgendeActie: 'bedrag van het tegenvoorstel vastleggen' }
      : { label: 'Bod zonder bedrag', volgendeActie: 'bedrag van het bod vastleggen' };
  }
  const vanVerkoper = b.richting === 'van_verkoper' || b.richting === 'namens_verkoper';
  switch (b.status) {
    case 'ontvangen':
      return vanVerkoper
        ? { label: 'Voorstel verkoper ontvangen, reactie koper nodig', volgendeActie: 'koper opvolgen' }
        : { label: 'Ontvangen bod, reactie verkoper nodig', volgendeActie: 'verkoper opvolgen' };
    case 'in_behandeling':
      return { label: 'Bod in behandeling', volgendeActie: 'besluit verkoper opvolgen' };
    case 'tegenvoorstel_gedaan':
      return { label: 'Tegenvoorstel gedaan, wacht op reactie', volgendeActie: 'reactie op tegenvoorstel opvolgen' };
    case 'aangepast_bod_gevraagd':
      return { label: 'Aangepast bod gevraagd', volgendeActie: 'aangepast bod opvolgen' };
    default:
      return { label: 'Open bieding', volgendeActie: 'bieding opvolgen' };
  }
}

interface Opvolging { titel: string; datum: string; soort: 'plan' | 'deadline' }

/**
 * Bepaalt de signalen voor Aandacht nodig. Puur en deterministisch: `now` bepaalt "vandaag".
 */
export function bepaalAandacht(invoer: AandachtInvoer, now: Date): AandachtOverzicht {
  const vandaag = localDateKey(now);
  const planDatum = invoer.planDatumVoor ?? (() => null);

  const perObject = <T extends { objectId?: string | null }>(lijst: T[]) => {
    const map = new Map<string, T[]>();
    for (const x of lijst) {
      if (!x.objectId) continue;
      map.set(x.objectId, [...(map.get(x.objectId) ?? []), x]);
    }
    return map;
  };

  const kandidatenPer = perObject(invoer.kandidaten);
  const biedingenPer = perObject(invoer.biedingen);
  const momentenPer = perObject(invoer.contactMoments.filter(m => !m.isSystem));
  const takenPer = perObject(invoer.taken.filter(t => !t.softDeletedAt && !AFGESLOTEN_TAAKSTATUSSEN.has(t.status)));
  const dealsPer = perObject((invoer.deals ?? []).filter(d => !d.isArchived && !AFGESLOTEN_FASES.has(d.fase)));
  const matchesPer = perObject(invoer.matches);

  const items: AandachtItem[] = [];
  const onHold: AandachtItem[] = [];

  for (const object of invoer.objecten) {
    if (object.isArchived || object.softDeletedAt) continue;
    const isOnHold = object.status === 'on_hold';
    if (!isOnHold && !ACTIEVE_OBJECTSTATUSSEN.has(object.status)) continue;

    const kandidaten = kandidatenPer.get(object.id) ?? [];
    const actieveKandidaten = kandidaten.filter(k => !AFGESLOTEN_FASES.has(k.pipelineFase));
    const biedingen = biedingenPer.get(object.id) ?? [];

    // Laatste betekenisvolle activiteit: handmatige contactmomenten, biedingen en kandidaatmutaties.
    // Systeemmomenten en datums in de toekomst tellen niet.
    const activiteit: string[] = [];
    for (const m of momentenPer.get(object.id) ?? []) activiteit.push(m.momentDate);
    for (const b of biedingen) activiteit.push(b.bieddatum, b.createdAt, b.updatedAt);
    for (const k of kandidaten) activiteit.push(k.laatsteContactdatum ?? '', k.createdAt ?? '', k.updatedAt ?? '');
    const laatste = activiteit
      .map(dagSleutel)
      .filter((d): d is string => !!d && d <= vandaag)
      .sort()
      .pop() ?? null;
    const sinds = laatste ?? dagSleutel(object.datumToegevoegd);
    const dagenStil = sinds ? Math.max(0, dagenTussen(sinds, vandaag)) : null;

    // Geplande opvolging: vroegste open taak of volgende actie bij een kandidaat.
    const opvolgingen: Opvolging[] = [];
    // Een verstreken harde deadline gaat voor op een latere plandatum van dezelfde taak.
    for (const t of takenPer.get(object.id) ?? []) {
      const deadline = dagSleutel(t.deadline);
      const plan = dagSleutel(planDatum(t));
      if (deadline && deadline < vandaag) opvolgingen.push({ titel: t.titel, datum: deadline, soort: 'deadline' });
      else if (plan) opvolgingen.push({ titel: t.titel, datum: plan, soort: 'plan' });
      else if (deadline) opvolgingen.push({ titel: t.titel, datum: deadline, soort: 'deadline' });
    }
    for (const k of actieveKandidaten) {
      const datum = dagSleutel(k.volgendeActieDatum);
      if (datum) opvolgingen.push({ titel: k.volgendeActieOmschrijving?.trim() || 'volgende actie bij kandidaat', datum, soort: 'plan' });
    }
    // Vroegste datum eerst; bij gelijke datum gaat een harde deadline voor.
    opvolgingen.sort((a, b) => a.datum.localeCompare(b.datum) || (a.soort === b.soort ? 0 : a.soort === 'deadline' ? -1 : 1));
    const gepland = opvolgingen.find(o => o.datum >= vandaag) ?? null;
    const achterstallig = opvolgingen.find(o => o.datum < vandaag) ?? null;
    // Een toekomstige afspraak dekt het object alleen af als er niets achterstallig is.
    const opgevolgd = !!gepland && !achterstallig;
    const eersteStap = achterstallig ?? gepland;
    const stapTekst = (o: Opvolging) => {
      if (o.datum >= vandaag) return `${o.titel} (gepland ${o.datum === vandaag ? 'vandaag' : korteDatum(o.datum)})`;
      return o.soort === 'deadline'
        ? `${o.titel} (deadline verstreken op ${korteDatum(o.datum)})`
        : `${o.titel} (achterstallig sinds ${korteDatum(o.datum)})`;
    };

    const activiteitTekst = laatste
      ? `Laatste activiteit ${korteDatum(laatste)}`
      : 'Nog geen activiteit geregistreerd';

    if (isOnHold) {
      onHold.push({
        objectId: object.id,
        titel: object.titel,
        signaal: 'on_hold',
        label: 'On hold',
        toelichting: activiteitTekst,
        volgendeActie: eersteStap ? stapTekst(eersteStap) : 'beoordelen of het object weer actief kan',
        extraSignalen: 0,
        overigeSignalen: [],
        dagenStil,
      });
      continue;
    }

    const openBiedingen = biedingen
      .filter(b => OPEN_STATUSSEN.has(b.status) && !bodIsVerlopen(b, vandaag))
      .sort((a, b) => (dagSleutel(b.bieddatum) ?? '').localeCompare(dagSleutel(a.bieddatum) ?? '') || b.createdAt.localeCompare(a.createdAt));
    const heeftOpenBod = openBiedingen.length > 0;

    const drempel = heeftOpenBod ? DREMPEL_GEEN_ACTIVITEIT_MET_BOD_DAGEN : DREMPEL_GEEN_ACTIVITEIT_DAGEN;
    const stil = dagenStil != null && dagenStil > drempel && !opgevolgd;
    const geenKandidaat = KANDIDAAT_ZOEKEN_STATUSSEN.has(object.status)
      && actieveKandidaten.length === 0
      && (dealsPer.get(object.id) ?? []).length === 0
      && !opgevolgd;

    const signalen: AandachtItem[] = [];

    if (heeftOpenBod) {
      const bod = openBiedingen[0];
      const { label, volgendeActie } = biedingSignaal(bod);
      const extraBoden = openBiedingen.length - 1;
      const delen = [label];
      if (extraBoden > 0) delen.push(`${meervoud(extraBoden, 'andere open bieding', 'andere open biedingen')}`);
      signalen.push({
        objectId: object.id,
        titel: object.titel,
        signaal: 'open_bieding',
        label: openBiedingen.length > 1 ? `${openBiedingen.length} open biedingen` : 'Open bieding',
        toelichting: delen.join(' · '),
        volgendeActie: eersteStap ? stapTekst(eersteStap) : volgendeActie,
        extraSignalen: 0,
        overigeSignalen: [],
        dagenStil,
        bod: {
          bedrag: typeof bod.bedrag === 'number' && bod.bedrag > 0 ? bod.bedrag : null,
          relatieId: bod.relatieId || null,
          partij: (bod.relatieId && invoer.relatieNaam?.(bod.relatieId)) || null,
          bieddatum: dagSleutel(bod.bieddatum),
          geldigTot: dagSleutel(bod.geldigTot),
        },
      });
    }

    if (stil) {
      signalen.push({
        objectId: object.id,
        titel: object.titel,
        signaal: 'geen_activiteit',
        label: laatste ? `${dagenStil} dagen geen activiteit` : `${dagenStil} dagen sinds toevoegen, geen activiteit`,
        toelichting: achterstallig
          ? `Geen betekenisvolle opvolging geregistreerd · ${activiteitTekst.toLowerCase()}`
          : `Geen betekenisvolle opvolging geregistreerd${laatste ? ` · ${activiteitTekst.toLowerCase()}` : ''}`,
        volgendeActie: achterstallig
          ? stapTekst(achterstallig)
          : actieveKandidaten.length > 0 ? 'kandidaat benaderen' : 'kandidaten zoeken',
        extraSignalen: 0,
        overigeSignalen: [],
        dagenStil,
      });
    }

    if (geenKandidaat) {
      const relatiesMetMatch = new Set((matchesPer.get(object.id) ?? []).map(m => m.relatieId));
      const n = relatiesMetMatch.size;
      const z = invoer.aantalZoekprofielen;
      let toelichting = 'Geen geïnteresseerde partij gekoppeld';
      let volgendeActie = 'kandidaten zoeken';
      if (n > 0) {
        toelichting += ` · ${meervoud(n, 'relatie past', 'relaties passen')} op een geregistreerd zoekprofiel`;
        volgendeActie = n === 1 ? 'passende relatie benaderen' : 'passende relaties benaderen';
      } else if (z > 0) {
        toelichting += ` · geen match op de ${meervoud(z, 'geregistreerd zoekprofiel', 'geregistreerde zoekprofielen')}`;
        volgendeActie = 'kandidaten zoeken buiten de geregistreerde zoekprofielen';
      } else {
        toelichting += ' · er zijn geen actieve zoekprofielen geregistreerd';
      }
      signalen.push({
        objectId: object.id,
        titel: object.titel,
        signaal: 'geen_kandidaat',
        label: 'Geen kandidaat',
        toelichting,
        volgendeActie: achterstallig ? stapTekst(achterstallig) : volgendeActie,
        extraSignalen: 0,
        overigeSignalen: [],
        dagenStil,
      });
    }

    if (signalen.length === 0) continue;
    items.push({ ...signalen[0], extraSignalen: signalen.length - 1, overigeSignalen: signalen.slice(1).map(x => x.label) });
  }

  const rang: Record<AandachtSignaal, number> = { open_bieding: 0, geen_activiteit: 1, geen_kandidaat: 2, on_hold: 3 };
  const opStilte = (a: AandachtItem, b: AandachtItem) => (b.dagenStil ?? -1) - (a.dagenStil ?? -1) || a.titel.localeCompare(b.titel, 'nl');
  items.sort((a, b) => rang[a.signaal] - rang[b.signaal] || opStilte(a, b));
  onHold.sort(opStilte);
  return { items, onHold };
}
