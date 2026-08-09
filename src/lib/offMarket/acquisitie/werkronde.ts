// Persistente, hervatbare werkronde voor de Acquisitieselectie.
//
// Opslag: localStorage per gebruiker/browser (geen database-migratie).
// De werkronde legt een vaste scope (momentopname) vast, zodat
// proceswijzigingen tijdens de ronde geen items laten verdwijnen.

export type WerkrondeBron =
  | 'onderzoeken'
  | 'brief_voorbereiden'
  | 'te_printen'
  | 'te_posten'
  | 'opvolgen'
  | 'werkbak'
  | 'handmatig';

export interface Werkronde {
  /** Type/bron van de werkronde. */
  bron: WerkrondeBron;
  /** Leesbare naam, bv. "Te printen (12)". */
  naam: string;
  /** Vaste scope-IDs (momentopname bij starten). */
  scopeIds: string[];
  behandeldeIds: string[];
  overgeslagenIds: string[];
  /** Laatst getoonde signaal-id (positie). */
  huidigeId: string | null;
  gestartOp: string;
  laatstBijgewerktOp: string;
  versie: 1;
}

export const WERKRONDE_KEY = 'off-market-acq:werkronde:v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function storage(s?: StorageLike): StorageLike | null {
  if (s) return s;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch { /* ignore */ }
  return null;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(x => typeof x === 'string');
}

/** Defensieve validatie van een gedeserialiseerde werkronde. */
export function parseWerkronde(raw: string | null): Werkronde | null {
  if (!raw) return null;
  let obj: unknown;
  try { obj = JSON.parse(raw); } catch { return null; }
  if (!obj || typeof obj !== 'object') return null;
  const r = obj as Record<string, unknown>;
  if (r.versie !== 1) return null;
  if (!isStringArray(r.scopeIds) || r.scopeIds.length === 0) return null;
  if (!isStringArray(r.behandeldeIds) || !isStringArray(r.overgeslagenIds)) return null;
  if (typeof r.naam !== 'string' || typeof r.gestartOp !== 'string') return null;
  const bron = r.bron;
  const geldigeBron: WerkrondeBron[] = [
    'onderzoeken', 'brief_voorbereiden', 'te_printen', 'te_posten', 'opvolgen', 'werkbak', 'handmatig',
  ];
  if (typeof bron !== 'string' || !(geldigeBron as string[]).includes(bron)) return null;
  return {
    bron: bron as WerkrondeBron,
    naam: r.naam,
    scopeIds: r.scopeIds,
    behandeldeIds: r.behandeldeIds,
    overgeslagenIds: r.overgeslagenIds,
    huidigeId: typeof r.huidigeId === 'string' ? r.huidigeId : null,
    gestartOp: r.gestartOp,
    laatstBijgewerktOp: typeof r.laatstBijgewerktOp === 'string' ? r.laatstBijgewerktOp : r.gestartOp,
    versie: 1,
  };
}

export function leesWerkronde(s?: StorageLike): Werkronde | null {
  const st = storage(s);
  if (!st) return null;
  try { return parseWerkronde(st.getItem(WERKRONDE_KEY)); } catch { return null; }
}

export function schrijfWerkronde(w: Werkronde, s?: StorageLike): void {
  const st = storage(s);
  if (!st) return;
  try { st.setItem(WERKRONDE_KEY, JSON.stringify(w)); } catch { /* ignore */ }
}

export function wisWerkronde(s?: StorageLike): void {
  const st = storage(s);
  if (!st) return;
  try { st.removeItem(WERKRONDE_KEY); } catch { /* ignore */ }
}

export function startWerkronde(input: {
  bron: WerkrondeBron;
  naam: string;
  scopeIds: string[];
  nu?: string;
}): Werkronde {
  const nu = input.nu ?? new Date().toISOString();
  return {
    bron: input.bron,
    naam: input.naam,
    scopeIds: [...input.scopeIds],
    behandeldeIds: [],
    overgeslagenIds: [],
    huidigeId: input.scopeIds[0] ?? null,
    gestartOp: nu,
    laatstBijgewerktOp: nu,
    versie: 1,
  };
}

