import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

type SignaalInsert = Database['public']['Tables']['off_market_signalen']['Insert'];
type SignaalUpdate = Database['public']['Tables']['off_market_signalen']['Update'];

export interface OffMarketKpi {
  nieuwe_deze_week: number;
  hoge_prioriteit: number;
  te_onderzoeken: number;
  eigenaren_te_benaderen: number;
  in_gesprek: number;
  objecten_ontvangen: number;
  fee_pipeline: number;
}

const LIST_KEY = ['off-market-signalen'] as const;
const KPI_KEY = ['off-market-kpi'] as const;

export function useOffMarketSignalen() {
  return useQuery({
    queryKey: LIST_KEY,
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

export function useOffMarketSignaal(id: string | undefined) {
  return useQuery({
    queryKey: ['off-market-signaal', id],
    enabled: !!id,
    queryFn: async (): Promise<OffMarketSignaal | null> => {
      const { data, error } = await supabase
        .from('off_market_signalen')
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return (data as OffMarketSignaal | null) ?? null;
    },
  });
}

export function useOffMarketKpi() {
  return useQuery({
    queryKey: KPI_KEY,
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

function invalidateAll(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: LIST_KEY });
  qc.invalidateQueries({ queryKey: KPI_KEY });
  if (id) qc.invalidateQueries({ queryKey: ['off-market-signaal', id] });
}

export function useCreateOffMarketSignaal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SignaalInsert) => {
      const { data: u } = await supabase.auth.getUser();
      const insert: SignaalInsert = { ...payload, created_by: u.user?.id ?? null, updated_by: u.user?.id ?? null };
      const { data, error } = await supabase
        .from('off_market_signalen').insert(insert).select('*').single();
      if (error) throw error;
      return data as OffMarketSignaal;
    },
    onSuccess: (row) => invalidateAll(qc, row.id),
  });
}

export function useUpdateOffMarketSignaal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: SignaalUpdate }) => {
      const { data: u } = await supabase.auth.getUser();
      const finalPatch = { ...patch, updated_by: u.user?.id ?? null };
      if (import.meta.env.DEV) {
        // Tijdelijke debug-log voor Off-Market update — focus op indicatieve_waarde.
        // eslint-disable-next-line no-console
        console.debug('[off_market_signalen.update]', id, {
          indicatieve_waarde: finalPatch.indicatieve_waarde,
          mogelijke_fee: finalPatch.mogelijke_fee,
          type_iw: typeof finalPatch.indicatieve_waarde,
        });
      }
      const { data, error } = await supabase
        .from('off_market_signalen')
        .update(finalPatch)
        .eq('id', id).select('*').single();
      if (error) throw error;
      return data as OffMarketSignaal;
    },
    onSuccess: (row) => invalidateAll(qc, row.id),
  });
}

export function useArchiveOffMarketSignaal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reden }: { id: string; reden: string }) => {
      const { data, error } = await supabase
        .from('off_market_signalen')
        .update({
          gearchiveerd_op: new Date().toISOString(),
          archief_reden: reden,
          status: 'archief',
        })
        .eq('id', id).select('*').single();
      if (error) throw error;
      return data as OffMarketSignaal;
    },
    onSuccess: (row) => invalidateAll(qc, row.id),
  });
}
