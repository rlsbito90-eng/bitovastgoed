import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { berekenVolgendeRunMetStart, amsterdamToday } from '@/lib/offMarket/scheduler/planning';

export type BronFrequentie = 'handmatig' | 'dagelijks' | 'wekelijks' | 'maandelijks';

export interface OffMarketBron {
  id: string;
  naam: string;
  type: string;
  actief: boolean;
  endpoint_url: string | null;
  laatste_run_op: string | null;
  laatste_run_status: string | null;
  laatste_fout: string | null;
  auto_import: boolean;
  auto_verwerken: boolean;
  frequentie: BronFrequentie;
  dag_van_week: number | null;
  tijdstip_uur: number;
  max_records_per_run: number;
  normalize_batch_size: number;
  lookback_days_default: number;
  lookback_overlap_uren: number;
  volgende_run_op: string | null;
  laatste_sync_op: string | null;
  auto_start_op: string | null;
}

const BRON_SELECT =
  'id, naam, type, actief, endpoint_url, laatste_run_op, laatste_run_status, laatste_fout, ' +
  'auto_import, auto_verwerken, frequentie, dag_van_week, tijdstip_uur, ' +
  'max_records_per_run, normalize_batch_size, lookback_days_default, lookback_overlap_uren, ' +
  'volgende_run_op, laatste_sync_op, auto_start_op';

export function useOffMarketBronnen() {
  return useQuery({
    queryKey: ['off-market-bronnen'],
    queryFn: async (): Promise<OffMarketBron[]> => {
      const { data, error } = await supabase
        .from('off_market_bronnen')
        .select(BRON_SELECT)
        .order('actief', { ascending: false })
        .order('naam', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as OffMarketBron[];
    },
    refetchOnWindowFocus: false,
  });
}

export function useOnverwerkteRuwCount() {
  return useQuery({
    queryKey: ['off-market-ruw-onverwerkt'],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('off_market_signalen_ruw')
        .select('id', { count: 'exact', head: true })
        .eq('verwerkt', false);
      if (error) throw error;
      return count ?? 0;
    },
    refetchOnWindowFocus: false,
  });
}

export function useToggleBron() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, actief }: { id: string; actief: boolean }) => {
      const { error } = await supabase
        .from('off_market_bronnen').update({ actief }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['off-market-bronnen'] }),
  });
}

export type BronInstellingenPatch = Partial<Pick<OffMarketBron,
  'auto_import' | 'auto_verwerken' | 'frequentie' | 'dag_van_week' | 'tijdstip_uur'
  | 'max_records_per_run' | 'normalize_batch_size' | 'lookback_days_default' | 'lookback_overlap_uren'
  | 'auto_start_op'
>>;

/** Bereken nieuwe volgende_run_op op basis van samengevoegde instellingen. */
export function bepaalVolgendeRunVoorPatch(
  huidig: OffMarketBron,
  patch: BronInstellingenPatch,
  now: Date = new Date(),
): string | null {
  const s = { ...huidig, ...patch } as OffMarketBron;
  if (!s.actief || !s.auto_import || s.frequentie === 'handmatig') return null;
  const next = berekenVolgendeRunMetStart(
    now, s.frequentie, s.tijdstip_uur, s.dag_van_week, s.auto_start_op,
  );
  return next ? next.toISOString() : null;
}

const PLANNING_KEYS = ['auto_import', 'frequentie', 'dag_van_week', 'tijdstip_uur', 'auto_start_op'] as const;

export function useUpdateBronInstellingen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      args: { id: string; patch: BronInstellingenPatch; huidig?: OffMarketBron },
    ) => {
      const patch: BronInstellingenPatch = { ...args.patch };

      // Default: bij aanzetten van auto_import zonder startdatum → vandaag (Amsterdam).
      if (patch.auto_import === true && !patch.auto_start_op && !args.huidig?.auto_start_op) {
        patch.auto_start_op = amsterdamToday(new Date());
      }

      const planningGewijzigd = args.huidig
        ? PLANNING_KEYS.some(k => k in patch && (patch as Record<string, unknown>)[k] !== (args.huidig as unknown as Record<string, unknown>)[k])
        : true;

      const update: Record<string, unknown> = { ...patch };
      if (args.huidig && planningGewijzigd) {
        update.volgende_run_op = bepaalVolgendeRunVoorPatch(args.huidig, patch);
      }

      const { error } = await supabase
        .from('off_market_bronnen').update(update as never).eq('id', args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['off-market-bronnen'] }),
  });
}

