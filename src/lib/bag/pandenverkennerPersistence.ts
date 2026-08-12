import type { BagVerkennerFilters } from './pandenverkennerModel';

export interface BagPersistenteServerFilters {
  statussen: string[];
  wijkCodes: string[];
  buurtCodes: string[];
  bouwjaarVan: string;
  bouwjaarTot: string;
  vboSomVan: string;
  vboSomTot: string;
  vboMaxVan: string;
  vboMaxTot: string;
  vboAantalVan: string;
  vboAantalTot: string;
  vboModus: 'alle' | 'met_vbo' | 'zonder_vbo';
}

export interface BagWerkcontext {
  versie: 1;
  scopeCode: string;
  serverFilters: BagPersistenteServerFilters;
  filters: BagVerkennerFilters;
  weergave: 'zoeken' | 'kaart' | 'opgeslagen';
  toonMeerFilters: boolean;
  bijgewerktOp: string;
}

export interface BagZoekprofiel {
  id: string;
  naam: string;
  scopeCode: string;
  serverFilters: BagPersistenteServerFilters;
  filters: BagVerkennerFilters;
  aangemaaktOp: string;
  bijgewerktOp: string;
}

function veiligLees<T>(storage: Storage | undefined, sleutel: string): T | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(sleutel);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function veiligSchrijf(storage: Storage | undefined, sleutel: string, waarde: unknown): void {
  if (!storage) return;
  try {
    storage.setItem(sleutel, JSON.stringify(waarde));
  } catch {
    // Opslag is uitsluitend UX-state; een volle/geblokkeerde browseropslag mag de zoekfunctie nooit blokkeren.
  }
}

function sessie(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.sessionStorage;
}

function lokaal(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

export function werkcontextSleutel(scopeCode: string): string {
  return `bito:bag:pandenverkenner:werkcontext:v1:${scopeCode}`;
}

export function zoekprofielenSleutel(scopeCode: string): string {
  return `bito:bag:pandenverkenner:zoekprofielen:v1:${scopeCode}`;
}

export function leesWerkcontext(scopeCode: string): BagWerkcontext | null {
  const context = veiligLees<BagWerkcontext>(sessie(), werkcontextSleutel(scopeCode));
  return context?.versie === 1 && context.scopeCode === scopeCode ? context : null;
}

export function bewaarWerkcontext(context: Omit<BagWerkcontext, 'versie' | 'bijgewerktOp'>): void {
  veiligSchrijf(sessie(), werkcontextSleutel(context.scopeCode), {
    ...context,
    versie: 1,
    bijgewerktOp: new Date().toISOString(),
  } satisfies BagWerkcontext);
}

export function leesZoekprofielen(scopeCode: string): BagZoekprofiel[] {
  const profielen = veiligLees<BagZoekprofiel[]>(lokaal(), zoekprofielenSleutel(scopeCode));
  return Array.isArray(profielen) ? profielen.filter(profiel => profiel.scopeCode === scopeCode) : [];
}

export function bewaarZoekprofielen(scopeCode: string, profielen: BagZoekprofiel[]): void {
  veiligSchrijf(lokaal(), zoekprofielenSleutel(scopeCode), profielen);
}

export function maakZoekprofiel(input: {
  naam: string;
  scopeCode: string;
  serverFilters: BagPersistenteServerFilters;
  filters: BagVerkennerFilters;
}): BagZoekprofiel {
  const nu = new Date().toISOString();
  const cryptoId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return {
    id: cryptoId,
    naam: input.naam.trim(),
    scopeCode: input.scopeCode,
    serverFilters: input.serverFilters,
    filters: input.filters,
    aangemaaktOp: nu,
    bijgewerktOp: nu,
  };
}
