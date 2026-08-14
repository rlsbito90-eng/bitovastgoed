import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export interface EigenaarCrmKoppelingInput {
  eigenaarId: string;
  relatieId: string | null;
}

async function wijzigEigenaarCrmRelatie({ eigenaarId, relatieId }: EigenaarCrmKoppelingInput) {
  const { data, error } = await sb
    .from('eigenaren')
    .update({ crm_relatie_id: relatieId })
    .eq('id', eigenaarId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export function useEigenaarCrmKoppeling(vastgoedkansId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: wijzigEigenaarCrmRelatie,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['eigenaarsregister', 'vastgoedkans', vastgoedkansId] }),
        queryClient.invalidateQueries({ queryKey: ['eigenaar-activiteit', 'vastgoedkans', vastgoedkansId] }),
      ]);
    },
  });
}
