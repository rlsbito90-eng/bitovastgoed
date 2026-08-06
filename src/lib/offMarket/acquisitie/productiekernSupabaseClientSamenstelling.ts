import type { ProductieLeesActivatieBewijs } from './productieLeesActivatiePoort';
import type { ProductiekernLeesSamenstelling } from './productiekernLeesSamenstelling';
import { stelSupabaseProductiekernLezenSamen } from './productiekernSupabaseLeesSamenstelling';
import {
  maakProductiekernSupabaseLeesTransport,
  type ProductiekernLeesTransportOpties,
  type ProductiekernSupabaseQueryUitvoerder,
} from './productiekernSupabaseLeesTransportAdapter';

/**
 * Volledige maar nog client-agnostische samenstelling:
 * allowlisted querycontract -> privacy-veilige transportadapter -> bewijs- en
 * leespoort -> read-only repository.
 *
 * De concrete Supabase-client wordt bewust nog niet geïmporteerd. Daardoor kan
 * deze factory geen productieverbinding openen zonder een apart beoordeelde
 * uitvoerder en volledig leesbewijs.
 */
export function stelProductiekernSupabaseClientSamen(
  bewijs: Partial<ProductieLeesActivatieBewijs> | null | undefined,
  uitvoerder: ProductiekernSupabaseQueryUitvoerder,
  opties: ProductiekernLeesTransportOpties = {},
): ProductiekernLeesSamenstelling {
  const transport = maakProductiekernSupabaseLeesTransport(uitvoerder, opties);
  return stelSupabaseProductiekernLezenSamen(bewijs, transport);
}
