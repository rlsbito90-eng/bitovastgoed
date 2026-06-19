import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { triggerBagAutoNaAi } from '@/lib/offMarket/bag/triggers';

export interface EnrichArgs {
  signaalId: string;
  force?: boolean;
  model?: string;
}

export function useEnrichSignaal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ signaalId, force, model }: EnrichArgs) => {
      const { data, error } = await supabase.functions.invoke('off-market-enrich-signaal', {
        body: { signaal_id: signaalId, force: !!force, ...(model ? { model } : {}) },
      });
      if (error) throw new Error(error.message ?? 'AI-verrijking mislukt');
      if (data?.error) throw new Error(data.error);
      return data as { ok: true; cached: boolean };
    },
    onSuccess: (_, { signaalId }) => {
      qc.invalidateQueries({ queryKey: ['off-market-signaal', signaalId] });
      qc.invalidateQueries({ queryKey: ['off-market-signalen'] });
      // V2.3 — fire-and-forget BAG-cascade na succesvolle AI-verrijking.
      void triggerBagAutoNaAi(signaalId);
    },
  });
}

