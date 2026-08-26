export const RADAR_BULK_SELECTIE_KEY = 'off-market-acq:bulk-selectie';

function storageBeschikbaar(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function leesRadarBulkSelectie(): Set<string> {
  if (!storageBeschikbaar()) return new Set();
  try {
    const raw = window.sessionStorage.getItem(RADAR_BULK_SELECTIE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0));
  } catch {
    return new Set();
  }
}

export function schrijfRadarBulkSelectie(ids: Iterable<string>): void {
  if (!storageBeschikbaar()) return;
  try {
    const uniek = [...new Set([...ids].filter(Boolean))];
    if (uniek.length === 0) {
      window.sessionStorage.removeItem(RADAR_BULK_SELECTIE_KEY);
      return;
    }
    window.sessionStorage.setItem(RADAR_BULK_SELECTIE_KEY, JSON.stringify(uniek));
  } catch {
    // Navigatie mag nooit stuklopen op storage-beperkingen.
  }
}

export function beperkRadarBulkSelectie(
  selectie: Iterable<string>,
  geldigeSignaalIds: Iterable<string>,
): Set<string> {
  const geldig = new Set(geldigeSignaalIds);
  return new Set([...selectie].filter((id) => geldig.has(id)));
}

export function setsZijnGelijk(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}
