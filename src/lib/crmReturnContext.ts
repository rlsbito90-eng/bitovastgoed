// Centrale return-context voor CRM-detailroutes.
//
// Doel: een detailpagina weet expliciet naar welke werkcontext "Terug" hoort
// te navigeren, zonder afhankelijk te zijn van een toevallig opgebouwde
// browser-history. Alleen interne absolute app-paden worden geaccepteerd.

export interface CrmReturnContext {
  path: string;
  label?: string;
  source?: string;
}

export interface CrmNavigationState {
  returnContext?: CrmReturnContext;
}

export const CRM_DETAIL_MODULES = [
  'relaties',
  'objecten',
  'deals',
  'taken',
  'off-market',
  'acquisitie',
  'vastgoedkansen',
] as const;
export type CrmDetailModule = (typeof CRM_DETAIL_MODULES)[number];

const ORIGIN_PREFIX = 'crm-detail-origin:';

export function isVeiligInternPad(path: unknown): path is string {
  return typeof path === 'string'
    && path.startsWith('/')
    && !path.startsWith('//')
    && !path.includes('://');
}

export function getCrmDetailModule(pathname: string): CrmDetailModule | null {
  const standaard = pathname.match(/^\/(relaties|objecten|deals|taken|off-market)\/[^/]+\/?$/);
  if (standaard) return standaard[1] as CrmDetailModule;
  if (/^\/acquisitie\/(?:targets|campagnes)\/[^/]+\/?$/.test(pathname)) return 'acquisitie';
  if (/^\/vastgoedkansen\/[^/]+\/?$/.test(pathname)) return 'vastgoedkansen';
  return null;
}

export function maakCrmReturnState(
  path: string,
  label?: string,
  source?: string,
): CrmNavigationState {
  if (!isVeiligInternPad(path)) {
    throw new Error('Ongeldig intern return-pad');
  }
  return {
    returnContext: {
      path,
      ...(label ? { label } : {}),
      ...(source ? { source } : {}),
    },
  };
}

export function leesCrmReturnContext(state: unknown): CrmReturnContext | null {
  if (!state || typeof state !== 'object') return null;
  const raw = (state as CrmNavigationState).returnContext;
  if (!raw || !isVeiligInternPad(raw.path)) return null;
  return {
    path: raw.path,
    label: typeof raw.label === 'string' ? raw.label : undefined,
    source: typeof raw.source === 'string' ? raw.source : undefined,
  };
}

/**
 * Bewaar de echte route waarvandaan een detailketen is gestart. Dit is bewust
 * session-scoped: filters/tabs/scroll-state in dezelfde browser-/appsessie
 * blijven daardoor intact, zonder een globale of persistente gebruikersstate.
 */
export function bewaarCrmDetailOrigin(
  module: CrmDetailModule,
  path: string,
  storage: Pick<Storage, 'setItem'> | null = typeof window === 'undefined' ? null : window.sessionStorage,
): void {
  if (!storage || !isVeiligInternPad(path)) return;
  try { storage.setItem(`${ORIGIN_PREFIX}${module}`, path); } catch { /* ignore */ }
}

export function leesCrmDetailOrigin(
  module: CrmDetailModule,
  storage: Pick<Storage, 'getItem'> | null = typeof window === 'undefined' ? null : window.sessionStorage,
): string | null {
  if (!storage) return null;
  try {
    const path = storage.getItem(`${ORIGIN_PREFIX}${module}`);
    return isVeiligInternPad(path) ? path : null;
  } catch {
    return null;
  }
}

/**
 * Alleen een overgang van niet-detail -> detail start een nieuwe detailketen.
 * Detail -> detail binnen dezelfde of een andere module mag de oorspronkelijke
 * herkomst nooit overschrijven; daarvoor bestaan Vorige/Volgende en expliciete
 * cross-module return-contexten.
 */
export function bepaalNieuweCrmDetailOrigin(args: {
  vorigePathname: string;
  vorigeVolledigePad: string;
  huidigePathname: string;
}): { module: CrmDetailModule; path: string } | null {
  const huidigeModule = getCrmDetailModule(args.huidigePathname);
  if (!huidigeModule) return null;
  if (getCrmDetailModule(args.vorigePathname)) return null;
  if (!isVeiligInternPad(args.vorigeVolledigePad)) return null;
  return { module: huidigeModule, path: args.vorigeVolledigePad };
}
