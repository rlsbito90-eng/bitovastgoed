import type {
  BriefStatus,
  EigenaarOnderzoekStatus,
  Vastgoedkans,
  VastgoedkansHerkomst,
  VastgoedkansStatus,
} from '@/lib/vastgoedkansen';
import { vandaagNl } from '@/lib/datum/nlDatum';
import { bouwVastgoedkansWorkflowReadModel } from '@/lib/workflow/vastgoedkansWorkflowReadModel';

export type VastgoedkansWerkTab = 'overzicht' | 'onderzoek' | 'kadaster' | 'brieven' | 'dossier';
export type VastgoedkansWerkbak = VastgoedkansStatus | 'alles' | 'archief';
export type VastgoedkansSortering = 'recent' | 'werkvolgorde' | 'prioriteit' | 'score' | 'adres' | 'opvolgdatum';
export type VastgoedkansActieUrgentie = 'verlopen' | 'vandaag' | 'gepland' | 'zonder_datum' | 'processtap' | 'geen_actie';
export type VastgoedkansActieBron = 'expliciet' | 'legacy' | 'workflow' | 'geen';

export interface VastgoedkansActieContext {
  omschrijving: string | null;
  datum: string | null;
  urgentie: VastgoedkansActieUrgentie;
  urgentieLabel: string;
  datumLabel: string | null;
  rang: number;
  bron: VastgoedkansActieBron;
}

export interface VastgoedkansWerkcontext {
  tab: VastgoedkansWerkTab;
  kansId: string;
  werkbak?: string;
  zoekterm?: string;
  ids?: string[];
  bijgewerktOp: string;
}

export interface VastgoedkansLijstFilters {
  prioriteiten: number[];
  herkomsten: VastgoedkansHerkomst[];
  eigenaar: EigenaarOnderzoekStatus[];
  brief: BriefStatus[];
}

export interface VastgoedkansLijstWorkspaceState {
  werkbak: VastgoedkansWerkbak;
  zoekterm: string;
  sortering: VastgoedkansSortering;
  filters: VastgoedkansLijstFilters;
}

