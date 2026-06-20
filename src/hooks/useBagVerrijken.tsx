// V2.3 + V2.4 + V2.7 — handmatige/automatische BAG-verrijking via edge function,
// inclusief multiple-match resolver (selected_vbo_id / selected_nummeraanduiding_id).
// V2.7: Kadasteradvies wordt voortaan server-side door off-market-bag-verrijk
// gepersisteerd; client schrijft geen advies meer.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BagVerrijkArgs {
  signaalId: string;
  force?: boolean;
  selected_vbo_id?: string;
  selected_nummeraanduiding_id?: string;
  selected_pdok_id?: string;
}

export function useBagVerrijken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      signaalId,
      force,
      selected_vbo_id,
      selected_nummeraanduiding_id,
      selected_pdok_id,
    }: BagVerrijkArgs) => {
      const body: Record<string, unknown> = {
        signaal_id: signaalId,
        force: !!force,
      };
      if (selected_vbo_id) body.selected_vbo_id = selected_vbo_id;
      if (selected_nummeraanduiding_id) {
        body.selected_nummeraanduiding_id = selected_nummeraanduiding_id;
      }
      if (selected_pdok_id) body.selected_pdok_id = selected_pdok_id;
      const { data, error } = await supabase.functions.invoke('off-market-bag-verrijk', {
        body,
      });
      if (error) throw new Error(error.message ?? 'BAG-verrijking mislukt');
      if (data?.error) throw new Error(data.error);
      return data as { ok: true; status: string };
    },
    onSuccess: (_d, { signaalId }) => {
      qc.invalidateQueries({ queryKey: ['off-market-signaal', signaalId] });
      qc.invalidateQueries({ queryKey: ['off-market-signalen'] });
    },
  });
}