export function useRunBron() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      args:
        | string
        | { bronId: string; testMode?: boolean; lookbackDays?: number; maxRecords?: number; modus?: 'test' | 'sync' | 'handmatig' | 'backfill' },
    ) => {
      const body = typeof args === 'string'
        ? { bron_id: args }
        : {
            bron_id: args.bronId,
            test_mode: args.testMode,
            lookback_days: args.lookbackDays,
            max_records: args.maxRecords,
            modus: args.modus,
          };
      const { data, error } = await supabase.functions.invoke(
        'off-market-import-bekendmakingen', { body });
      if (error) throw new Error(error.message ?? 'Import mislukt');
      if (data?.error) throw new Error(data.error);
      return data as {
        ok: true; opgehaald: number; nieuw: number; dubbel: number;
        totaal_server?: number; max_records?: number; afgebroken?: boolean;
        query_url?: string; test_mode?: boolean; modus?: string;
        query_vanaf?: string; query_tot?: string; duur_ms?: number;
        run_id?: string;
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['off-market-bronnen'] });
      qc.invalidateQueries({ queryKey: ['off-market-ruw-onverwerkt'] });
      qc.invalidateQueries({ queryKey: ['off-market-bron-stats'] });
      qc.invalidateQueries({ queryKey: ['off-market-import-runs'] });
    },
  });
}

export interface OffMarketBronStats {
  bron_id: string;
  totaal: number;
  onverwerkt: number;
  verwerkt: number;
  gepromoveerd: number;
  geskipt: number;
}

export function useOffMarketBronStats() {
  return useQuery({
    queryKey: ['off-market-bron-stats'],
    queryFn: async (): Promise<Record<string, OffMarketBronStats>> => {
      const { data, error } = await supabase.rpc('off_market_bron_stats');
      if (error) throw error;
      const out: Record<string, OffMarketBronStats> = {};
      for (const row of (data ?? []) as OffMarketBronStats[]) {
        out[row.bron_id] = {
          bron_id: row.bron_id,
          totaal: Number(row.totaal ?? 0),
          onverwerkt: Number(row.onverwerkt ?? 0),
          verwerkt: Number(row.verwerkt ?? 0),
          gepromoveerd: Number(row.gepromoveerd ?? 0),
          geskipt: Number(row.geskipt ?? 0),
        };
      }
      return out;
    },
    refetchOnWindowFocus: false,
  });
}

export interface NormalizeChunkResult {
  ok: true; verwerkt: number; gepromoveerd: number; geskipt: number; merged: number; fouten: number;
}

export async function invokeNormalizeChunk(args: { limit: number; bronId?: string }): Promise<NormalizeChunkResult> {
  const body: Record<string, unknown> = { limit: args.limit };
  if (args.bronId) body.bron_id = args.bronId;
  const { data, error } = await supabase.functions.invoke('off-market-normalize-ruw', { body });
  if (error) throw new Error(error.message ?? 'Verwerken mislukt');
  if (data?.error) throw new Error(data.error);
  return data as NormalizeChunkResult;
}

export function useNormalizeWachtrij() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args?: number | { limit?: number; bronId?: string }) => {
      const limit = typeof args === 'number' ? args : args?.limit ?? 200;
      const bronId = typeof args === 'object' && args ? args.bronId : undefined;
      return invokeNormalizeChunk({ limit, bronId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['off-market-ruw-onverwerkt'] });
      qc.invalidateQueries({ queryKey: ['off-market-signalen'] });
      qc.invalidateQueries({ queryKey: ['off-market-kpi'] });
      qc.invalidateQueries({ queryKey: ['off-market-bron-stats'] });
    },
  });
}

import { verwerkVolledigeWachtrij, type VolledigResult, clampBatchSize } from '@/lib/offMarket/wachtrij/runner';

export function useNormalizeWachtrijVolledig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      batchSize: number;
      bronId?: string;
      onProgress?: (totaal: number, chunks: number) => void;
    }): Promise<VolledigResult> => {
      return verwerkVolledigeWachtrij({
        batchSize: clampBatchSize(args.batchSize),
        bronId: args.bronId,
        runChunk: invokeNormalizeChunk,
        onProgress: args.onProgress,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['off-market-ruw-onverwerkt'] });
      qc.invalidateQueries({ queryKey: ['off-market-signalen'] });
      qc.invalidateQueries({ queryKey: ['off-market-kpi'] });
      qc.invalidateQueries({ queryKey: ['off-market-bron-stats'] });
    },
  });
}

export interface OffMarketImportRun {
  id: string;
  bron_id: string;
  modus: 'test' | 'sync' | 'backfill' | 'handmatig';
  status: 'bezig' | 'ok' | 'fout' | 'afgebroken';
  gestart_op: string;
  afgerond_op: string | null;
  query_vanaf: string | null;
  query_tot: string | null;
  query_url: string | null;
  server_total: number | null;
  opgehaald: number;
  nieuw: number;
  dubbel: number;
  verwerkt: number;
  gepromoveerd: number;
  merged: number;
  geskipt: number;
  foutmelding: string | null;
  duration_ms: number | null;
}

export function useLaatsteImportRuns(bronId: string | null, limit = 5) {
  return useQuery({
    queryKey: ['off-market-import-runs', bronId, limit],
    enabled: !!bronId,
    queryFn: async (): Promise<OffMarketImportRun[]> => {
      const { data, error } = await supabase
        .from('off_market_import_runs')
        .select('*')
        .eq('bron_id', bronId!)
        .order('gestart_op', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as OffMarketImportRun[];
    },
    refetchOnWindowFocus: false,
  });
}
