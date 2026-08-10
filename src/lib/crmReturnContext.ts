// Centrale return-context voor CRM-detailroutes.
//
// Doel: een detailpagina weet expliciet naar welke werkcontext "Terug" hoort
// te navigeren, zonder afhankelijk te zijn van browser history. Alleen interne
// absolute app-paden worden geaccepteerd.

export interface CrmReturnContext {
  path: string;
  label?: string;
  source?: string;
}

export interface CrmNavigationState {
  returnContext?: CrmReturnContext;
}

export function isVeiligInternPad(path: unknown): path is string {
  return typeof path === 'string'
    && path.startsWith('/')
    && !path.startsWith('//')
    && !path.includes('://');
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
