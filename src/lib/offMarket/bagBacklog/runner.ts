/**
 * BAG-achterstand runner — pure orchestratie over een snapshot van signaal-ID's.
 *
 * - Ieder ID maximaal eenmaal per run.
 * - Chunks van `chunkSize` ID's, binnen elke chunk maximaal `concurrency` parallel.
 * - Categorisch resultaat: verrijkt | meerdere_matches | geen_match | fout | overgeslagen.
 * - Geen automatische retry: throws en non-2xx tellen als `fout`.
 * - Geen BAG-/Kadaster-implementatie hier; alleen orchestratie + dedupe + voortgang.
 */

export type BagBacklogKind =
  | 'verrijkt'
  | 'meerdere_matches'
  | 'geen_match'
  | 'fout'
  | 'overgeslagen';

export interface BagBacklogInvokeResult {
  kind: BagBacklogKind;
  /** Optionele foutmelding voor logging. */
  error?: string;
}

export interface BagBacklogProgress {
  verwerkt: number;
  verrijkt: number;
  meerdere_matches: number;
  geen_match: number;
  fout: number;
  overgeslagen: number;
  resterend: number;
}

export interface BagBacklogResult extends BagBacklogProgress {
  totaal: number;
  fouten: Array<{ id: string; error: string }>;
}

export interface VerwerkBagAchterstandOptions {
  snapshot: string[];
  invoke: (signaalId: string) => Promise<BagBacklogInvokeResult>;
  chunkSize?: number;
  concurrency?: number;
  onProgress?: (p: BagBacklogProgress) => void;
}

export const DEFAULT_BAG_CHUNK_SIZE = 10;
export const DEFAULT_BAG_CONCURRENCY = 2;

function emptyProgress(totaal: number): BagBacklogProgress {
  return {
    verwerkt: 0,
    verrijkt: 0,
    meerdere_matches: 0,
    geen_match: 0,
    fout: 0,
    overgeslagen: 0,
    resterend: totaal,
  };
}

export async function verwerkBagAchterstand(
  opts: VerwerkBagAchterstandOptions,
): Promise<BagBacklogResult> {
  const chunkSize = Math.max(1, opts.chunkSize ?? DEFAULT_BAG_CHUNK_SIZE);
  const concurrency = Math.max(1, opts.concurrency ?? DEFAULT_BAG_CONCURRENCY);

  // Dedupe — iedere ID maximaal één keer in de run.
  const seen = new Set<string>();
  const ids = opts.snapshot.filter((id) => {
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const totaal = ids.length;
  const tellers = emptyProgress(totaal);
  const fouten: BagBacklogResult['fouten'] = [];

  const emit = () => {
    opts.onProgress?.({
      ...tellers,
      resterend: Math.max(0, totaal - tellers.verwerkt),
    });
  };

  const tel = (id: string, kind: BagBacklogKind, error?: string) => {
    tellers.verwerkt++;
    tellers[kind]++;
    if (kind === 'fout') {
      fouten.push({ id, error: error ?? 'onbekende fout' });
    }
  };

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    for (let j = 0; j < chunk.length; j += concurrency) {
      const wave = chunk.slice(j, j + concurrency);
      const results = await Promise.allSettled(
        wave.map(async (id) => ({ id, res: await opts.invoke(id) })),
      );
      for (let k = 0; k < results.length; k++) {
        const r = results[k];
        const id = wave[k];
        if (r.status === 'fulfilled') {
          tel(id, r.value.res.kind, r.value.res.error);
        } else {
          const reason = r.reason instanceof Error ? r.reason.message : String(r.reason);
          tel(id, 'fout', reason);
        }
      }
      emit();
    }
  }

  return {
    ...tellers,
    resterend: Math.max(0, totaal - tellers.verwerkt),
    totaal,
    fouten,
  };
}
