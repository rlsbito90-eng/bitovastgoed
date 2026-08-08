import type { ProductieLeesActivatieBewijs } from './productieLeesActivatiePoort';
import type { ProductiekernLeesActivatieBesluit } from './productiekernLeesActivatieBesluit';
import {
  stelProductiekernSupabaseClientSamen,
  stelProductiekernSupabaseClientSamenMetBesluit,
  type ProductiekernSupabaseClientOpties,
  type ProductiekernSupabaseClientSamenstelling,
} from './productiekernSupabaseClientSamenstelling';
import {
  maakProductiekernSupabaseQueryUitvoerder,
  type ProductiekernSupabaseClientLike,
} from './productiekernSupabaseQueryUitvoerder';

/**
 * Omgevingsneutrale browser-composition seam nadat een afzonderlijke poort
 * zijn activatiebesluit al heeft beoordeeld.
 */
export function stelProductiekernBrowserLezenSamenMetBesluit(
  client: ProductiekernSupabaseClientLike,
  activatie: ProductiekernLeesActivatieBesluit,
  opties: ProductiekernSupabaseClientOpties = {},
): ProductiekernSupabaseClientSamenstelling {
  return stelProductiekernSupabaseClientSamenMetBesluit(
    activatie,
    maakProductiekernSupabaseQueryUitvoerder(client),
    opties,
  );
}

/**
 * Productiespecifieke browser-composition seam voor read-only dual-read.
 */
export function stelProductiekernBrowserLezenSamen(
  client: ProductiekernSupabaseClientLike,
  bewijs: Partial<ProductieLeesActivatieBewijs> | null | undefined,
  opties: ProductiekernSupabaseClientOpties = {},
): ProductiekernSupabaseClientSamenstelling {
  return stelProductiekernSupabaseClientSamen(
    bewijs,
    maakProductiekernSupabaseQueryUitvoerder(client),
    opties,
  );
}
