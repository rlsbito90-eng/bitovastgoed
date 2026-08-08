import {
  metBegrensdeProductiekernLeesRetry,
  type ProductiekernLeesRetryOpties,
} from './productiekernSupabaseLeesRetry';
import {
  metProductiekernLeesTimeout,
  type ProductiekernLeesTimeoutOpties,
} from './productiekernSupabaseLeesTimeout';
import type { ProductiekernSupabaseQueryUitvoerder } from './productiekernSupabaseLeesTransportAdapter';

export interface ProductiekernLeesWeerbaarheidOpties {
  retry?: ProductiekernLeesRetryOpties;
  timeout?: ProductiekernLeesTimeoutOpties;
}

/**
 * Iedere poging krijgt eerst een eigen timeout; uitsluitend een genormaliseerbaar
 * tijdelijke fout mag daarna opnieuw worden geprobeerd. Hierdoor kan een hangende
 * poging de volledige read niet onbeperkt blokkeren.
 */
export function maakWeerbareProductiekernLeesUitvoerder(
  uitvoerder: ProductiekernSupabaseQueryUitvoerder,
  opties: ProductiekernLeesWeerbaarheidOpties = {},
): ProductiekernSupabaseQueryUitvoerder {
  const begrensdePoging = metProductiekernLeesTimeout(uitvoerder, opties.timeout);
  return metBegrensdeProductiekernLeesRetry(begrensdePoging, opties.retry);
}
