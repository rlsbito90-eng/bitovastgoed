// Pure helpers voor het berekenen van het sync-venster (query_vanaf/query_tot)
// op basis van bron-instellingen. Geen Supabase-calls — testbaar.

export type ImportModus = 'test' | 'sync' | 'backfill' | 'handmatig';

export interface SyncWindowInput {
  /** Huidige tijd (injecteerbaar voor tests). */
  now: Date;
  /** Laatste succesvolle sync. Null bij eerste run. */
  laatsteSyncOp: Date | null;
  /** Default lookback in dagen als er nog geen sync is geweest. */
  lookbackDaysDefault: number;
  /** Veiligheidsoverlap in uren t.o.v. laatste sync. */
  lookbackOverlapUren: number;
}

export interface SyncWindow {
  vanaf: Date;
  tot: Date;
  /** Reden waarom dit venster gekozen is — handig voor logging. */
  reden: 'eerste_sync_lookback_default' | 'laatste_sync_min_overlap';
}

/**
 * Bepaal het sync-venster.
 * - Geen laatste_sync_op → now() - lookbackDaysDefault.
 * - Wel laatste_sync_op → laatste_sync_op - lookbackOverlapUren (veilige overlap).
 * Het venster wordt nooit langer dan een fail-safe van 365 dagen.
 */
export function bepaalSyncWindow(input: SyncWindowInput): SyncWindow {
  const tot = input.now;
  if (input.laatsteSyncOp) {
    const overlapMs = Math.max(0, input.lookbackOverlapUren) * 3600_000;
    const vanaf = new Date(input.laatsteSyncOp.getTime() - overlapMs);
    return clampVenster(vanaf, tot, 'laatste_sync_min_overlap');
  }
  const dagen = Math.max(1, input.lookbackDaysDefault);
  const vanaf = new Date(tot.getTime() - dagen * 86400_000);
  return clampVenster(vanaf, tot, 'eerste_sync_lookback_default');
}

function clampVenster(vanaf: Date, tot: Date, reden: SyncWindow['reden']): SyncWindow {
  const MAX_DAGEN = 365;
  const minVanaf = new Date(tot.getTime() - MAX_DAGEN * 86400_000);
  return { vanaf: vanaf < minVanaf ? minVanaf : vanaf, tot, reden };
}

/** Bepaal de gewenste modus op basis van request-input (backwards compatibel). */
export function bepaalModus(input: { modus?: string; test_mode?: boolean }): ImportModus {
  const m = (input.modus ?? '').toLowerCase();
  if (m === 'test' || m === 'sync' || m === 'backfill' || m === 'handmatig') return m as ImportModus;
  if (input.test_mode === true) return 'test';
  return 'handmatig';
}

/** Format een Date als YYYY-MM-DD (UTC) voor de SRU-query. */
export function isoDatum(d: Date): string {
  return d.toISOString().slice(0, 10);
}
