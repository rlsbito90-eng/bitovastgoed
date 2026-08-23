import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  bouwAcquisitieConversieDashboard,
  type AcquisitieBriefMeta,
  type AcquisitieConversieEvent,
} from '@/lib/acquisitie/conversieDashboard';

export function useAcquisitieConversieDashboard(jaar = new Date().getFullYear()) {
  const eventsQuery = useQuery({
    queryKey: ['acquisitie-conversie-dashboard', 'events'],
    queryFn: async (): Promise<AcquisitieConversieEvent[]> => {
      const { data, error } = await (supabase as any)
        .from('acquisitie_tracking_events_v1')
        .select('occurred_at,acquisitie_bron,event_type,brief_id,kanaal,status,telt_verzonden_communicatie,telt_reactie,telt_positieve_reactie')
        .not('brief_id', 'is', null)
        .order('occurred_at', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as AcquisitieConversieEvent[];
    },
    // Conversie is operationele stuurinformatie: bij openen/terugkeren opnieuw
    // controleren, zonder continu te pollen wanneer het scherm openstaat.
    staleTime: 0,
    refetchOnWindowFocus: 'always',
  });

  const briefMetaQuery = useQuery({
    queryKey: ['acquisitie-conversie-dashboard', 'brief-meta'],
    queryFn: async (): Promise<AcquisitieBriefMeta[]> => {
      const { data, error } = await (supabase as any)
        .from('off_market_brieven')
        .select('id,campagne_stap,copy_profiel,copy_variant_key,copy_variant_code,copy_hypothese')
        .is('archived_at', null);
      if (error) throw new Error(error.message);
      return (data ?? []) as AcquisitieBriefMeta[];
    },
    staleTime: 0,
    refetchOnWindowFocus: 'always',
  });

  const model = useMemo(
    () => bouwAcquisitieConversieDashboard(eventsQuery.data ?? [], briefMetaQuery.data ?? [], jaar),
    [eventsQuery.data, briefMetaQuery.data, jaar],
  );

  return {
    model,
    isLoading: eventsQuery.isLoading || briefMetaQuery.isLoading,
    error: eventsQuery.error ?? briefMetaQuery.error ?? null,
  };
}
