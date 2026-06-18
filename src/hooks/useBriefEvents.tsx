// React Query hook voor briefgebeurtenissen.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logBriefEvent, type BriefEventInput } from '@/lib/offMarket/brieven/events';

export interface BriefEvent {
  id: string;
  signaal_id: string;
  brief_id: string | null;
  geadresseerde_key: string | null;
  campagne_stap: string | null;
  kanaal: string | null;
  event_type: string;
  event_date: string;
  status: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

export function useBriefEventsForSignaal(signaalId: string | null | undefined) {
  return useQuery({
    queryKey: ['off_market_brief_events', signaalId],
    enabled: !!signaalId,
    queryFn: async (): Promise<BriefEvent[]> => {
      const { data, error } = await (supabase as any)
        .from('off_market_brief_events')
        .select('*')
        .eq('signaal_id', signaalId)
        .order('event_date', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as BriefEvent[];
    },
  });
}

export function useLogBriefEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BriefEventInput) => {
      await logBriefEvent(input);
      return true;
    },
    onSuccess: (_v, vars) => {
      qc.invalidateQueries({ queryKey: ['off_market_brief_events', vars.signaal_id] });
    },
  });
}
