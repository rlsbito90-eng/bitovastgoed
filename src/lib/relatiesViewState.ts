import type { LeadStatus, PartijType } from '@/data/mock-data';

export interface RelatiesViewState {
  zoek: string;
  statusFilter: LeadStatus | '';
  typeFilter: PartijType | '';
}

const KEY = 'crm:relaties:view-state:v1';
const STATUSSEN = new Set(['koud', 'lauw', 'warm', 'actief']);
const TYPES = new Set(['belegger', 'ontwikkelaar', 'eigenaar', 'makelaar', 'partner']);

export const DEFAULT_RELATIES_VIEW_STATE: RelatiesViewState = {
  zoek: '',
  statusFilter: '',
  typeFilter: '',
};

export function loadRelatiesViewState(): RelatiesViewState {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return DEFAULT_RELATIES_VIEW_STATE;
    const parsed = JSON.parse(raw) as Partial<RelatiesViewState>;
    return {
      zoek: typeof parsed.zoek === 'string' ? parsed.zoek : '',
      statusFilter: STATUSSEN.has(parsed.statusFilter ?? '')
        ? parsed.statusFilter as LeadStatus
        : '',
      typeFilter: TYPES.has(parsed.typeFilter ?? '')
        ? parsed.typeFilter as PartijType
        : '',
    };
  } catch {
    return DEFAULT_RELATIES_VIEW_STATE;
  }
}

export function saveRelatiesViewState(state: RelatiesViewState): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Niet fataal: zonder sessionStorage blijft de lijst volledig bruikbaar.
  }
}
