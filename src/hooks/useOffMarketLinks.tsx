// Off-Market koppelingen: queries en mutaties die signaal-context overstijgen.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

const LIST_KEY = ['off-market-signalen'] as const;
const KPI_KEY = ['off-market-kpi'] as const;

function invalidate(qc: ReturnType<typeof useQueryClient>, signaalId?: string) {
  qc.invalidateQueries({ queryKey: LIST_KEY });
  qc.invalidateQueries({ queryKey: KPI_KEY });
  if (signaalId) qc.invalidateQueries({ queryKey: ['off-market-signaal', signaalId] });
}

/** Signalen waar deze relatie eigenaar van is (actief én archief). */
export function useSignalenVoorRelatie(relatieId: string | undefined) {
  return useQuery({
    queryKey: ['off-market-signalen-voor-relatie', relatieId],
    enabled: !!relatieId,
    queryFn: async (): Promise<OffMarketSignaal[]> => {
      const { data, error } = await supabase
        .from('off_market_signalen')
        .select('*')
        .eq('eigenaar_relatie_id', relatieId!)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as OffMarketSignaal[];
    },
  });
}

/** Signaal dat als oorsprong dient voor een object (gepromoot). */
export function useSignaalVoorObject(objectId: string | undefined) {
  return useQuery({
    queryKey: ['off-market-signaal-voor-object', objectId],
    enabled: !!objectId,
    queryFn: async (): Promise<OffMarketSignaal | null> => {
      const { data, error } = await supabase
        .from('off_market_signalen')
        .select('*')
        .eq('gekoppeld_object_id', objectId!)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as OffMarketSignaal | null) ?? null;
    },
  });
}

/** Koppel of ontkoppel een eigenaar/relatie aan een signaal. */
export function useLinkRelatieToSignaal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ signaalId, relatieId }: { signaalId: string; relatieId: string | null }) => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('off_market_signalen')
        .update({ eigenaar_relatie_id: relatieId, updated_by: u.user?.id ?? null })
        .eq('id', signaalId)
        .select('*').single();
      if (error) throw error;
      return data as OffMarketSignaal;
    },
    onSuccess: (row) => invalidate(qc, row.id),
  });
}

/**
 * Promoot een signaal naar een object via de bestaande RPC.
 * Idempotent: als signaal al gekoppeld is, geeft de RPC hetzelfde object_id terug.
 */
export function usePromoteSignaalToObject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (signaalId: string): Promise<string> => {
      const { data, error } = await supabase
        .rpc('off_market_promote_to_object', { _signaal_id: signaalId });
      if (error) throw error;
      if (!data) throw new Error('Promote leverde geen object_id op');
      return data as string;
    },
    onSuccess: (_objectId, signaalId) => invalidate(qc, signaalId),
  });
}
