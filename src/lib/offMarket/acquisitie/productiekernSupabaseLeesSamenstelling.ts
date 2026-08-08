import type { ProductieLeesActivatieBewijs } from './productieLeesActivatiePoort';
import type { ProductiekernLeesActivatieBesluit } from './productiekernLeesActivatieBesluit';
import {
  stelProductiekernLezenSamen,
  stelProductiekernLezenSamenMetBesluit,
  type ProductiekernLeesSamenstelling,
} from './productiekernLeesSamenstelling';
import {
  SupabaseProductiekernLeesRepository,
  type ProductiekernSupabaseLeesTransport,
} from './productiekernSupabaseLeesRepository';

/**
 * Omgevingsneutrale route wanneer productie of werk-CRM zijn eigen poort al
 * heeft beoordeeld. Een actief besluit kan alleen reads vrijgeven; de concrete
 * Supabase-adapter blijft structureel read-only.
 */
export function stelSupabaseProductiekernLezenSamenMetBesluit(
  activatie: ProductiekernLeesActivatieBesluit,
  transport: ProductiekernSupabaseLeesTransport,
): ProductiekernLeesSamenstelling {
  return stelProductiekernLezenSamenMetBesluit(
    activatie,
    new SupabaseProductiekernLeesRepository(transport),
  );
}

/**
 * Productiespecifieke convenience-route voor de Supabase read-adapter.
 * Zonder volledig productie-readbewijs stopt de repository fail-closed.
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
