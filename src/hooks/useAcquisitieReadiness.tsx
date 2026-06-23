// V1B — Hook: brieven voor alle signalen in de acquisitieselectie + per-
// signaal readiness. Eén bulk-query in plaats van N losse hooks.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import {
  bepaalSignaalReadiness, aggregeerKpis,
  type SignaalReadiness, type AcquisitieKpis,
} from '@/lib/offMarket/acquisitie/readiness';

export function useBrievenVoorSignalen(signaalIds: string[]) {
  const ids = useMemo(() => [...signaalIds].sort(), [signaalIds]);
  return useQuery({
    queryKey: ['off-market-brieven-bulk', ids],
    enabled: ids.length > 0,
    queryFn: async (): Promise<OffMarketBrief[]> => {
      const { data, error } = await (supabase as any)
        .from('off_market_brieven')
        .select('*')
        .in('signaal_id', ids)
        .is('archived_at', null);
      if (error) throw new Error(error.message);
      return (data ?? []) as OffMarketBrief[];
    },
  });
}

export interface AcquisitieReadinessResultaat {
  perSignaal: Map<string, SignaalReadiness>;
  lijst: Array<{ signaal: OffMarketSignaal; readiness: SignaalReadiness }>;
  kpis: AcquisitieKpis;
}

export function useAcquisitieReadiness(
  signalen: OffMarketSignaal[],
): AcquisitieReadinessResultaat & { isLoading: boolean } {
  const ids = useMemo(() => signalen.map(s => s.id), [signalen]);
  const { data: brieven = [], isLoading } = useBrievenVoorSignalen(ids);

  const result = useMemo(() => {
    const brievenPerSignaal = new Map<string, OffMarketBrief[]>();
    for (const b of brieven) {
      const arr = brievenPerSignaal.get(b.signaal_id) ?? [];
      arr.push(b);
      brievenPerSignaal.set(b.signaal_id, arr);
    }
    const perSignaal = new Map<string, SignaalReadiness>();
    const lijst: Array<{ signaal: OffMarketSignaal; readiness: SignaalReadiness }> = [];
    for (const s of signalen) {
      const r = bepaalSignaalReadiness({
        signaal: s,
        brieven: brievenPerSignaal.get(s.id) ?? [],
      });
      perSignaal.set(s.id, r);
      lijst.push({ signaal: s, readiness: r });
    }
    const kpis = aggregeerKpis(lijst.map(x => x.readiness));
    return { perSignaal, lijst, kpis };
  }, [signalen, brieven]);

  return { ...result, isLoading };
}
