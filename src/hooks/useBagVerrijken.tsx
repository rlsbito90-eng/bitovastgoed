// V2.3 + V2.4 — handmatige/automatische BAG-verrijking via edge function,
// inclusief multiple-match resolver (selected_vbo_id / selected_nummeraanduiding_id).

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { persistKadasteradvies } from '@/lib/offMarket/bag/triggers';

export interface BagVerrijkArgs {
  signaalId: string;
  force?: boolean;
  selected_vbo_id?: string;
  selected_nummeraanduiding_id?: string;
}

export function useBagVerrijken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      signaalId,
      force,
      selected_vbo_id,
      selected_nummeraanduiding_id,
    }: BagVerrijkArgs) => {
      const body: Record<string, unknown> = {
        signaal_id: signaalId,
        force: !!force,
      };
      if (selected_vbo_id) body.selected_vbo_id = selected_vbo_id;
      if (selected_nummeraanduiding_id) {
        body.selected_nummeraanduiding_id = selected_nummeraanduiding_id;
      }
      const { data, error } = await supabase.functions.invoke('off-market-bag-verrijk', {
        body,
      });
      if (error) throw new Error(error.message ?? 'BAG-verrijking mislukt');
      if (data?.error) throw new Error(data.error);
      return data as { ok: true; status: string };
    },
    onSuccess: async (_d, { signaalId }) => {
      qc.invalidateQueries({ queryKey: ['off-market-signaal', signaalId] });
      qc.invalidateQueries({ queryKey: ['off-market-signalen'] });
      try {
        await persistKadasteradvies(signaalId);
        qc.invalidateQueries({ queryKey: ['off-market-signaal', signaalId] });
      } catch {
        /* fail-soft */
      }
    },
  });
}
