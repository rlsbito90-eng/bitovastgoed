// React Query hooks voor de "Brief voorbereiden"-flow.
// Slaat conceptbrieven en verzonden brieven op in `off_market_brieven`.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OffMarketBrief {
  id: string;
  signaal_id: string;
  eigenaar_naam: string | null;
  eigenaar_bedrijfsnaam: string | null;
  verzendadres: string | null;
  objectadres: string | null;
  objectomschrijving: string | null;
  aanhef: string | null;
  onderwerp: string | null;
  brieftekst: string;
  status: 'concept' | 'verstuurd';
  verzonden_op: string | null;
  aangemaakt_door: string | null;
  created_at: string;
  updated_at: string;
}

export interface BriefInsert {
  signaal_id: string;
  eigenaar_naam?: string | null;
  eigenaar_bedrijfsnaam?: string | null;
  verzendadres?: string | null;
  objectadres?: string | null;
  objectomschrijving?: string | null;
  aanhef?: string | null;
  onderwerp?: string | null;
  brieftekst: string;
  status?: 'concept' | 'verstuurd';
}

const TABLE = 'off_market_brieven';

export function useOffMarketBrievenForSignaal(signaalId: string | null | undefined) {
  return useQuery({
    queryKey: ['off_market_brieven', signaalId],
    enabled: !!signaalId,
    queryFn: async (): Promise<OffMarketBrief[]> => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .eq('signaal_id', signaalId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as OffMarketBrief[];
    },
  });
}

export function useUpsertBrief() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: BriefInsert & { id?: string },
    ): Promise<OffMarketBrief> => {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = {
        signaal_id: input.signaal_id,
        eigenaar_naam: input.eigenaar_naam ?? null,
        eigenaar_bedrijfsnaam: input.eigenaar_bedrijfsnaam ?? null,
        verzendadres: input.verzendadres ?? null,
        objectadres: input.objectadres ?? null,
        aanhef: input.aanhef ?? null,
        onderwerp: input.onderwerp ?? null,
        brieftekst: input.brieftekst,
        status: input.status ?? 'concept',
        aangemaakt_door: u.user?.id ?? null,
      };
      if (input.id) {
        const { data, error } = await (supabase as any)
          .from(TABLE).update(payload).eq('id', input.id).select().single();
        if (error) throw new Error(error.message);
        return data as OffMarketBrief;
      }
      const { data, error } = await (supabase as any)
        .from(TABLE).insert(payload).select().single();
      if (error) throw new Error(error.message);
      return data as OffMarketBrief;
    },
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ['off_market_brieven', b.signaal_id] });
    },
  });
}

export function useMarkBriefVerstuurd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<OffMarketBrief> => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .update({ status: 'verstuurd', verzonden_op: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as OffMarketBrief;
    },
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ['off_market_brieven', b.signaal_id] });
    },
  });
}
