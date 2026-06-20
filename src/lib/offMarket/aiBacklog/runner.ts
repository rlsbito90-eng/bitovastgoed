/**
 * AI-achterstand runner — pure orchestratie over een snapshot van signaal-ID's.
 *
 * - Verwerkt iedere ID maximaal eenmaal binnen de run.
 * - Chunks van `chunkSize` ID's, binnen elke chunk maximaal `concurrency` parallel.
 * - Roept `invoke(signaalId)` aan; resultaat met `ok:false` of een throw telt als mislukt.
 * - Geen BAG, geen Kadaster, geen client-side claim/rollback van ai_status.
 */

export interface AiBacklogInvokeResult {
  ok: boolean;
  /** Optionele foutmelding voor logging. */
  error?: string;
}

export interface AiBacklogProgress {
  verwerkt: number;
  geslaagd: number;
  mislukt: number;
  resterend: number;
}

export interface AiBacklogResult extends AiBacklogProgress {
  totaal: number;
  fouten: Array<{ id: string; error: string }>;
}

export interface VerwerkAiAchterstandOptions {
  snapshot: string[];
  invoke: (signaalId: string) => Promise<AiBacklogInvokeResult>;
  chunkSize?: number;
  concurrency?: number;
  onProgress?: (p: AiBacklogProgress) => void;
}

export const DEFAULT_CHUNK_SIZE = 25;
export const DEFAULT_CONCURRENCY = 5;

export async function verwerkAiAchterstand(
  opts: VerwerkAiAchterstandOptions,
): Promise<AiBacklogResult> {
  const chunkSize = Math.max(1, opts.chunkSize ?? DEFAULT_CHUNK_SIZE);
  const concurrency = Math.max(1, opts.concurrency ?? DEFAULT_CONCURRENCY);

  // Dedupe — iedere ID maximaal één keer in de run.
  const seen = new Set<string>();
  const ids = opts.snapshot.filter((id) => {
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const totaal = ids.length;
  let verwerkt = 0;
  let geslaagd = 0;
  let mislukt = 0;
  const fouten: AiBacklogResult['fouten'] = [];

  const emit = () => {
    opts.onProgress?.({
      verwerkt,
      geslaagd,
      mislukt,
      resterend: Math.max(0, totaal - verwerkt),
    });
  };

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);

    // Verwerk de chunk in waves van `concurrency` parallel.
    for (let j = 0; j < chunk.length; j += concurrency) {
      const wave = chunk.slice(j, j + concurrency);
      const results = await Promise.allSettled(
        wave.map(async (id) => ({ id, res: await opts.invoke(id) })),
      );
      for (const r of results) {
        verwerkt++;
        if (r.status === 'fulfilled') {
          if (r.value.res.ok) {
            geslaagd++;
          } else {
            mislukt++;
            fouten.push({ id: r.value.id, error: r.value.res.error ?? 'onbekende fout' });
          }
        } else {
          mislukt++;
          const reason = r.reason instanceof Error ? r.reason.message : String(r.reason);
          fouten.push({ id: 'onbekend', error: reason });
        }
      }
      emit();
    }
  }

  return { totaal, verwerkt, geslaagd, mislukt, resterend: Math.max(0, totaal - verwerkt), fouten };
}