export interface WerkrondeVoortgang {
  totaal: number;
  behandeld: number;
  overgeslagen: number;
  resterend: number;
}

export function voortgang(w: Werkronde): WerkrondeVoortgang {
  const behandeld = new Set(w.behandeldeIds);
  const overgeslagen = new Set(w.overgeslagenIds.filter(id => !behandeld.has(id)));
  const resterend = w.scopeIds.filter(
    id => !behandeld.has(id) && !overgeslagen.has(id),
  ).length;
  return {
    totaal: w.scopeIds.length,
    behandeld: w.scopeIds.filter(id => behandeld.has(id)).length,
    overgeslagen: w.scopeIds.filter(id => overgeslagen.has(id)).length,
    resterend,
  };
}

export function voortgangTekst(v: WerkrondeVoortgang): string {
  return `${v.behandeld} behandeld · ${v.overgeslagen} overgeslagen · ${v.resterend} resterend`;
}

function zonder(list: string[], id: string): string[] {
  return list.filter(x => x !== id);
}

function met(list: string[], id: string): string[] {
  return list.includes(id) ? list : [...list, id];
}

/** Markeer als behandeld (en haal uit overgeslagen). */
export function markeerBehandeld(w: Werkronde, id: string, nu = new Date().toISOString()): Werkronde {
  return {
    ...w,
    behandeldeIds: met(w.behandeldeIds, id),
    overgeslagenIds: zonder(w.overgeslagenIds, id),
    laatstBijgewerktOp: nu,
  };
}

/** Markeer als overgeslagen (alleen wanneer nog niet behandeld). */
export function markeerOvergeslagen(w: Werkronde, id: string, nu = new Date().toISOString()): Werkronde {
  if (w.behandeldeIds.includes(id)) return { ...w, laatstBijgewerktOp: nu };
  return {
    ...w,
    overgeslagenIds: met(w.overgeslagenIds, id),
    laatstBijgewerktOp: nu,
  };
}

/** Defensief: verwijder een signaal volledig uit de werkronde-scope. */
export function verwijderUitWerkronde(
  w: Werkronde, id: string, nu = new Date().toISOString(),
): Werkronde | null {
  const scopeIds = zonder(w.scopeIds, id);
  if (scopeIds.length === 0) return null;
  return {
    ...w,
    scopeIds,
    behandeldeIds: zonder(w.behandeldeIds, id),
    overgeslagenIds: zonder(w.overgeslagenIds, id),
    huidigeId: w.huidigeId === id ? null : w.huidigeId,
    laatstBijgewerktOp: nu,
  };
}

export function zetPositie(w: Werkronde, id: string | null, nu = new Date().toISOString()): Werkronde {
  return { ...w, huidigeId: id, laatstBijgewerktOp: nu };
}

/**
 * Eerste nog niet behandelde item; overgeslagen items komen pas aan bod
 * wanneer er geen onbehandelde items meer zijn.
 * `beschikbareIds` respecteert de volgorde waarin items getoond worden.
 */
export function eerstVolgendeId(w: Werkronde, beschikbareIds: string[]): string | null {
  const behandeld = new Set(w.behandeldeIds);
  const overgeslagen = new Set(w.overgeslagenIds);
  const nietBehandeld = beschikbareIds.filter(id => !behandeld.has(id) && !overgeslagen.has(id));
  if (nietBehandeld.length > 0) return nietBehandeld[0];
  const alleenOvergeslagen = beschikbareIds.filter(id => !behandeld.has(id));
  return alleenOvergeslagen[0] ?? null;
}

/** Index van het eerstvolgende item binnen de zichtbare scopelijst. */
export function hervatIndex(w: Werkronde, beschikbareIds: string[]): number {
  const id = eerstVolgendeId(w, beschikbareIds);
  if (!id) return 0;
  const idx = beschikbareIds.indexOf(id);
  return idx >= 0 ? idx : 0;
}
