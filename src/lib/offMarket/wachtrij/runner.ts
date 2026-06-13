/**
 * Client-side orchestratie voor het verwerken van de volledige normalize-wachtrij.
 *
 * Het roept een chunk-runner herhaaldelijk aan met de gekozen batchgrootte.
 * - Stopt zodra een chunk minder dan `batchSize` records verwerkt (lege wachtrij).
 * - Stopt bij een fout (resterende buffer blijft behouden, niets wordt verwijderd).
 * - Respecteert harde caps: max 1000 per chunk, max 20.000 records totaal,
 *   max 5 minuten wandklok.
 */

export interface ChunkResult {
  verwerkt: number;
  gepromoveerd: number;
  merged: number;
  geskipt: number;
  fouten: number;
}

export interface VolledigResult extends ChunkResult {
  chunks: number;
  duur_ms: number;
  /** True als wegens hard cap of tijd is gestopt, niet wegens lege wachtrij. */
  afgekapt: boolean;
  /** Foutmelding wanneer de loop door een fout is gestopt. */
  foutmelding?: string;
}

export interface VolledigOptions {
  /** Gewenste batchgrootte; wordt gecapped op MAX_BATCH (1000) en geminimaliseerd op 1. */
  batchSize: number;
  /** Optioneel: scope naar één bron. */
  bronId?: string;
  /** Chunk-runner, bv. wrapper rond edge function. */
  runChunk: (args: { limit: number; bronId?: string }) => Promise<ChunkResult>;
  /** Callback voor voortgangsindicatie, na elke chunk. */
  onProgress?: (totaalVerwerkt: number, chunks: number) => void;
  /** Override voor tests. */
  maxRecords?: number;
  maxDurationMs?: number;
  now?: () => number;
}

export const MAX_BATCH = 1000;
export const HARD_CAP_RECORDS = 20_000;
export const HARD_CAP_DURATION_MS = 5 * 60 * 1000;

export function clampBatchSize(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 200;
  return Math.min(Math.max(Math.trunc(n), 1), MAX_BATCH);
}

export async function verwerkVolledigeWachtrij(opts: VolledigOptions): Promise<VolledigResult> {
  const batchSize = clampBatchSize(opts.batchSize);
  const maxRecords = Math.min(opts.maxRecords ?? HARD_CAP_RECORDS, HARD_CAP_RECORDS);
  const maxDuration = Math.min(opts.maxDurationMs ?? HARD_CAP_DURATION_MS, HARD_CAP_DURATION_MS);
  const now = opts.now ?? (() => Date.now());
  const start = now();

  const totals: ChunkResult = { verwerkt: 0, gepromoveerd: 0, merged: 0, geskipt: 0, fouten: 0 };
  let chunks = 0;
  let afgekapt = false;
  let foutmelding: string | undefined;

  while (true) {
    const remaining = maxRecords - totals.verwerkt;
    if (remaining <= 0) { afgekapt = true; break; }
    if (now() - start >= maxDuration) { afgekapt = true; break; }

    const limit = Math.min(batchSize, remaining);
    let r: ChunkResult;
    try {
      r = await opts.runChunk({ limit, bronId: opts.bronId });
    } catch (e) {
      foutmelding = e instanceof Error ? e.message : String(e);
      break;
    }
    chunks++;
    totals.verwerkt += r.verwerkt;
    totals.gepromoveerd += r.gepromoveerd;
    totals.merged += r.merged;
    totals.geskipt += r.geskipt;
    totals.fouten += r.fouten;

    opts.onProgress?.(totals.verwerkt, chunks);

    if (r.verwerkt < limit) break; // wachtrij leeg
  }

  return { ...totals, chunks, duur_ms: now() - start, afgekapt, foutmelding };
}
