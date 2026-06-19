// V2.3 — handmatige/automatische BAG-verrijking via edge function.
// Schrijft daarna Kadasteradvies. Faalt fail-soft.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { persistKadasteradvies } from '@/lib/offMarket/bag/triggers';

export interface BagVerrijkArgs {
  signaalId: string;
  force?: boolean;
}

export function useBagVerrijken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ signaalId, force }: BagVerrijkArgs) => {
      const { data, error } = await supabase.functions.invoke('off-market-bag-verrijk', {
        body: { signaal_id: signaalId, force: !!force },
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
