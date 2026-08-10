import type { DealFase } from '@/data/mock-data';

export type DealsArchiefView = 'actief' | 'archief' | 'alles';

export interface DealsViewState {
  zoek: string;
  faseFilter: DealFase | '';
  archiefView: DealsArchiefView;
}

const KEY = 'crm:deals:view-state:v1';
const FASES = new Set([
  'lead', 'introductie', 'interesse', 'bezichtiging', 'bieding',
  'onderhandeling', 'closing', 'afgerond', 'afgevallen',
]);
const ARCHIEF_VIEWS = new Set<DealsArchiefView>(['actief', 'archief', 'alles']);

export const DEFAULT_DEALS_VIEW_STATE: DealsViewState = {
  zoek: '',
  faseFilter: '',
  archiefView: 'actief',
};

export function loadDealsViewState(): DealsViewState {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return DEFAULT_DEALS_VIEW_STATE;
    const parsed = JSON.parse(raw) as Partial<DealsViewState>;
    return {
      zoek: typeof parsed.zoek === 'string' ? parsed.zoek : '',
      faseFilter: FASES.has(parsed.faseFilter ?? '')
        ? parsed.faseFilter as DealFase
        : '',
      archiefView: ARCHIEF_VIEWS.has(parsed.archiefView as DealsArchiefView)
        ? parsed.archiefView as DealsArchiefView
        : 'actief',
    };
  } catch {
    return DEFAULT_DEALS_VIEW_STATE;
  }
}

export function saveDealsViewState(state: DealsViewState): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Niet fataal: zonder sessionStorage blijft de lijst volledig bruikbaar.
  }
}
