import { useMemo } from 'react';
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
  verzonden_communicaties: number;
  reacties: number;
  positieve_reacties: number;
  retourpost: number;
  opvolging_aangemaakt: number;
  opvolging_afgerond: number;
  definitieve_brieven: number;
  geprinte_batches: number;
}

export interface AcquisitieJaarActuals {
  jaar: number;
  kadasterAanvragen: number;
  kadasterLeveringen: number;
  kadasterWerkelijkeKosten: number;
  kadasterKostenBesteBeschikbaar: number;
  verzondenCommunicaties: number;
  reacties: number;
  positieveReacties: number;
  retourpost: number;
  opvolgingAangemaakt: number;
  opvolgingAfgerond: number;
  definitieveBrieven: number;
  geprinteBatches: number;
  responspercentage: number;
  positieveResponspercentage: number;
}

const som = (rijen: AcquisitieMaandKpiRij[], veld: keyof AcquisitieMaandKpiRij) =>
  rijen.reduce((totaal, rij) => totaal + Number(rij[veld] ?? 0), 0);

export function berekenAcquisitieJaarActuals(
  maandKpis: AcquisitieMaandKpiRij[],
  jaar: number,
): AcquisitieJaarActuals {
  const prefix = `${jaar}-`;
  const rijen = maandKpis.filter(rij => String(rij.maand).startsWith(prefix));
  const verzondenCommunicaties = som(rijen, 'verzonden_communicaties');
  const reacties = som(rijen, 'reacties');
  const positieveReacties = som(rijen, 'positieve_reacties');

  return {
    jaar,
    kadasterAanvragen: som(rijen, 'kadaster_aanvragen'),
    kadasterLeveringen: som(rijen, 'kadaster_leveringen'),
    kadasterWerkelijkeKosten: som(rijen, 'kadaster_werkelijke_kosten'),
    kadasterKostenBesteBeschikbaar: som(rijen, 'kadaster_kosten_beste_beschikbaar'),
    verzondenCommunicaties,
    reacties,
    positieveReacties,
    retourpost: som(rijen, 'retourpost'),
    opvolgingAangemaakt: som(rijen, 'opvolging_aangemaakt'),
    opvolgingAfgerond: som(rijen, 'opvolging_afgerond'),
    definitieveBrieven: som(rijen, 'definitieve_brieven'),
    geprinteBatches: som(rijen, 'geprinte_batches'),
    responspercentage: verzondenCommunicaties > 0
      ? Math.round((reacties / verzondenCommunicaties) * 10_000) / 100
      : 0,
    positieveResponspercentage: verzondenCommunicaties > 0
      ? Math.round((positieveReacties / verzondenCommunicaties) * 10_000) / 100
      : 0,
  };
}

export function useAcquisitieTrackingPrestaties(jaar = new Date().getFullYear()) {
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
        .select('maand,acquisitie_bron,kadaster_aanvragen,kadaster_leveringen,kadaster_werkelijke_kosten,kadaster_kosten_beste_beschikbaar,verzonden_communicaties,reacties,positieve_reacties,retourpost,opvolging_aangemaakt,opvolging_afgerond,definitieve_brieven,geprinte_batches')
        .order('maand', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as AcquisitieMaandKpiRij[];
    },
    staleTime: 60_000,
  });

  const jaarActuals = useMemo(
    () => berekenAcquisitieJaarActuals(maandKpis.data ?? [], jaar),
    [maandKpis.data, jaar],
  );

  return {
    cohort: cohort.data ?? [],
    maandKpis: maandKpis.data ?? [],
    jaarActuals,
    isLoading: cohort.isLoading || maandKpis.isLoading,
    error: cohort.error ?? maandKpis.error ?? null,
  };
}
