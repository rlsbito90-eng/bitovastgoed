import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  verwerkBagAchterstand,
  type BagBacklogInvokeResult,
  type BagBacklogProgress,
  type BagBacklogResult,
  type BagBacklogKind,
  DEFAULT_BAG_CHUNK_SIZE,
  DEFAULT_BAG_CONCURRENCY,
} from '@/lib/offMarket/bagBacklog/runner';
import { magBagAutoVerrijken } from '@/lib/offMarket/bag/autoTrigger';
import type { SignaalBagInput } from '@/lib/offMarket/bag/types';

const BACKLOG_KEY = ['off-market-bag-backlog-snapshot'] as const;
const PAGE_SIZE = 1000;

const SELECT_FIELDS =
  'id, titel, adres, postcode, plaats, bron_url, status, gearchiveerd_op, ' +
  'ai_score, ai_status, ai_skip_reden, ai_strategie_suggestie, ' +
  'potentiele_strategie, vergunningtype, assettype, bag_status';

/**
 * Bouw één gededupliceerde snapshot van geschikte signaal-ID's.
 *
 * Brede DB-WHERE haalt kandidaten gepagineerd op; daarna filtert exact dezelfde
 * `magBagAutoVerrijken`-guard als de server-cascade. Hierdoor komen teller en
 * verwerking 1-op-1 overeen.
 */
export async function bouwBagSnapshot(): Promise<string[]> {
  const ids: string[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('off_market_signalen')
      .select(SELECT_FIELDS)
      .eq('ai_status', 'klaar')
      .is('ai_skip_reden', null)
      .is('gearchiveerd_op', null)
      .not('status', 'in', '(archief,afgevallen,niet_interessant)')
      .not('ai_score', 'is', null)
      .or('bag_status.is.null,bag_status.eq.niet_verrijkt')
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data ?? []) as unknown as SignaalBagInput[];
    for (const row of batch) {
      if (!row.id) continue;
      const b = magBagAutoVerrijken(row);
      if (b.toegestaan) ids.push(row.id);
    }
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return Array.from(new Set(ids));
}

/**
 * Teller = werkelijke snapshot-lengte (niet alleen een brede DB-count).
 * Zo komen UI-aantal en daadwerkelijk verwerkte ID's 1-op-1 overeen.
 */
export function useBagBacklogCount() {
  return useQuery({
    queryKey: BACKLOG_KEY,
    queryFn: async (): Promise<number> => {
      const snap = await bouwBagSnapshot();
      return snap.length;
    },
    staleTime: 30_000,
  });
}

const RESPONSE_KINDS: ReadonlyArray<BagBacklogKind> = [
  'verrijkt',
  'meerdere_matches',
  'geen_match',
  'fout',
];

function statusToKind(status: unknown): BagBacklogKind | null {
  if (typeof status !== 'string') return null;
  if (status === 'bezig') return null; // niet definitief — vereist refetch
  if ((RESPONSE_KINDS as readonly string[]).includes(status)) {
    return status as BagBacklogKind;
  }
  return null;
}

/**
 * Defensieve guard-check vlak vóór invoke: haal verse rij op en pas
 * exact dezelfde `magBagAutoVerrijken`-logica toe. Bij weigering: overgeslagen.
 */
async function controleerActueleGuard(signaalId: string): Promise<boolean> {
  const { data } = await supabase
    .from('off_market_signalen')
    .select(SELECT_FIELDS)
    .eq('id', signaalId)
    .maybeSingle();
  if (!data) return false;
  const b = magBagAutoVerrijken(data as unknown as SignaalBagInput);
  return b.toegestaan;
}

/** Refetch alleen bag_status — fallback als response geen bruikbaar statusveld geeft. */
async function refetchBagStatus(signaalId: string): Promise<BagBacklogKind> {
  const { data } = await supabase
    .from('off_market_signalen')
    .select('bag_status')
    .eq('id', signaalId)
    .maybeSingle();
  const st = (data as { bag_status?: string | null } | null)?.bag_status ?? null;
  const kind = statusToKind(st);
  return kind ?? 'fout';
}

/**
 * Eén BAG-invoke: actuele guard → invoke → klassificeren via respons-`status`,
 * met refetch als fallback. Inspecteert zowel `error` als `data.error`.
 */
async function invokeBagDirect(signaalId: string): Promise<BagBacklogInvokeResult> {
  const toegestaan = await controleerActueleGuard(signaalId);
  if (!toegestaan) return { kind: 'overgeslagen' };

  const { data, error } = await supabase.functions.invoke('off-market-bag-verrijk', {
    body: { signaal_id: signaalId, force: false },
  });

  if (error) {
    // Non-2xx of netwerkfout → fout (geen auto-retry).
    return { kind: 'fout', error: error.message ?? 'invoke-fout' };
  }

  const payload = (data ?? {}) as { ok?: boolean; status?: string; error?: string };
  if (payload.ok === false || (payload.error && !payload.status)) {
    return { kind: 'fout', error: payload.error ?? 'onbekende fout' };
  }

  const kind = statusToKind(payload.status);
  if (kind) return { kind };

  // Geen bruikbaar statusveld (bv. 'bezig' of ontbrekend): autoriteit = DB.
  const refetched = await refetchBagStatus(signaalId);
  return { kind: refetched };
}

export interface UseBagBacklogVerwerken {
  start: () => void;
  isRunning: boolean;
  progress: BagBacklogProgress | null;
  result: BagBacklogResult | null;
  error: Error | null;
}

export function useBagBacklogVerwerken(): UseBagBacklogVerwerken {
  const qc = useQueryClient();
  const [progress, setProgress] = useState<BagBacklogProgress | null>(null);

  const mutation = useMutation({
    mutationFn: async (): Promise<BagBacklogResult> => {
      setProgress(null);
      const snapshot = await bouwBagSnapshot();
      const initial: BagBacklogProgress = {
        verwerkt: 0,
        verrijkt: 0,
        meerdere_matches: 0,
        geen_match: 0,
        fout: 0,
        overgeslagen: 0,
        resterend: snapshot.length,
      };
      setProgress(initial);
      return verwerkBagAchterstand({
        snapshot,
        invoke: invokeBagDirect,
        chunkSize: DEFAULT_BAG_CHUNK_SIZE,
        concurrency: DEFAULT_BAG_CONCURRENCY,
        onProgress: setProgress,
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: BACKLOG_KEY });
      qc.invalidateQueries({ queryKey: ['off-market-signalen'] });
      qc.invalidateQueries({ queryKey: ['off-market-kpi'] });
    },
  });

  const start = useCallback(() => {
    if (mutation.isPending) return;
    mutation.mutate();
  }, [mutation]);

  return {
    start,
    isRunning: mutation.isPending,
    progress,
    result: mutation.data ?? null,
    error: (mutation.error as Error | null) ?? null,
  };
}
