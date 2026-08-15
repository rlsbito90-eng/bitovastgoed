import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AcquisitieCohortRij {
  verzendmaand: string;
  acquisitie_bron: string;
  verzonden_brieven: number;
  reacties: number;
  positieve_reacties: number;
  retourpost: number;
  responspercentage: number;
  positieve_responspercentage: number;
  gemiddelde_dagen_tot_reactie: number | null;
}

export interface AcquisitieMaandKpiRij {
  maand: string;
  acquisitie_bron: string;
  kadaster_aanvragen: number;
  kadaster_leveringen: number;
  kadaster_werkelijke_kosten: number;
  kadaster_kosten_beste_beschikbaar: number;
}

export function useAcquisitieTrackingPrestaties() {
  const cohort = useQuery({
    queryKey: ['acquisitie-tracking', 'cohort'],
    queryFn: async (): Promise<AcquisitieCohortRij[]> => {
      const { data, error } = await (supabase as any)
        .from('acquisitie_tracking_funnel_cohort_v1')
        .select('*')
        .order('verzendmaand', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as AcquisitieCohortRij[];
    },
    staleTime: 60_000,
  });

  const maandKpis = useQuery({
    queryKey: ['acquisitie-tracking', 'maand-kpis'],
    queryFn: async (): Promise<AcquisitieMaandKpiRij[]> => {
      const { data, error } = await (supabase as any)
        .from('acquisitie_tracking_kpis_maand_v1')
        .select('maand,acquisitie_bron,kadaster_aanvragen,kadaster_leveringen,kadaster_werkelijke_kosten,kadaster_kosten_beste_beschikbaar')
        .order('maand', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as AcquisitieMaandKpiRij[];
    },
    staleTime: 60_000,
  });

  return {
    cohort: cohort.data ?? [],
    maandKpis: maandKpis.data ?? [],
    isLoading: cohort.isLoading || maandKpis.isLoading,
    error: cohort.error ?? maandKpis.error ?? null,
  };
}
