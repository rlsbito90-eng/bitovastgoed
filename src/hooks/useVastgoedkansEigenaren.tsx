import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { EigenaarKoppelingRecord } from '@/hooks/useEigenaarsregister';

const sb = supabase as any;

export function useVastgoedkansEigenaren(vastgoedkansId: string | null | undefined) {
  return useQuery({
    queryKey: ['eigenaarsregister', 'vastgoedkans', vastgoedkansId],
    enabled: Boolean(vastgoedkansId),
    queryFn: async (): Promise<EigenaarKoppelingRecord[]> => {
      const { data, error } = await sb
        .from('eigenaar_koppelingen')
        .select('id,eigenaar_id,vastgoedkans_id,signaal_id,object_id,kadaster_record_id,rol,rechtsoort,aandeel,bron,betrouwbaarheid,eigenaar:eigenaren(*)')
        .eq('vastgoedkans_id', vastgoedkansId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as EigenaarKoppelingRecord[];
    },
  });
}
