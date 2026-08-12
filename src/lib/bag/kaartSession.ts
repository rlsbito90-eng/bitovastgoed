import type { BagKaartPandRij } from './kaartModel';

export interface BagKaartViewState {
  longitude: number;
  latitude: number;
  zoom: number;
}

interface BagKaartSessie {
  versie: 1;
  scopeCode: string;
  filterKey: string;
  rows: BagKaartPandRij[];
  heeftGezocht: boolean;
  viewState: BagKaartViewState;
}

function sleutel(scopeCode: string): string {
  return `bito:bag:pandenverkenner:kaart:v1:${scopeCode}`;
}

export function leesKaartSessie(scopeCode: string, filterKey: string): BagKaartSessie | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(sleutel(scopeCode));
    if (!raw) return null;
    const sessie = JSON.parse(raw) as BagKaartSessie;
    return sessie.versie === 1 && sessie.scopeCode === scopeCode && sessie.filterKey === filterKey ? sessie : null;
  } catch {
    return null;
  }
}

export function bewaarKaartSessie(input: Omit<BagKaartSessie, 'versie'>): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(sleutel(input.scopeCode), JSON.stringify({ ...input, versie: 1 } satisfies BagKaartSessie));
  } catch {
    // De kaart blijft functioneren als browsersessie-opslag niet beschikbaar is.
  }
}
