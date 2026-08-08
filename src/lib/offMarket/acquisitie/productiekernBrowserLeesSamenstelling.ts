import type { ProductieLeesActivatieBewijs } from './productieLeesActivatiePoort';
import {
  stelProductiekernSupabaseClientSamen,
  type ProductiekernSupabaseClientOpties,
  type ProductiekernSupabaseClientSamenstelling,
} from './productiekernSupabaseClientSamenstelling';
import {
  maakProductiekernSupabaseQueryUitvoerder,
  type ProductiekernSupabaseClientLike,
} from './productiekernSupabaseQueryUitvoerder';

/**
 * Enige browser-composition seam voor read-only productiekernreads.
 *
 * De bestaande applicatie-Supabase-client wordt geïnjecteerd; deze module kent
 * zelf geen URL, key of projectref. De centrale leesactivatiepoort blijft
 * onderdeel van dezelfde samenstelling. Zonder volledig bewijs kan een caller
 * dus wel een client aanleveren, maar geen query uitvoeren.
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
