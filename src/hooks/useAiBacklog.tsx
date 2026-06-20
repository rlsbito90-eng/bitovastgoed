import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  verwerkAiAchterstand,
  type AiBacklogProgress,
  type AiBacklogResult,
  type AiBacklogInvokeResult,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CONCURRENCY,
} from '@/lib/offMarket/aiBacklog/runner';
import { magAiAutoVerrijken } from '@/lib/offMarket/bag/autoTrigger';
import type { SignaalBagInput } from '@/lib/offMarket/bag/types';

const BACKLOG_KEY = ['off-market-ai-backlog-count'] as const;
const PAGE_SIZE = 1000;

const SELECT_FIELDS =
  'id, titel, adres, postcode, plaats, bron_url, status, gearchiveerd_op, ai_score, ai_status, ai_skip_reden';

/**
 * Telling van signalen zonder AI-score die voldoen aan de basis-WHERE.
 * Defensieve `magAiAutoVerrijken`-filter gebeurt pas in de runner-snapshot,
 * dus dit getal kan een fractie hoger zijn dan het uiteindelijke snapshot.
 */
export function useAiBacklogCount() {
  return useQuery({
    queryKey: BACKLOG_KEY,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('off_market_signalen')
        .select('id', { count: 'exact', head: true })
        .is('ai_score', null)
        .is('ai_skip_reden', null)
        .is('gearchiveerd_op', null)
        .or('ai_status.is.null,ai_status.eq.niet_verrijkt')
        .not('status', 'in', '(archief,afgevallen,niet_interessant)');
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30_000,
  });
}

/** Bouw eenmalig de snapshot van geschikte signaal-ID's. */
async function bouwSnapshot(): Promise<string[]> {
  const ids: string[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('off_market_signalen')
      .select(SELECT_FIELDS)
      .is('ai_score', null)
      .is('ai_skip_reden', null)
      .is('gearchiveerd_op', null)
      .or('ai_status.is.null,ai_status.eq.niet_verrijkt')
      .not('status', 'in', '(archief,afgevallen,niet_interessant)')
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data ?? []) as unknown as SignaalBagInput[];
    for (const row of batch) {
      if (!row.id) continue;
      const beslissing = magAiAutoVerrijken(row);
      if (beslissing.toegestaan) ids.push(row.id);
    }
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  // Dedupe — defensief; range zou geen dubbels mogen geven.
  return Array.from(new Set(ids));
}

/** Roep `off-market-enrich-signaal` rechtstreeks aan (zonder BAG-cascade). */
async function invokeEnrichDirect(signaalId: string): Promise<AiBacklogInvokeResult> {
  const { data, error } = await supabase.functions.invoke('off-market-enrich-signaal', {
    body: { signaal_id: signaalId, force: false, cascade_bag: false },
  });
  if (error) return { ok: false, error: error.message ?? 'invoke-fout' };
  const respErr = (data as { error?: string } | null)?.error;
  if (respErr) return { ok: false, error: respErr };
  return { ok: true };
}

export interface UseAiBacklogVerwerken {
  start: () => void;
  isRunning: boolean;
  progress: AiBacklogProgress | null;
  result: AiBacklogResult | null;
  error: Error | null;
}

export function useAiBacklogVerwerken(): UseAiBacklogVerwerken {
  const qc = useQueryClient();
  const [progress, setProgress] = useState<AiBacklogProgress | null>(null);

  const mutation = useMutation({
    mutationFn: async (): Promise<AiBacklogResult> => {
      setProgress(null);
      const snapshot = await bouwSnapshot();
      const initial: AiBacklogProgress = {
        verwerkt: 0,
        geslaagd: 0,
        mislukt: 0,
        resterend: snapshot.length,
      };
      setProgress(initial);
      return verwerkAiAchterstand({
        snapshot,
        invoke: invokeEnrichDirect,
        chunkSize: DEFAULT_CHUNK_SIZE,
        concurrency: DEFAULT_CONCURRENCY,
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
