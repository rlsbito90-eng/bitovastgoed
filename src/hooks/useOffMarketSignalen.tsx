import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

export interface OffMarketKpi {
  nieuwe_deze_week: number;
  hoge_prioriteit: number;
  te_onderzoeken: number;
  eigenaren_te_benaderen: number;
  in_gesprek: number;
  objecten_ontvangen: number;
  fee_pipeline: number;
}

export function useOffMarketSignalen() {
  return useQuery({
    queryKey: ['off-market-signalen'],
    queryFn: async (): Promise<OffMarketSignaal[]> => {
      const { data, error } = await supabase
        .from('off_market_signalen')
        .select('*')
        .is('gearchiveerd_op', null)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as OffMarketSignaal[];
    },
  });
}

export function useOffMarketKpi() {
  return useQuery({
    queryKey: ['off-market-kpi'],
    queryFn: async (): Promise<OffMarketKpi> => {
      const { data, error } = await supabase
        .from('view_off_market_kpi' as never)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return (data as OffMarketKpi | null) ?? {
        nieuwe_deze_week: 0, hoge_prioriteit: 0, te_onderzoeken: 0,
        eigenaren_te_benaderen: 0, in_gesprek: 0, objecten_ontvangen: 0, fee_pipeline: 0,
      };
    },
  });
}
