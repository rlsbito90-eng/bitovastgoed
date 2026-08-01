// Subnavigatie voor de Vastgoedrekenen-werkruimte.
// Sectiekeuze loopt via de queryparameter `sectie` op de bestaande /vastgoedrekenen-route,
// zodat de route zelf geldig blijft en er geen routerwijziging nodig is.

export const VR_WORKSPACE_QUERY_PARAM = 'sectie';

export const VR_WORKSPACE_SECTIONS = [
  'start',
  'projecten',
  'quickscans',
  'scenarios',
  'resultaten',
  'bibliotheek',
  'bronbeheer',
] as const;

export type VrWorkspaceSection = (typeof VR_WORKSPACE_SECTIONS)[number];

export const VR_WORKSPACE_DEFAULT_SECTION: VrWorkspaceSection = 'start';

export const VR_WORKSPACE_LABELS: Record<VrWorkspaceSection, string> = {
  start: 'Startpagina',
  projecten: 'Projecten & cases',
  quickscans: 'Quickscans',
  scenarios: "Scenario's",
  resultaten: 'Resultaten',
  bibliotheek: 'Bibliotheek',
  bronbeheer: 'Bronbeheer',
};

export function isVrWorkspaceSection(value: unknown): value is VrWorkspaceSection {
  return typeof value === 'string' && (VR_WORKSPACE_SECTIONS as readonly string[]).includes(value);
}

/** Leest de sectie uit een querystring; valt veilig terug op de standaardsectie. */
export function resolveVrWorkspaceSection(search: string): VrWorkspaceSection {
  const raw = new URLSearchParams(search).get(VR_WORKSPACE_QUERY_PARAM);
  return isVrWorkspaceSection(raw) ? raw : VR_WORKSPACE_DEFAULT_SECTION;
}

/** Bouwt de link naar een sectie van de werkruimte. */
export function buildVrWorkspaceHref(section: VrWorkspaceSection): string {
  if (section === VR_WORKSPACE_DEFAULT_SECTION) return '/vastgoedrekenen';
  return `/vastgoedrekenen?${VR_WORKSPACE_QUERY_PARAM}=${section}`;
}

export const VR_WORKSPACE_NAV_ITEMS: { section: VrWorkspaceSection; label: string; href: string }[] =
  VR_WORKSPACE_SECTIONS.map((section) => ({
    section,
    label: VR_WORKSPACE_LABELS[section],
    href: buildVrWorkspaceHref(section),
  }));
