// Centrale configuratie voor de Vastgoedrekenen workspace.
// Eén bron voor: volgorde, labels, numbering, rail-items, sub-secties,
// strategie-relevantie en default open/dicht.

export type SectionKey =
  | 'cockpit'
  | 'aankoop'
  | 'opbrengsten'
  | 'bouwkosten'
  | 'componenten'
  | 'wws'
  | 'onderbouwing';

export type SubSectionKey =
  | 'sec-waterfall'
  | 'sec-aankoop'
  | 'sec-huur'
  | 'sec-verkoop'
  | 'sec-kosten'
  | 'sec-componenten'
  | 'sec-strategie'
  | 'sec-wws'
  | 'sec-onderbouwing'
  | 'sec-score'
  | 'sec-notities';

export type ChapterConfig = {
  key: SectionKey;
  title: string;
  hint?: string;
  /** Sub-secties die binnen dit hoofdstuk gerenderd worden. */
  subs: SubSectionKey[];
  /** Of dit hoofdstuk relevant is in de Strategie-view (uitponden / componentstrategie). */
  strategieRelevant: boolean;
};

/**
 * Hoofdstukken in rendervolgorde. Workflowrail en hoofdcontent gebruiken
 * dezelfde volgorde, zodat numbering en navigatie nooit uit de pas lopen.
 */
export const CHAPTERS: ChapterConfig[] = [
  {
    key: 'cockpit',
    title: 'Scenario-cockpit / resultaat',
    hint: 'Detail: conclusie, aandachtspunten en €/m²-kengetallen',
    subs: ['sec-waterfall'],
    strategieRelevant: true,
  },
  {
    key: 'aankoop',
    title: 'Aankoop & uitgangspunten',
    hint: 'Vraagprijs, beoogde aankoop, OVB, financiering',
    subs: ['sec-aankoop'],
    strategieRelevant: true,
  },
  {
    key: 'opbrengsten',
    title: 'Opbrengsten',
    hint: 'Huur, exploitatie en verkoop / exit',
    subs: ['sec-huur', 'sec-verkoop'],
    strategieRelevant: false,
  },
  {
    key: 'bouwkosten',
    title: 'Bouw-/renovatiekosten',
    hint: 'Bouwkosten, btw en overdrachtsbelasting',
    subs: ['sec-kosten'],
    strategieRelevant: true,
  },
  {
    key: 'componenten',
    title: 'Componenten & strategie',
    hint: 'Per-unit invoer + verkoop-/houdstrategie',
    subs: ['sec-componenten', 'sec-strategie'],
    strategieRelevant: true,
  },
  {
    key: 'wws',
    title: 'WWS / huursegment',
    hint: 'Puntentelling en huursegment per woonunit',
    subs: ['sec-wws'],
    strategieRelevant: false,
  },
  {
    key: 'onderbouwing',
    title: 'Onderbouwing & audit',
    hint: 'Aannames, score-uitleg en notities',
    subs: ['sec-onderbouwing', 'sec-score', 'sec-notities'],
    strategieRelevant: false,
  },
];

export const ALL_SUB_SECTION_KEYS: SubSectionKey[] = CHAPTERS.flatMap((c) => c.subs);

/** Dynamische numbering op basis van zichtbare hoofdstukken in rendervolgorde. */
export function chapterNumber(
  key: SectionKey,
  visibleKeys: SectionKey[] = CHAPTERS.map((c) => c.key),
): string {
  const idx = visibleKeys.indexOf(key);
  return idx >= 0 ? String(idx + 1).padStart(2, '0') : '';
}

/** Sub-secties die in de Strategie-view standaard open zijn. */
export const STRATEGIE_VIEW_OPEN: SubSectionKey[] = [
  'sec-waterfall',
  'sec-componenten',
  'sec-strategie',
  'sec-aankoop',
];

export function buildStrategieOpenState(): Record<SubSectionKey, boolean> {
  const out = {} as Record<SubSectionKey, boolean>;
  for (const k of ALL_SUB_SECTION_KEYS) out[k] = STRATEGIE_VIEW_OPEN.includes(k);
  return out;
}

export function buildUniformOpenState(open: boolean): Record<SubSectionKey, boolean> {
  const out = {} as Record<SubSectionKey, boolean>;
  for (const k of ALL_SUB_SECTION_KEYS) out[k] = open;
  return out;
}
