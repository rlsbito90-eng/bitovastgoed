import type { ProductieLeesActivatieBewijs } from './productieLeesActivatiePoort';
import type { ProductiekernLeesSamenstelling } from './productiekernLeesSamenstelling';
import { stelSupabaseProductiekernLezenSamen } from './productiekernSupabaseLeesSamenstelling';
import {
  maakProductiekernSupabaseLeesTransport,
  type ProductiekernLeesTransportOpties,
  type ProductiekernSupabaseQueryUitvoerder,
} from './productiekernSupabaseLeesTransportAdapter';
import {
  maakWeerbareProductiekernLeesUitvoerder,
  type ProductiekernLeesWeerbaarheidOpties,
} from './productiekernSupabaseLeesWeerbaarheid';

export interface ProductiekernSupabaseClientOpties {
  transport?: ProductiekernLeesTransportOpties;
  weerbaarheid?: ProductiekernLeesWeerbaarheidOpties;
}

/**
 * Volledige maar nog client-agnostische samenstelling:
 * begrensde timeout/retry -> allowlisted querycontract -> privacy-veilige
 * transportadapter -> bewijs- en leespoort -> read-only repository.
 *
 * De concrete Supabase-client wordt bewust nog niet geïmporteerd. Daardoor kan
 * deze factory geen productieverbinding openen zonder een apart beoordeelde
 * uitvoerder en volledig leesbewijs.
 */
export function stelProductiekernSupabaseClientSamen(
  bewijs: Partial<ProductieLeesActivatieBewijs> | null | undefined,
  uitvoerder: ProductiekernSupabaseQueryUitvoerder,
  opties: ProductiekernSupabaseClientOpties = {},
): ProductiekernLeesSamenstelling {
  const weerbareUitvoerder = maakWeerbareProductiekernLeesUitvoerder(
    uitvoerder,
    opties.weerbaarheid,
  );
  const transport = maakProductiekernSupabaseLeesTransport(
    weerbareUitvoerder,
    opties.transport,
  );
  return stelSupabaseProductiekernLezenSamen(bewijs, transport);
}
