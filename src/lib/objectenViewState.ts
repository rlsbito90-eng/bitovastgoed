import type { ObjectStatus } from '@/data/mock-data';

export type ObjectenArchiefView = 'actief' | 'archief' | 'alles';

export interface ObjectenViewState {
  zoek: string;
  typeFilter: string;
  subtypeFilter: string;
  dealtypeFilter: string;
  statusFilter: ObjectStatus | '';
  archiefView: ObjectenArchiefView;
}

const KEY = 'crm:objecten:view-state:v1';
const STATUSSEN = new Set([
  'te_beoordelen', 'beschikbaar', 'on_hold', 'onder_optie',
  'verkocht', 'ingetrokken', 'afgevallen',
]);
const ARCHIEF_VIEWS = new Set<ObjectenArchiefView>(['actief', 'archief', 'alles']);

export const DEFAULT_OBJECTEN_VIEW_STATE: ObjectenViewState = {
  zoek: '',
  typeFilter: '',
  subtypeFilter: '',
  dealtypeFilter: '',
  statusFilter: '',
  archiefView: 'actief',
};

export function loadObjectenViewState(): ObjectenViewState {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return DEFAULT_OBJECTEN_VIEW_STATE;
    const parsed = JSON.parse(raw) as Partial<ObjectenViewState>;
    return {
      zoek: typeof parsed.zoek === 'string' ? parsed.zoek : '',
      typeFilter: typeof parsed.typeFilter === 'string' ? parsed.typeFilter : '',
      subtypeFilter: typeof parsed.subtypeFilter === 'string' ? parsed.subtypeFilter : '',
      dealtypeFilter: typeof parsed.dealtypeFilter === 'string' ? parsed.dealtypeFilter : '',
      statusFilter: STATUSSEN.has(parsed.statusFilter ?? '')
        ? parsed.statusFilter as ObjectStatus
        : '',
      archiefView: ARCHIEF_VIEWS.has(parsed.archiefView as ObjectenArchiefView)
        ? parsed.archiefView as ObjectenArchiefView
        : 'actief',
    };
  } catch {
    return DEFAULT_OBJECTEN_VIEW_STATE;
  }
}

export function saveObjectenViewState(state: ObjectenViewState): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Niet fataal: zonder sessionStorage blijft de lijst volledig bruikbaar.
  }
}
