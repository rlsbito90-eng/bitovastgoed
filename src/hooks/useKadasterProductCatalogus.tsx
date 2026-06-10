// React Query hook voor de Kadaster /products lijst.
// Roept de edge function aan met `action: 'list_products'`. Dit is een
// gratis metadata-call (geen kosten); de frontend gebruikt het resultaat om
// dynamisch te bepalen welke producten beschikbaar zijn voor deze API-key
// (bv. of `rechten` als optie getoond mag worden).
//
// Wordt expliciet pas geactiveerd (enabled=true) wanneer de gebruiker de
// kostenconfirmatie-dialog opent — dus geen automatische call bij mount.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { KadasterProductCode } from '@/lib/kadaster/types';

export interface KadasterProductMeta {
  code: KadasterProductCode;
  name: string | null;
  priceEur: number | null;
}

export interface KadasterProductCatalogus {
  products: KadasterProductMeta[];
  source: 'live' | 'fallback';
}

export function useKadasterProductCatalogus(enabled: boolean) {
  return useQuery<KadasterProductCatalogus>({
    queryKey: ['kadaster', 'product-catalogus'],
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        'kadaster-objectinformatie',
        { body: { action: 'list_products' } },
      );
      if (error) {
        throw new Error(error.message ?? 'Kon Kadaster-productlijst niet ophalen');
      }
      return data as KadasterProductCatalogus;
    },
  });
}