export function normaliseerListWorkspaceZoektekst(waarde: unknown): string {
  return String(waarde ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('nl-NL')
    .replace(/\s+/g, ' ')
    .trim();
}

const formatActieDatum = (iso: string): string => {
  try {
    return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' })
      .format(new Date(`${iso}T12:00:00`));
  } catch {
    return iso;
  }
};

const actieMetDatum = (
  omschrijving: string | null,
  datum: string,
  bron: VastgoedkansActieBron,
  vandaag: string,
): VastgoedkansActieContext => {
  const datumLabel = formatActieDatum(datum);
  if (datum < vandaag) {
    return {
      omschrijving: omschrijving ?? 'Opvolgen',
      datum,
      urgentie: 'verlopen',
      urgentieLabel: 'Verlopen',
      datumLabel,
      rang: 0,
      bron,
    };
  }
  if (datum === vandaag) {
    return {
      omschrijving: omschrijving ?? 'Opvolgen',
      datum,
      urgentie: 'vandaag',
      urgentieLabel: 'Vandaag',
      datumLabel,
      rang: 1,
      bron,
    };
  }
  return {
    omschrijving: omschrijving ?? 'Opvolgen',
    datum,
    urgentie: 'gepland',
    urgentieLabel: 'Gepland',
    datumLabel,
    rang: 2,
    bron,
  };
};

export function bepaalVastgoedkansActieContext(
  kans: Vastgoedkans,
  vandaag = vandaagNl(),
): VastgoedkansActieContext {
  const afgesloten = kans.status === 'afgevallen' || kans.status === 'gepromoveerd';
  const explicieteOmschrijving = kans.volgendeActieOmschrijving?.trim() || null;
  const explicieteDatum = kans.volgendeActieDatum ?? null;

  if (explicieteOmschrijving || explicieteDatum) {
    if (explicieteDatum) return actieMetDatum(explicieteOmschrijving, explicieteDatum, 'expliciet', vandaag);
    return {
      omschrijving: explicieteOmschrijving,
      datum: null,
      urgentie: 'zonder_datum',
      urgentieLabel: 'Datum ontbreekt',
      datumLabel: null,
      rang: 3,
      bron: 'expliciet',
    };
  }

  if (afgesloten) {
    return {
      omschrijving: null,
      datum: null,
      urgentie: 'geen_actie',
      urgentieLabel: 'Geen open actie',
      datumLabel: null,
      rang: 5,
      bron: 'geen',
    };
  }

  const legacyOmschrijving = kans.opvolgactie?.trim() || null;
  const legacyDatum = kans.opvolgdatum ?? null;
  if (legacyOmschrijving || legacyDatum) {
    if (legacyDatum) return actieMetDatum(legacyOmschrijving, legacyDatum, 'legacy', vandaag);
    return {
      omschrijving: legacyOmschrijving,
      datum: null,
      urgentie: 'zonder_datum',
      urgentieLabel: 'Datum ontbreekt',
      datumLabel: null,
      rang: 3,
      bron: 'legacy',
    };
  }

  const workflowActie = bouwVastgoedkansWorkflowReadModel(kans).nextAction;
  if (workflowActie) {
    if (workflowActie.dueAt) return actieMetDatum(workflowActie.label, workflowActie.dueAt, 'workflow', vandaag);
    return {
      omschrijving: workflowActie.label,
      datum: null,
      urgentie: 'processtap',
      urgentieLabel: 'Processtap',
      datumLabel: null,
      rang: 4,
      bron: 'workflow',
    };
  }

  return {
    omschrijving: null,
    datum: null,
    urgentie: 'geen_actie',
    urgentieLabel: 'Geen volgende actie',
    datumLabel: null,
    rang: 5,
    bron: 'geen',
  };
}

export function listWorkspaceZichtbareSelectieIds(
  geselecteerd: ReadonlySet<string>,
  zichtbareIds: readonly string[],
): string[] {
  return zichtbareIds.filter((id) => geselecteerd.has(id));
}

export function listWorkspaceAlleZichtbaarGeselecteerd(
  geselecteerd: ReadonlySet<string>,
  zichtbareIds: readonly string[],
): boolean {
  return zichtbareIds.length > 0 && zichtbareIds.every((id) => geselecteerd.has(id));
}

export function toggleListWorkspaceZichtbareIds(
  geselecteerd: ReadonlySet<string>,
  zichtbareIds: readonly string[],
): Set<string> {
  const volgende = new Set(geselecteerd);
  if (listWorkspaceAlleZichtbaarGeselecteerd(geselecteerd, zichtbareIds)) {
    zichtbareIds.forEach((id) => volgende.delete(id));
  } else {
    zichtbareIds.forEach((id) => volgende.add(id));
  }
  return volgende;
}

export function listWorkspaceSelectieLabel(
  geselecteerd: ReadonlySet<string>,
  zichtbareIds: readonly string[],
): string {
  const zichtbaar = listWorkspaceZichtbareSelectieIds(geselecteerd, zichtbareIds).length;
  return geselecteerd.size === zichtbaar
    ? `${geselecteerd.size} geselecteerd`
    : `${geselecteerd.size} geselecteerd · ${zichtbaar} zichtbaar`;
}

const STORAGE_KEY = 'bito-vastgoedkansen-werkcontext-v1';
const LIST_STORAGE_KEY = 'bito-vastgoedkansen-list-workspace-v1';

export const DEFAULT_VASTGOEDKANS_LIJST_WORKSPACE: VastgoedkansLijstWorkspaceState = {
  werkbak: 'te_beoordelen',
  zoekterm: '',
  sortering: 'recent',
  filters: { prioriteiten: [], herkomsten: [], eigenaar: [], brief: [] },
};

export function bepaalPrimaireWerkTab(kans: Vastgoedkans): VastgoedkansWerkTab {
  if (!kans.bagPandId && !kans.bagVerblijfsobjectId) return 'onderzoek';
  if (kans.kadasterStatus !== 'gegevens_bekend' || kans.eigenaarStatus !== 'bekend') return 'kadaster';
  if (kans.briefStatus !== 'verzonden' && kans.briefStatus !== 'reactie_ontvangen') return 'brieven';
  return kans.status === 'opvolgen' || kans.status === 'wachten' ? 'brieven' : 'overzicht';
}

export function bouwEigenaarGoogleUrl(naam: string, plaats?: string | null): string | null {
  const schoon = naam.trim();
  if (!schoon) return null;
  const query = [`\"${schoon}\"`, plaats?.trim(), 'vastgoed'].filter(Boolean).join(' ');
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export function leesVastgoedkansWerkcontext(): VastgoedkansWerkcontext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as VastgoedkansWerkcontext;
    if (!value?.kansId || !['overzicht', 'onderzoek', 'kadaster', 'brieven', 'dossier'].includes(value.tab)) return null;
    return value;
  } catch {
    return null;
  }
}

