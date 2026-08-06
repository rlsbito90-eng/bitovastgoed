import type { ProductieLeesActivatieBewijs } from './productieLeesActivatiePoort';
import {
  stelProductiekernLezenSamen,
  type ProductiekernLeesSamenstelling,
} from './productiekernLeesSamenstelling';
import {
  SupabaseProductiekernLeesRepository,
  type ProductiekernSupabaseLeesTransport,
} from './productiekernSupabaseLeesRepository';

/**
 * Enige toegestane samenstellingsroute voor de Supabase read-adapter.
 *
 * Een transportobject alleen is onvoldoende: zonder volledig activatiebewijs
 * retourneert deze factory een repository die vóór elke read fail-closed stopt.
 * De onderliggende Supabase-adapter blijft bovendien structureel read-only.
 */
export function stelSupabaseProductiekernLezenSamen(
  bewijs: Partial<ProductieLeesActivatieBewijs> | null | undefined,
  transport: ProductiekernSupabaseLeesTransport,
): ProductiekernLeesSamenstelling {
  return stelProductiekernLezenSamen(
    bewijs,
    new SupabaseProductiekernLeesRepository(transport),
  );
}
