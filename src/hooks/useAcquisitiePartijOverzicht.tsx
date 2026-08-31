import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import { bouwPartijenOverzicht, type PartijOverzicht } from '@/lib/offMarket/acquisitie/partijOverzicht';

let cachedSignalen: readonly OffMarketSignaal[] | null = null;
let cachedBrieven: readonly OffMarketBrief[] | null = null;
let cachedPartijen: PartijOverzicht[] = [];

/**
 * Meerdere acquisitierijen gebruiken hetzelfde partijregister. React Query deelt
 * de brondata al; deze kleine referentiecache voorkomt dat iedere zichtbare rij
 * de volledige partijgroepering opnieuw uitrekent.
 */
function bouwPartijenOverzichtGecachet(
  signalen: readonly OffMarketSignaal[],
  brieven: readonly OffMarketBrief[],
): PartijOverzicht[] {
  if (cachedSignalen === signalen && cachedBrieven === brieven) return cachedPartijen;
  cachedSignalen = signalen;
  cachedBrieven = brieven;
  cachedPartijen = bouwPartijenOverzicht(signalen, brieven);
  return cachedPartijen;
}

export function useAlleOffMarketBrievenVoorPartijen(enabled = true) {
  return useQuery({
    queryKey: ['off-market-brieven-partijoverzicht'],
    enabled,
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
  const brieven = brievenQuery.data ?? [];
  const partijen = useMemo(
    () => bouwPartijenOverzichtGecachet(signalen, brieven),
    [signalen, brieven],
  );
  const perKey = useMemo(() => new Map(partijen.map((partij) => [partij.key, partij] as const)), [partijen]);
  return {
    ...brievenQuery,
    partijen,
    perKey,
    alleBrieven: brieven,
  };
}
