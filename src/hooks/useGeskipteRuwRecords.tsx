import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  mapRuwNaarGeskipt,
  buildHandmatigePromotie,
  type GeskiptRecord,
} from '@/lib/offMarket/import/audit';

const QUERY_KEY = ['off-market-ruw-geskipt'] as const;

/** Haal de N meest recente geskipte ruwe records op (verwerkt=true, signaal_id NULL). */
export function useGeskipteRuwRecords(limit = 300) {
  return useQuery({
    queryKey: [...QUERY_KEY, limit],
    queryFn: async (): Promise<GeskiptRecord[]> => {
      const { data, error } = await supabase
        .from('off_market_signalen_ruw')
        .select('id, bron_id, extern_id, binnengekomen_op, updated_at, signaal_id, payload')
        .eq('verwerkt', true)
        .is('signaal_id', null)
        .order('updated_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((r: any) => mapRuwNaarGeskipt(r));
    },
    refetchOnWindowFocus: false,
  });
}

/** Markeer een geskipt record als "handmatig genegeerd" (verbergen uit auditlijst). */
export function useNegeerGeskipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (record: GeskiptRecord) => {
      const payload = { ...record.payload, handmatig_genegeerd: true };
      const { error } = await supabase
        .from('off_market_signalen_ruw')
        .update({ payload: payload as any })
        .eq('id', record.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

/** Promoveer een geskipt record alsnog naar `off_market_signalen`. */
export function usePromoteGeskipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      record: GeskiptRecord;
      bron: { gemeente?: string | null; provincie?: string | null };
    }) => {
      const { record, bron } = params;
      // Verse check tegen dubbele promotie
      const { data: verse } = await supabase
        .from('off_market_signalen_ruw')
        .select('signaal_id, payload')
        .eq('id', record.id)
        .maybeSingle();
      if (verse?.signaal_id) {
        throw new Error('Dit record is al gepromoveerd naar een signaal.');
      }
      const { insertPayload, ruwUpdatePayload } = await buildHandmatigePromotie(record, bron);
      const { data: signaal, error: insErr } = await supabase
        .from('off_market_signalen')
        .insert(insertPayload as any)
        .select('id')
        .single();
      if (insErr) throw insErr;
      const { error: updErr } = await supabase
        .from('off_market_signalen_ruw')
        .update({ signaal_id: signaal.id, payload: ruwUpdatePayload as any })
        .eq('id', record.id);
      if (updErr) throw updErr;
      return signaal.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ['off-market-signalen'] });
      qc.invalidateQueries({ queryKey: ['off-market-kpi'] });
    },
  });
}
