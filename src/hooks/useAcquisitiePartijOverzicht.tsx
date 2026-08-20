import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import { bouwPartijenOverzicht } from '@/lib/offMarket/acquisitie/partijOverzicht';

export function useAlleOffMarketBrievenVoorPartijen() {
  return useQuery({
    queryKey: ['off-market-brieven-partijoverzicht'],
    queryFn: async (): Promise<OffMarketBrief[]> => {
      const { data, error } = await (supabase as any)
        .from('off_market_brieven')
        .select('id,signaal_id,eigenaar_naam,eigenaar_bedrijfsnaam,verzendadres,objectadres,objectomschrijving,aanhef,onderwerp,brieftekst,status,verzonden_op,aangemaakt_door,created_at,updated_at,archived_at,archived_reason,briefnummer,selectie_id,actieve_versie,kanaal,campagne_stap,geadresseerde_key,printdatum,postdatum,verzendstatus,opvolgdatum,gekoppelde_taak_id,responsstatus,responsdatum,respons_kanaal,respons_samenvatting')
        .is('archived_at', null)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as OffMarketBrief[];
    },
    staleTime: 60_000,
  });
}

export function useAcquisitiePartijOverzicht(signalen: readonly OffMarketSignaal[]) {
  const brievenQuery = useAlleOffMarketBrievenVoorPartijen();
  const partijen = useMemo(
    () => bouwPartijenOverzicht(signalen, brievenQuery.data ?? []),
    [signalen, brievenQuery.data],
  );
  const perKey = useMemo(() => new Map(partijen.map((partij) => [partij.key, partij] as const)), [partijen]);
  return {
    ...brievenQuery,
    partijen,
    perKey,
    alleBrieven: brievenQuery.data ?? [],
  };
}
