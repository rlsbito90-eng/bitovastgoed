import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OffMarketBron {
  id: string;
  naam: string;
  type: string;
  actief: boolean;
  endpoint_url: string | null;
  laatste_run_op: string | null;
  laatste_run_status: string | null;
  laatste_fout: string | null;
}

export function useOffMarketBronnen() {
  return useQuery({
    queryKey: ['off-market-bronnen'],
    queryFn: async (): Promise<OffMarketBron[]> => {
      const { data, error } = await supabase
        .from('off_market_bronnen')
        .select('id, naam, type, actief, endpoint_url, laatste_run_op, laatste_run_status, laatste_fout')
        .order('actief', { ascending: false })
        .order('naam', { ascending: true });
      if (error) throw error;
      return (data ?? []) as OffMarketBron[];
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

export function useRunBron() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: string | { bronId: string; testMode?: boolean; lookbackDays?: number; maxRecords?: number }) => {
      const body = typeof args === 'string'
        ? { bron_id: args }
        : {
            bron_id: args.bronId,
            test_mode: args.testMode,
            lookback_days: args.lookbackDays,
            max_records: args.maxRecords,
          };
      const { data, error } = await supabase.functions.invoke(
        'off-market-import-bekendmakingen', { body });
      if (error) throw new Error(error.message ?? 'Import mislukt');
      if (data?.error) throw new Error(data.error);
      return data as {
        ok: true; opgehaald: number; nieuw: number; dubbel: number;
        totaal_server?: number; max_records?: number; afgebroken?: boolean;
        query_url?: string; test_mode?: boolean;
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['off-market-bronnen'] });
      qc.invalidateQueries({ queryKey: ['off-market-ruw-onverwerkt'] });
      qc.invalidateQueries({ queryKey: ['off-market-bron-stats'] });
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

export function useNormalizeWachtrij() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (limitArg?: number) => {
      const limit = limitArg ?? 200;
      const { data, error } = await supabase.functions.invoke(
        'off-market-normalize-ruw', { body: { limit } });
      if (error) throw new Error(error.message ?? 'Verwerken mislukt');
      if (data?.error) throw new Error(data.error);
      return data as {
        ok: true; verwerkt: number; gepromoveerd: number; geskipt: number; merged: number; fouten: number;
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['off-market-ruw-onverwerkt'] });
      qc.invalidateQueries({ queryKey: ['off-market-signalen'] });
      qc.invalidateQueries({ queryKey: ['off-market-kpi'] });
    },
  });
}