export function bewaarVastgoedkansWerkcontext(context: Omit<VastgoedkansWerkcontext, 'bijgewerktOp'>): void {
  if (typeof window === 'undefined') return;
  let volgende = context;
  if (context.zoekterm === undefined) {
    const bestaand = leesVastgoedkansWerkcontext();
    if (bestaand?.ids?.includes(context.kansId)) {
      volgende = {
        ...context,
        werkbak: bestaand.werkbak ?? context.werkbak,
        zoekterm: bestaand.zoekterm,
        ids: bestaand.ids,
      };
    }
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...volgende, bijgewerktOp: new Date().toISOString() }));
}

export function bepaalWerkcontextNavigatie(ids: string[], huidigId: string) {
  const opgeslagen = leesVastgoedkansWerkcontext();
  const effectieveIds = opgeslagen?.ids?.includes(huidigId) ? opgeslagen.ids : ids;
  const index = effectieveIds.indexOf(huidigId);
  return {
    index,
    total: effectieveIds.length,
    vorigeId: index > 0 ? effectieveIds[index - 1] : null,
    volgendeId: index >= 0 && index < effectieveIds.length - 1 ? effectieveIds[index + 1] : null,
  };
}

const geldigWerkbak = (waarde: unknown): waarde is VastgoedkansWerkbak =>
  typeof waarde === 'string' && ['te_beoordelen','onderzoek','brief_voorbereiden','opvolgen','wachten','positieve_reactie','afgevallen','gepromoveerd','alles','archief'].includes(waarde);
const geldigSortering = (waarde: unknown): waarde is VastgoedkansSortering =>
  typeof waarde === 'string' && ['recent','werkvolgorde','prioriteit','score','adres','opvolgdatum'].includes(waarde);
const strings = <T extends string>(waarde: unknown): T[] => Array.isArray(waarde) ? waarde.filter((x): x is T => typeof x === 'string') : [];
const prioriteiten = (waarde: unknown): number[] => Array.isArray(waarde) ? waarde.filter((x): x is number => Number.isInteger(x) && x >= 1 && x <= 5) : [];

export function leesVastgoedkansLijstWorkspace(): VastgoedkansLijstWorkspaceState {
  if (typeof window === 'undefined') return DEFAULT_VASTGOEDKANS_LIJST_WORKSPACE;
  try {
    const raw = window.localStorage.getItem(LIST_STORAGE_KEY);
    if (!raw) return DEFAULT_VASTGOEDKANS_LIJST_WORKSPACE;
    const value = JSON.parse(raw) as Partial<VastgoedkansLijstWorkspaceState>;
    const filters = value.filters ?? ({} as VastgoedkansLijstFilters);
    return {
      werkbak: geldigWerkbak(value.werkbak) ? value.werkbak : 'te_beoordelen',
      zoekterm: typeof value.zoekterm === 'string' ? value.zoekterm : '',
      sortering: geldigSortering(value.sortering) ? value.sortering : 'recent',
      filters: {
        prioriteiten: prioriteiten(filters.prioriteiten),
        herkomsten: strings<VastgoedkansHerkomst>(filters.herkomsten),
        eigenaar: strings<EigenaarOnderzoekStatus>(filters.eigenaar),
        brief: strings<BriefStatus>(filters.brief),
      },
    };
  } catch {
    return DEFAULT_VASTGOEDKANS_LIJST_WORKSPACE;
  }
}

