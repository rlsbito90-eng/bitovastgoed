import type { TaakPrioriteit, TaakStatus } from '@/data/mock-data';

export type TakenTab = 'focus' | 'vandaag' | 'te_laat' | 'deze_week' | 'wachten' | 'alles' | 'afgerond';

export interface TakenViewState {
  zoek: string;
  prioriteitFilter: TaakPrioriteit | '';
  typeFilter: string;
  statusFilter: TaakStatus | '';
  tab: TakenTab;
}

const KEY = 'crm:taken:view-state:v1';
const TABS = new Set<TakenTab>(['focus', 'vandaag', 'te_laat', 'deze_week', 'wachten', 'alles', 'afgerond']);
const PRIORITEITEN = new Set(['urgent', 'hoog', 'normaal', 'laag']);
const STATUSSEN = new Set(['open', 'wacht_op_reactie', 'in_uitvoering', 'afgerond', 'geannuleerd']);

export const DEFAULT_TAKEN_VIEW_STATE: TakenViewState = {
  zoek: '',
  prioriteitFilter: '',
  typeFilter: '',
  statusFilter: '',
  tab: 'focus',
};

export function loadTakenViewState(): TakenViewState {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return DEFAULT_TAKEN_VIEW_STATE;
    const parsed = JSON.parse(raw) as Partial<TakenViewState>;
    return {
      zoek: typeof parsed.zoek === 'string' ? parsed.zoek : '',
      prioriteitFilter: PRIORITEITEN.has(parsed.prioriteitFilter ?? '')
        ? parsed.prioriteitFilter as TaakPrioriteit
        : '',
      typeFilter: typeof parsed.typeFilter === 'string' ? parsed.typeFilter : '',
      statusFilter: STATUSSEN.has(parsed.statusFilter ?? '')
        ? parsed.statusFilter as TaakStatus
        : '',
      tab: TABS.has(parsed.tab as TakenTab) ? parsed.tab as TakenTab : 'focus',
    };
  } catch {
    return DEFAULT_TAKEN_VIEW_STATE;
  }
}

export function saveTakenViewState(state: TakenViewState): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Niet fataal: de takenpagina blijft gewoon bruikbaar zonder herstelcontext.
  }
}
