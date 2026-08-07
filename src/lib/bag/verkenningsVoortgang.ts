import type { BagVerkennerFilters } from './pandenverkennerModel';

export interface BagVerkenningsVoortgang {
  scopeCode: string;
  paginaNummer: number;
  startCursor: string | null;
  filters?: BagVerkennerFilters;
  opgeslagenOp: string;
}

const OPSLAG_PREFIX = 'bito:bag-pandenverkenner:voortgang:';

function opslagSleutel(scopeCode: string): string {
  return `${OPSLAG_PREFIX}${scopeCode}`;
}

function geldigeFilters(value: unknown): value is BagVerkennerFilters {
  if (!value || typeof value !== 'object') return false;
  const filters = value as Partial<BagVerkennerFilters>;
  return typeof filters.zoekterm === 'string'
    && Array.isArray(filters.gebruiksdoelen)
    && filters.gebruiksdoelen.every(item => typeof item === 'string')
    && typeof filters.alleenGemengd === 'boolean'
    && ['adres', 'bouwjaar', 'oppervlakte', 'identificatie'].includes(String(filters.sortering));
}

export function leesBagVerkenningsVoortgang(scopeCode: string): BagVerkenningsVoortgang | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(opslagSleutel(scopeCode));
    if (!raw) return null;
    const waarde = JSON.parse(raw) as Partial<BagVerkenningsVoortgang>;
    if (
      waarde.scopeCode !== scopeCode ||
      !Number.isInteger(waarde.paginaNummer) ||
      Number(waarde.paginaNummer) < 1 ||
      !(waarde.startCursor === null || typeof waarde.startCursor === 'string') ||
      !(waarde.filters === undefined || geldigeFilters(waarde.filters)) ||
      typeof waarde.opgeslagenOp !== 'string'
    ) return null;
    return waarde as BagVerkenningsVoortgang;
  } catch {
    return null;
  }
}

export function bewaarBagVerkenningsVoortgang(
  scopeCode: string,
  paginaNummer: number,
  startCursor: string | null,
  filters?: BagVerkennerFilters,
): BagVerkenningsVoortgang | null {
  if (typeof window === 'undefined' || !Number.isInteger(paginaNummer) || paginaNummer < 1) return null;
  const waarde: BagVerkenningsVoortgang = {
    scopeCode,
    paginaNummer,
    startCursor,
    filters,
    opgeslagenOp: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(opslagSleutel(scopeCode), JSON.stringify(waarde));
    return waarde;
  } catch {
    return null;
  }
}

export function wisBagVerkenningsVoortgang(scopeCode: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(opslagSleutel(scopeCode));
  } catch {
    // Browseropslag is een UX-hulpmiddel; blokkades hierin mogen de BAG-verkenner niet blokkeren.
  }
}
