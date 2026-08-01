import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

export function useLinkObjectToSignaal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      signaalId,
      objectId,
    }: {
      signaalId: string;
      objectId: string | null;
    }): Promise<OffMarketSignaal> => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('off_market_signalen')
        .update({
          gekoppeld_object_id: objectId,
          updated_by: u.user?.id ?? null,
        })
        .eq('id', signaalId)
        .select('*')
        .single();
      if (error) throw error;
      return data as OffMarketSignaal;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ['off-market-signalen'] });
      qc.invalidateQueries({ queryKey: ['off-market-kpi'] });
      qc.invalidateQueries({ queryKey: ['off-market-signaal', row.id] });
      qc.invalidateQueries({ queryKey: ['off-market-signaal-voor-object'] });
    },
  });
}