export function bewaarVastgoedkansLijstWorkspace(state: VastgoedkansLijstWorkspaceState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LIST_STORAGE_KEY, JSON.stringify(state));
}

const norm = normaliseerListWorkspaceZoektekst;
const millis = (waarde: string | null | undefined): number | null => {
  if (!waarde) return null;
  const n = Date.parse(waarde);
  return Number.isNaN(n) ? null : n;
};
const cmpNullable = (a: number | null, b: number | null, desc = false): number => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return desc ? b - a : a - b;
};

export function filterEnSorteerVastgoedkansen(kansen: Vastgoedkans[], state: VastgoedkansLijstWorkspaceState): Vastgoedkans[] {
  const q = norm(state.zoekterm.trim());
  const lijst = kansen.filter((kans) => {
    if (state.werkbak !== 'alles' && state.werkbak !== 'archief' && kans.status !== state.werkbak) return false;
    const actie = bepaalVastgoedkansActieContext(kans);
    if (q && !norm([
      kans.korteOmschrijving,
      kans.adres,
      kans.postcode,
      kans.plaats,
      kans.provincie,
      kans.typeVastgoed,
      kans.redenInteressant,
      kans.eigenaarNaam,
      kans.kansnummer,
      kans.volgendeActieOmschrijving,
      kans.opvolgactie,
      actie.omschrijving,
    ].filter(Boolean).join(' ')).includes(q)) return false;
    if (state.filters.prioriteiten.length && !state.filters.prioriteiten.includes(kans.prioriteit)) return false;
    if (state.filters.herkomsten.length && !state.filters.herkomsten.includes(kans.herkomst)) return false;
    if (state.filters.eigenaar.length && !state.filters.eigenaar.includes(kans.eigenaarStatus)) return false;
    if (state.filters.brief.length && !state.filters.brief.includes(kans.briefStatus)) return false;
    return true;
  });
  return [...lijst].sort((a, b) => {
    let verschil = 0;
    if (state.sortering === 'werkvolgorde') {
      const actieA = bepaalVastgoedkansActieContext(a);
      const actieB = bepaalVastgoedkansActieContext(b);
      verschil = actieA.rang - actieB.rang;
      if (verschil === 0) verschil = cmpNullable(millis(actieA.datum), millis(actieB.datum));
      if (verschil === 0) verschil = a.prioriteit - b.prioriteit;
    }
    if (state.sortering === 'prioriteit') verschil = a.prioriteit - b.prioriteit;
    if (state.sortering === 'score') verschil = cmpNullable(a.algoritmeScore, b.algoritmeScore, true);
    if (state.sortering === 'adres') verschil = norm([a.plaats,a.adres].filter(Boolean).join(' ')).localeCompare(norm([b.plaats,b.adres].filter(Boolean).join(' ')), 'nl');
    if (state.sortering === 'opvolgdatum') {
      const actieA = bepaalVastgoedkansActieContext(a);
      const actieB = bepaalVastgoedkansActieContext(b);
      verschil = cmpNullable(millis(actieA.datum), millis(actieB.datum));
    }
    if (state.sortering === 'recent' || verschil === 0) verschil = cmpNullable(millis(a.updatedAt), millis(b.updatedAt), true);
    return verschil || a.id.localeCompare(b.id);
  });
}

export const telActieveVastgoedkansFilters = (filters: VastgoedkansLijstFilters): number =>
  filters.prioriteiten.length + filters.herkomsten.length + filters.eigenaar.length + filters.brief.length;
export const legeVastgoedkansFilters = (): VastgoedkansLijstFilters => ({ prioriteiten: [], herkomsten: [], eigenaar: [], brief: [] });