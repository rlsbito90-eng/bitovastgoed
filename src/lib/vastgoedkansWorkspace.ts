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

  // Een gesloten dossier wordt niet door alleen een beschrijvende resttekst opnieuw
  // een actieve werkactie. Alleen een bewust vastgelegde nieuwe actiedatum kan dat doen.
  if (afgesloten && !explicieteDatum) {
    return {
      omschrijving: explicieteOmschrijving,
      datum: null,
      urgentie: 'geen_actie',
      urgentieLabel: 'Geen open actie',
      datumLabel: null,
      rang: 5,
      bron: explicieteOmschrijving ? 'expliciet' : 'geen',
    };
  }

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
  werkbak: 'te_beoordelen', zoekterm: '', sortering: 'recent', filters: { prioriteiten: [], herkomsten: [], eigenaar: [], brief: [] },
};

const KADASTER_WORKFLOW_CODES = new Set(['eigenaar_bevestigen', 'rechthebbenden_controleren', 'eigenaar_heronderzoek']);
const BRIEVEN_WORKFLOW_CODES = new Set([
  'brief_voorbereiden', 'brief_controleren', 'opvolgen', 'vervolg_interesse', 'informatie_sturen',
  'later_bellen', 'reactie_beoordelen',
]);
const OVERZICHT_WORKFLOW_CODES = new Set(['beoordelen', 'herbeoordelen', 'afsluiten_beoordelen']);

export function bepaalPrimaireWerkTab(kans: Vastgoedkans): VastgoedkansWerkTab {
  if (!kans.bagPandId && !kans.bagVerblijfsobjectId) return 'onderzoek';

  // Oudere/incomplete read-models kunnen zonder tijdlijnvelden binnenkomen. In dat
  // geval blijft de bewezen statusfallback leidend en raadplegen we de workflow-engine
  // pas zodra createdAt/updatedAt beschikbaar zijn.
  const heeftWorkflowTijdlijn = typeof kans.createdAt === 'string' && kans.createdAt.length > 0
    && typeof kans.updatedAt === 'string' && kans.updatedAt.length > 0;
  const actieCode = heeftWorkflowTijdlijn
    ? bouwVastgoedkansWorkflowReadModel(kans).nextAction?.code ?? null
    : null;

  if (actieCode && KADASTER_WORKFLOW_CODES.has(actieCode)) return 'kadaster';
  if (actieCode && BRIEVEN_WORKFLOW_CODES.has(actieCode)) return 'brieven';
  if (actieCode && OVERZICHT_WORKFLOW_CODES.has(actieCode)) return 'overzicht';

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
  } catch { return null; }
}

export function bewaarVastgoedkansWerkcontext(context: Omit<VastgoedkansWerkcontext, 'bijgewerktOp'>): void {
  if (typeof window === 'undefined') return;
  let volgende = context;
  if (context.zoekterm === undefined) {
    const bestaand = leesVastgoedkansWerkcontext();
    if (bestaand?.ids?.includes(context.kansId)) {
      volgende = { ...context, werkbak: bestaand.werkbak ?? context.werkbak, zoekterm: bestaand.zoekterm, ids: bestaand.ids };
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
    if (state.filters.prioriteiten.length > 0 && !state.filters.prioriteiten.includes(kans.prioriteit)) return false;
    if (state.filters.herkomsten.length > 0 && !state.filters.herkomsten.includes(kans.herkomst)) return false;
    if (state.filters.eigenaar.length > 0 && !state.filters.eigenaar.includes(kans.eigenaarStatus)) return false;
    if (state.filters.brief.length > 0 && !state.filters.brief.includes(kans.briefStatus)) return false;
    if (!q) return true;
    const actie = bepaalVastgoedkansActieContext(kans);
    return norm([
      kans.kansnummer, kans.adres, kans.postcode, kans.plaats, kans.korteOmschrijving, kans.typeVastgoed,
      kans.eigenaarNaam, kans.redenInteressant, kans.notities, kans.opvolgactie, kans.volgendeActieOmschrijving,
      actie.omschrijving,
    ].filter(Boolean).join(' ')).includes(q);
  });

  return [...lijst].sort((a, b) => {
    if (state.sortering === 'werkvolgorde') {
      const aa = bepaalVastgoedkansActieContext(a);
      const bb = bepaalVastgoedkansActieContext(b);
      return aa.rang - bb.rang
        || cmpNullable(millis(aa.datum), millis(bb.datum))
        || (b.prioriteit ?? 0) - (a.prioriteit ?? 0)
        || (millis(b.updatedAt) ?? 0) - (millis(a.updatedAt) ?? 0);
    }
    if (state.sortering === 'prioriteit') return (b.prioriteit ?? 0) - (a.prioriteit ?? 0) || (millis(b.updatedAt) ?? 0) - (millis(a.updatedAt) ?? 0);
    if (state.sortering === 'score') return (b.algoritmeScore ?? -Infinity) - (a.algoritmeScore ?? -Infinity) || (millis(b.updatedAt) ?? 0) - (millis(a.updatedAt) ?? 0);
    if (state.sortering === 'adres') return `${a.plaats ?? ''} ${a.adres ?? ''}`.localeCompare(`${b.plaats ?? ''} ${b.adres ?? ''}`, 'nl');
    if (state.sortering === 'opvolgdatum') {
      const aa = bepaalVastgoedkansActieContext(a);
      const bb = bepaalVastgoedkansActieContext(b);
      return cmpNullable(millis(aa.datum), millis(bb.datum)) || (millis(b.updatedAt) ?? 0) - (millis(a.updatedAt) ?? 0);
    }
    return (millis(b.updatedAt) ?? 0) - (millis(a.updatedAt) ?? 0);
  });
}

export function legeVastgoedkansFilters(): VastgoedkansLijstFilters {
  return { prioriteiten: [], herkomsten: [], eigenaar: [], brief: [] };
}

export function telActieveVastgoedkansFilters(filters: VastgoedkansLijstFilters): number {
  return filters.prioriteiten.length + filters.herkomsten.length + filters.eigenaar.length + filters.brief.length;
}
