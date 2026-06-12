// Herbruikbare lijst-navigatie helper voor detailpagina's (Vorige/Volgende).
// Slaat de gefilterde/gesorteerde ID-volgorde op in sessionStorage zodat
// de detailpagina door de lijst kan bladeren in dezelfde context.

const PREFIX = 'list-nav:';

export function saveListContext(key: string, ids: string[]): void {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export function loadListContext(key: string): string[] | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : null;
  } catch {
    return null;
  }
}

export interface ListNavigationInfo {
  prevId: string | null;
  nextId: string | null;
  index: number; // 0-based; -1 als niet gevonden
  total: number;
}

export function getListNavigation(key: string, currentId: string, fallbackIds: string[]): ListNavigationInfo {
  const stored = loadListContext(key);
  const ids = stored && stored.length > 0 ? stored : fallbackIds;
  const idx = ids.indexOf(currentId);
  if (idx === -1) {
    return { prevId: null, nextId: null, index: -1, total: ids.length };
  }
  return {
    prevId: idx > 0 ? ids[idx - 1] : null,
    nextId: idx < ids.length - 1 ? ids[idx + 1] : null,
    index: idx,
    total: ids.length,
  };
}

// ─── Laatst bekeken-helper voor scrollherstel en highlight ───────────────────
const LAST_VIEWED_PREFIX = 'list-last-viewed:';

export interface ListLastViewed {
  id: string;
  scrollY: number;
  ts: number;
}

export function saveListLastViewed(key: string, payload: ListLastViewed): void {
  try {
    sessionStorage.setItem(LAST_VIEWED_PREFIX + key, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function loadListLastViewed(key: string): ListLastViewed | null {
  try {
    const raw = sessionStorage.getItem(LAST_VIEWED_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed && typeof parsed === 'object'
      && typeof parsed.id === 'string'
      && typeof parsed.scrollY === 'number'
      && typeof parsed.ts === 'number'
    ) return parsed as ListLastViewed;
    return null;
  } catch {
    return null;
  }
}

export function clearListLastViewed(key: string): void {
  try { sessionStorage.removeItem(LAST_VIEWED_PREFIX + key); } catch { /* ignore */ }
}

